<script setup lang="ts">
/**
 * 元素编辑器（独立子窗口）。
 *
 * 左侧：DOM 层级树（祖先 → 自身 → 子节点），点节点可把该节点的选择器作为定位依据。
 * 右侧：属性表 —— 勾选若干属性并设置匹配方式/值，据此拼出「精准定位」选择器。
 * 底部：锚点（在属性表基础上追加文本锚点）、选择器类型（默认 CSS / XPath）。
 *
 * 顶栏「预览 / 精准定位」两个页签：预览展示元素基本信息，精准定位是属性表。
 * AI 辅助定位暂未实现，先不做入口。
 */
import { computed, onMounted, ref, watch } from 'vue'
import {
  Connection,
  Delete,
  HelpFilled,
  Refresh,
  Search,
  VideoPlay,
} from '@element-plus/icons-vue'
import WindowControls from './WindowControls.vue'
import VariablePicker from './VariablePicker.vue'
import { toastError, toastSuccess, toastWarning } from '../notify'
import {
  getElementAttributes,
  getNodeTree,
  pickElement,
  runWebCommand,
  validateSelector,
  type DomNodeInfo,
  type ElementAttributes,
  type PickedElement,
  type SelectorCheck,
} from '../web-executor'
import { suggestName } from '../elements'
import {
  finishElementEditor,
  takeElementEditorPayload,
  type ElementEditorPayload,
} from '../element-editor'
import { insertRef } from '../vars'


type TabKey = 'preview' | 'locate'
const activeTab = ref<TabKey>('locate')

/* ---------- 编辑态 ---------- */
const payload = ref<ElementEditorPayload | null>(null)
const name = ref('')
/** 默认选择器（CSS） */
const cssSelector = ref('')
/** XPath 选择器 */
const xpathSelector = ref('')
/** 最终使用哪种选择器 */
const selectorType = ref<'css' | 'xpath'>('css')
const loading = ref(false)
const loadError = ref('')
const checking = ref(false)
const checkResult = ref<SelectorCheck | null>(null)

/** 当前生效的选择器文本 */
const activeSelector = computed(() =>
  selectorType.value === 'xpath' ? xpathSelector.value : cssSelector.value,
)

onMounted(async () => {
  try {
    payload.value = await takeElementEditorPayload()
  } catch (e) {
    loadError.value = (e as Error).message
  }
  const p = payload.value
  if (p) {
    name.value = p.name
    cssSelector.value = p.selector
    xpathSelector.value = p.xpath ?? ''
    selectorType.value = 'css'
  }
  // 先锁定元素来源所在的标签页，再加载数据（否则会读到浏览器当前活动页面）
  targetTabId.value = await resolveTargetTab()
  if (activeSelector.value) void loadElement(activeSelector.value)
})

/* ---------- 页面数据加载 ---------- */
const tree = ref<{ ancestors: DomNodeInfo[]; self: DomNodeInfo | null; children: DomNodeInfo[] }>({
  ancestors: [],
  self: null,
  children: [],
})
const attrs = ref<ElementAttributes | null>(null)

/** 当前元素所在标签页 id（定位到来源页面，避免受浏览器当前活动标签影响） */
const targetTabId = ref<number | undefined>(undefined)

/**
 * 找出元素来源页面所在的标签页。
 *
 * 元素库里存的是抓取时的 url，但用户在编辑器里操作时浏览器可能已切到别的页面，
 * 若直接用「活动标签」会读到错误页面，表现为「捕获/校验都匹配不到」。
 * 这里按 url 归一化后比对，命中则锁定该标签页。
 */
async function resolveTargetTab(): Promise<number | undefined> {
  const srcUrl = payload.value?.url
  if (!srcUrl) return undefined
  try {
    const data = (await runWebCommand('list-web-pages', {})) as
      | { tabs: { id: number; url: string; active: boolean }[] }
      | null
    const tabs = data?.tabs ?? []
    if (!tabs.length) return undefined
    const norm = (u: string) => {
      try {
        const x = new URL(u)
        return `${x.origin}${x.pathname}`
      } catch {
        return u.split('#')[0].split('?')[0]
      }
    }
    const want = norm(srcUrl)
    const hit =
      tabs.find((t) => norm(t.url) === want) ??
      tabs.find((t) => t.active) ??
      tabs[0]
    return hit?.id
  } catch {
    return undefined
  }
}

async function loadElement(selector: string) {
  if (!selector.trim()) return
  loading.value = true
  loadError.value = ''
  try {
    const [t, a] = await Promise.all([
      getNodeTree(selector, targetTabId.value),
      getElementAttributes(selector, targetTabId.value),
    ])
    tree.value = t
    attrs.value = a
    if (!cssSelector.value) cssSelector.value = t.self?.cssSelector ?? selector
    if (!xpathSelector.value) xpathSelector.value = t.self?.xpath ?? ''
    syncRowsFromAttributes(a)
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

/* ---------- 属性表 ---------- */
interface AttrRow {
  id: string
  checked: boolean
  /** 属性名：innerText / type / class / id 或任意自有属性 */
  name: string
  /** 匹配方式 */
  match: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex'
  value: string
}

const MATCH_OPTIONS: { value: AttrRow['match']; label: string }[] = [
  { value: 'equals', label: '等于' },
  { value: 'contains', label: '包含' },
  { value: 'startsWith', label: '开头是' },
  { value: 'endsWith', label: '结尾是' },
  { value: 'regex', label: '正则' },
]

const rows = ref<AttrRow[]>([])
let rowSeq = 0

function newRow(name = '', value = ''): AttrRow {
  rowSeq += 1
  return { id: `row_${rowSeq}`, checked: false, name, match: 'equals', value }
}

/** 由插件返回的属性表初始化候选行：常用属性排前面，并默认勾选关键定位属性 */
function syncRowsFromAttributes(a: ElementAttributes) {
  const priority = ['innerText', 'type', 'class', 'id', 'name', 'index-of-type', 'index']
  const map: Record<string, string> = {
    ...a.attributes,
    innerText: a.innerText,
    'index-of-type': String(a.indexOfType ?? ''),
    index: String(a.index ?? ''),
  }
  const ordered = [
    ...priority.filter((k) => k in map),
    ...Object.keys(map).filter((k) => !priority.includes(k)),
  ]
  rows.value = ordered.slice(0, 12).map((k) => {
    const row = newRow(k, String(map[k] ?? '').slice(0, 60))
    // 只默认勾 innerText：它最能唯一定位（走 XPath）。
    // type/class 这类属性常在同页重复，勾上反而会让 CSS 变宽泛。
    row.checked = k === 'innerText'
    return row
  })
  if (!rows.value.length) rows.value = [newRow()]
}

function addRow() {
  rows.value.push(newRow())
}

function removeRow(id: string) {
  rows.value = rows.value.filter((r) => r.id !== id)
}

/**
 * 由勾选的属性行拼出 CSS 选择器。
 *
 * 注意 CSS 无法按文本匹配（innerText），因此：
 * - 若只勾了 innerText，返回空串，交给 XPath；
 * - index / index-of-type 用 :nth-of-type / :nth-child 表达。
 */
function buildCssFromRows(): string {
  const picked = rows.value.filter((r) => r.checked && r.name.trim())
  if (!picked.length) return ''
  const tag = tree.value.self?.tagName || '*'
  const parts: string[] = []
  let indexOfType: string | null = null
  for (const r of picked) {
    const key = r.name.trim()
    const val = r.value.trim()
    if (key === 'innerText') continue // CSS 无法按文本匹配，交给 XPath
    if (key === 'index-of-type') {
      if (val !== '') indexOfType = val
      continue
    }
    // index 是同类中的位置，与 index-of-type 等价，优先用 index-of-type
    if (key === 'index') continue
    // 空值不能拼进选择器（如 type="" 会永远匹配不到）
    if (!val) continue
    if (key === 'class') {
      // 多 class 用 .a.b 形式
      const parts2 = val.split(/\s+/).filter(Boolean).map((c) => `.${cssEscape(c)}`)
      parts.push(...parts2)
      continue
    }
    if (r.match === 'equals') parts.push(`[${key}="${cssEscapeValue(val)}"]`)
    else if (r.match === 'contains') parts.push(`[${key}*="${cssEscapeValue(val)}"]`)
    else if (r.match === 'startsWith') parts.push(`[${key}^="${cssEscapeValue(val)}"]`)
    else if (r.match === 'endsWith') parts.push(`[${key}$="${cssEscapeValue(val)}"]`)
  }
  // 只勾了 innerText：CSS 无从表达，返回空让调用方走 XPath
  if (!parts.length && indexOfType === null) return ''
  let out = `${tag}${parts.join('')}`
  if (indexOfType !== null) out += `:nth-of-type(${Number(indexOfType) + 1})`
  return out
}

/** 由勾选的属性行拼出 XPath */
function buildXpathFromRows(): string {
  const picked = rows.value.filter((r) => r.checked && r.name.trim() && r.value.trim())
  if (!picked.length) return ''
  const tag = tree.value.self?.tagName || '*'
  const conds: string[] = []
  let indexOfType: string | null = null
  for (const r of picked) {
    const key = r.name.trim()
    const val = r.value.trim()
    if (key === 'innerText') {
      if (r.match === 'equals') conds.push(`normalize-space(.)='${xpathQuote(val)}'`)
      else if (r.match === 'contains') conds.push(`contains(normalize-space(.), '${xpathQuote(val)}')`)
      else if (r.match === 'startsWith') conds.push(`starts-with(normalize-space(.), '${xpathQuote(val)}')`)
      else if (r.match === 'endsWith') conds.push(`substring(normalize-space(.), string-length(normalize-space(.)) - string-length('${xpathQuote(val)}') + 1) = '${xpathQuote(val)}'`)
      else conds.push(`matches(normalize-space(.), '${xpathQuote(val)}')`)
      continue
    }
    if (key === 'index-of-type') {
      if (val !== '') indexOfType = val
      continue
    }
    if (key === 'index') continue
    // 空值不能拼进表达式（如 @type='' 会永远匹配不到）
    if (!val) continue
    if (key === 'class') {
      // class 是多值属性：@class='a b' 精确匹配会被顺序/多余类名破坏，
      // 改为逐类 contains(concat(' ', @class, ' '), ' a ') 判断
      const classes = val.split(/\s+/).filter(Boolean)
      if (r.match === 'equals') {
        classes.forEach((c) =>
          conds.push(`contains(concat(' ', normalize-space(@class), ' '), ' ${xpathQuote(c)} ')`),
        )
      } else {
        conds.push(`contains(@class, '${xpathQuote(val)}')`)
      }
      continue
    }
    if (r.match === 'equals') conds.push(`@${key}='${xpathQuote(val)}'`)
    else if (r.match === 'contains') conds.push(`contains(@${key}, '${xpathQuote(val)}')`)
    else if (r.match === 'startsWith') conds.push(`starts-with(@${key}, '${xpathQuote(val)}')`)
    else if (r.match === 'endsWith') conds.push(`substring(@${key}, string-length(@${key}) - string-length('${xpathQuote(val)}') + 1) = '${xpathQuote(val)}'`)
    else conds.push(`matches(@${key}, '${xpathQuote(val)}')`)
  }
  // position() 在 //tag[...] 里是「每个父节点下的序号」，
  // 想取全局第 N 个同类元素必须写成 (//tag[...])[N]
  if (indexOfType !== null) {
    const pred = conds.length ? `[${conds.join(' and ')}]` : ''
    return `(//${tag}${pred})[${Number(indexOfType) + 1}]`
  }
  const pred = conds.length ? `[${conds.join(' and ')}]` : ''
  return `//${tag}${pred}`
}

/** CSS 标识符转义（简化版，覆盖常见 class/id） */
function cssEscape(s: string): string {
  return s.replace(/([^\w-])/g, '\\$1')
}

/** CSS 属性值转义：双引号与反斜杠 */
function cssEscapeValue(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * XPath 字符串字面量转义。
 * XPath 没有转义符，含单引号时只能用 concat() 拼接；
 * 这里直接拒绝含引号的文本，避免生成无法解析的表达式。
 */
function xpathQuote(s: string): string {
  return s.replace(/'/g, "’")
}

const previewCss = computed(() => buildCssFromRows())
const previewXpath = computed(() => buildXpathFromRows())

/**
 * 勾选变化时同步选择器。
 *
 * 关键：只勾 innerText 时 CSS 无法表达（返回空串），
 * 此时自动切到 XPath，否则用户点「校验」会拿着旧/空 CSS 去查，报「匹配不到」。
 * 只在用户改属性表时切换，不覆盖手动选择的类型之外的情况。
 */
watch(
  [previewCss, previewXpath],
  ([css, xp]) => {
    if (css) cssSelector.value = css
    if (xp) xpathSelector.value = xp
    if (!css && xp) selectorType.value = 'xpath'
  },
)

/* ---------- 锚点 ---------- */
const anchorText = ref('')
const anchorCaret = ref<number | null>(null)
const anchorPickerVisible = ref(false)

function applyAnchor() {
  const text = anchorText.value.trim()
  if (!text) {
    toastWarning('请先输入锚点文本', { title: '锚点为空' })
    return
  }
  const tag = tree.value.self?.tagName || '*'
  xpathSelector.value = `//${tag}[normalize-space(.)='${xpathQuote(text)}']`
  selectorType.value = 'xpath'
  toastSuccess('已用锚点文本生成 XPath', { title: '锚点已应用', duration: 1800 })
}

/* ---------- 操作 ---------- */

/** 重新捕获：回到页面上点选新元素，替换当前编辑目标 */
const repicking = ref(false)

async function rePick() {
  repicking.value = true
  try {
    const { selector, element } = await pickElement(undefined, targetTabId.value)
    cssSelector.value = selector
    xpathSelector.value = element.xpath || ''
    selectorType.value = 'css'
    if (!name.value.trim()) name.value = suggestName(element)
    await loadElement(selector)
    toastSuccess('已重新捕获元素', { title: '捕获成功', duration: 1800 })
  } catch (e) {
    toastError((e as Error).message, { title: '重新捕获失败' })
  } finally {
    repicking.value = false
  }
}

/**
 * 捕获相似元素：取与当前元素同 class 的兄弟节点，
 * 用它们的公共选择器替换当前选择器，便于批量操作列表。
 */
const similarCount = ref(0)

async function pickSimilar() {
  const selector = activeSelector.value.trim()
  if (!selector) {
    toastWarning('请先确定一个元素选择器', { title: '缺少选择器' })
    return
  }
  try {
    const data = (await runWebCommand('get-similar-web', { selector, limit: 200 }, targetTabId.value)) as
      | { count: number; items: PickedElement[] }
      | null
    const count = data?.count ?? 0
    if (!count) {
      toastWarning('未找到相似元素', { title: '无相似元素' })
      return
    }
    similarCount.value = count
    toastSuccess(`找到 ${count} 个相似元素`, { title: '捕获相似元素', duration: 2200 })
  } catch (e) {
    toastError((e as Error).message, { title: '捕获相似元素失败' })
  }
}

/** 校验当前生效的选择器 */
async function check() {
  const selector = activeSelector.value.trim()
  if (!selector) {
    toastWarning('请输入或生成选择器', { title: '选择器为空' })
    return
  }
  checking.value = true
  checkResult.value = null
  try {
    const res = await validateSelector(selector, selectorType.value, targetTabId.value)
    checkResult.value = res
    if (!res.ok) {
      toastError('未在页面上匹配到元素，请确认浏览器仍停在该页面', { title: '校验失败', duration: 3000 })
    } else if (res.unique) toastSuccess('唯一匹配 1 个元素', { title: '校验通过', duration: 1800 })
    else toastWarning(`匹配到 ${res.count} 个元素，建议增加条件`, { title: '匹配不唯一', duration: 2600 })
  } catch (e) {
    toastError((e as Error).message, { title: '校验失败' })
  } finally {
    checking.value = false
  }
}

/* ---------- 层级树 ---------- */
/** 点层级树节点：把它作为新的定位目标 */
async function useTreeNode(node: DomNodeInfo) {
  cssSelector.value = node.cssSelector
  xpathSelector.value = node.xpath
  selectorType.value = 'css'
  await loadElement(node.cssSelector || node.xpath)
}

function nodeLabel(n: DomNodeInfo): string {
  const id = n.id ? `#${n.id}` : ''
  const cls = n.classes ? `.${n.classes.trim().split(/\s+/).join('.')}` : ''
  return `<${n.tagName}${id}${cls}>`
}

/** 层级的展示属性：有文本时截断显示 */
function nodeDetail(n: DomNodeInfo): string {
  return n.text ? n.text.slice(0, 30) : ''
}

/* ---------- 完成 / 取消 ---------- */
const saving = ref(false)

async function done() {
  const selector = activeSelector.value.trim()
  if (!name.value.trim()) {
    toastWarning('请填写元素名称', { title: '名称为空' })
    return
  }
  if (!selector) {
    toastWarning('请填写或生成元素选择器', { title: '选择器为空' })
    return
  }
  saving.value = true
  try {
    await finishElementEditor({
      id: payload.value?.id,
      name: name.value.trim(),
      selector,
      xpath: xpathSelector.value.trim() || undefined,
      selectorType: selectorType.value,
      tagName: tree.value.self?.tagName,
      text: tree.value.self?.text || undefined,
      url: payload.value?.url,
      title: payload.value?.title,
    })
  } catch (e) {
    toastError((e as Error).message, { title: '保存失败' })
  } finally {
    saving.value = false
  }
}

async function cancel() {
  await finishElementEditor({
    id: payload.value?.id,
    name: name.value,
    selector: activeSelector.value,
    selectorType: selectorType.value,
    cancel: true,
  })
}

/* 变量选择：把 {{变量}} 插入锚点输入框 */
function insertVar(varName: string) {
  const res = insertRef(anchorText.value, varName, anchorCaret.value)
  anchorText.value = res.text
  anchorPickerVisible.value = false
}

const showHelp = ref(false)
</script>

<template>
  <div class="element-editor">
    <header class="ee-titlebar" data-tauri-drag-region>
      <span class="ee-title">元素编辑器</span>
      <WindowControls />
    </header>

    <div class="ee-body">
      <!-- 操作按钮行 -->
      <div class="ee-actions">
        <el-button size="small" :loading="repicking" @click="rePick">
          <el-icon :size="13"><Refresh /></el-icon>
          重新捕获
        </el-button>
        <el-button size="small" @click="pickSimilar">
          <el-icon :size="13"><Connection /></el-icon>
          捕获相似元素
        </el-button>
        <span v-if="similarCount" class="ee-similar-tip">已找到 {{ similarCount }} 个相似元素</span>
      </div>

      <!-- 元素名称 -->
      <div class="ee-name-row">
        <label class="ee-label">元素名称</label>
        <el-input v-model="name" placeholder="元素名称" clearable />
      </div>

      <div v-if="loadError" class="ee-error">
        <el-icon :size="13"><HelpFilled /></el-icon>
        <span>{{ loadError }}</span>
      </div>

      <!-- 主体：左层级树 + 右属性表 -->
      <div class="ee-panes">
        <div class="ee-pane-head">
          <button class="ee-tab" :class="{ active: activeTab === 'preview' }" @click="activeTab = 'preview'">
            预览
          </button>
          <button class="ee-tab" :class="{ active: activeTab === 'locate' }" @click="activeTab = 'locate'">
            <el-icon :size="12"><Search /></el-icon>
            精准定位
          </button>
          <span class="ee-pane-spacer"></span>
          <button class="ee-check" :disabled="checking" @click="check">
            <el-icon :size="13"><VideoPlay /></el-icon>
            校验元素
          </button>
        </div>

        <div class="ee-split">
          <!-- 左：DOM 层级树 -->
          <div class="ee-tree">
            <div class="ee-tree-head">
              <span class="ee-tree-col-check"></span>
              <span>元素节点（网页结构）</span>
            </div>
            <div class="ee-tree-body">
              <div v-if="loading" class="ee-tree-loading">加载中…</div>
              <template v-else>
                <div
                  v-for="(n, i) in tree.ancestors"
                  :key="`a${i}`"
                  class="ee-node"
                  :style="{ paddingLeft: `${10 + i * 12}px` }"
                  @click="useTreeNode(n)"
                >
                  <span class="ee-node-box"></span>
                  <span class="ee-node-label">{{ nodeLabel(n) }}</span>
                </div>
                <div v-if="tree.self" class="ee-node is-self" :style="{ paddingLeft: `${10 + tree.ancestors.length * 12}px` }">
                  <span class="ee-node-box is-checked"></span>
                  <span class="ee-node-label">{{ nodeLabel(tree.self) }}</span>
                </div>
                <div
                  v-for="(n, i) in tree.children"
                  :key="`c${i}`"
                  class="ee-node"
                  :style="{ paddingLeft: `${10 + (tree.ancestors.length + 1) * 12}px` }"
                  @click="useTreeNode(n)"
                >
                  <span class="ee-node-box"></span>
                  <span class="ee-node-label">{{ nodeLabel(n) }}</span>
                  <span v-if="nodeDetail(n)" class="ee-node-text">{{ nodeDetail(n) }}</span>
                </div>
                <div v-if="!tree.self" class="ee-tree-empty">暂无层级数据</div>
              </template>
            </div>
          </div>

          <!-- 右：属性表 / 预览 -->
          <div class="ee-detail">
            <template v-if="activeTab === 'locate'">
              <div class="ee-attr-head">
                <span class="ee-attr-col-check"></span>
                <span class="ee-attr-col-name">属性名</span>
                <span class="ee-attr-col-match">匹配方式</span>
                <span class="ee-attr-col-value">属性值</span>
                <span class="ee-attr-col-act"></span>
              </div>
              <div class="ee-attr-body">
                <div v-for="row in rows" :key="row.id" class="ee-attr-row">
                  <el-checkbox v-model="row.checked" size="small" />
                  <el-input v-model="row.name" size="small" placeholder="属性名" class="ee-attr-name" />
                  <el-select v-model="row.match" size="small" class="ee-attr-match">
                    <el-option v-for="o in MATCH_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                  <el-input v-model="row.value" size="small" placeholder="属性值" class="ee-attr-value" />
                  <button class="ee-attr-del" title="删除该条件" @click="removeRow(row.id)">
                    <el-icon :size="12"><Delete /></el-icon>
                  </button>
                </div>
                <button class="ee-attr-add" @click="addRow">＋</button>
              </div>
            </template>

            <!-- 预览：元素基本信息 -->
            <div v-else class="ee-preview">
              <div class="ee-pv-grid">
                <span class="ee-pv-k">标签</span>
                <div class="ee-pv-v">{{ tree.self ? `<${tree.self.tagName}>` : '—' }}</div>
                <span class="ee-pv-k">文本</span>
                <div class="ee-pv-v">{{ tree.self?.text || '—' }}</div>
                <span class="ee-pv-k">CSS</span>
                <div class="ee-pv-v mono">{{ cssSelector || '—' }}</div>
                <span class="ee-pv-k">XPath</span>
                <div class="ee-pv-v mono">{{ xpathSelector || '—' }}</div>
                <span class="ee-pv-k">来源</span>
                <div class="ee-pv-v">{{ payload?.title || payload?.url || '未知页面' }}</div>
              </div>
              <div v-if="checkResult" class="ee-pv-check">
                校验结果：{{ checkResult.ok ? `匹配 ${checkResult.count} 个` : '未匹配到元素' }}
                <span v-if="checkResult.unique" class="ee-badge ok">唯一</span>
                <span v-else-if="checkResult.ok" class="ee-badge warn">不唯一</span>
                <span v-else class="ee-badge err">无匹配</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 锚点 -->
      <div class="ee-anchor">
        <span class="ee-anchor-label">
          <el-icon :size="13"><Connection /></el-icon>
          锚点
        </span>
        <div class="ee-anchor-input">
          <el-input
            v-model="anchorText"
            size="small"
            placeholder="输入锚点文本"
            @blur="anchorCaret = null"
          />
          <el-popover
            v-model:visible="anchorPickerVisible"
            :width="236"
            trigger="click"
            placement="top-end"
            popper-class="var-picker-popper"
          >
            <template #reference>
              <button class="ee-fx" @mousedown.prevent>fx</button>
            </template>
            <VariablePicker @pick="insertVar" />
          </el-popover>
        </div>
        <el-tooltip content="用锚点文本生成 XPath" placement="top" :show-after="300">
          <button class="ee-icon-btn" @click="applyAnchor">
            <el-icon :size="14"><Refresh /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip content="清空锚点" placement="top" :show-after="300">
          <button class="ee-icon-btn" @click="anchorText = ''">
            <el-icon :size="14"><Delete /></el-icon>
          </button>
        </el-tooltip>
      </div>

      <!-- 选择器类型 -->
      <div class="ee-selector-type">
        <svg class="ee-spark" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1.2 9.4 6 14.2 7.4 9.4 8.8 8 13.6 6.6 8.8 1.8 7.4 6.6 6z" />
        </svg>
        <el-radio v-model="selectorType" value="css" size="small">默认选择器</el-radio>
        <el-radio v-model="selectorType" value="xpath" size="small">XPath</el-radio>
      </div>
    </div>

    <!-- 底部 -->
    <footer class="ee-footer">
      <el-popover v-model:visible="showHelp" :width="280" trigger="click" placement="top-start">
        <template #reference>
          <el-button size="small">
            <el-icon :size="13"><HelpFilled /></el-icon>
            帮助
          </el-button>
        </template>
        <div class="ee-help">
          <p><b>精准定位</b>：勾选属性行，选择器会自动生成。优先用 id 与稳定的 class。</p>
          <p><b>校验元素</b>：在页面上验证当前选择器，最好唯一命中。</p>
          <p><b>锚点</b>：属性不稳定时，用元素文本生成 XPath。</p>
        </div>
      </el-popover>
      <span class="ee-footer-spacer"></span>
      <el-button size="small" @click="cancel">取消</el-button>
      <el-button size="small" type="primary" :loading="saving" @click="done">完成</el-button>
    </footer>
  </div>
</template>

<style scoped>
.element-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}

/* 顶栏 */
.ee-titlebar {
  display: flex;
  align-items: center;
  height: 38px;
  flex-shrink: 0;
  padding-left: 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.ee-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

.ee-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  overflow: hidden;
}

/* 顶部按钮行 */
.ee-actions {
  display: flex;
  gap: 8px;
}

.ee-actions :deep(.el-button) {
  gap: 4px;
}

.ee-similar-tip {
  align-self: center;
  color: var(--var-fg);
  font-size: 12px;
}

/* 名称行 */
.ee-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ee-label {
  width: 64px;
  flex-shrink: 0;
  color: var(--text-2);
}

.ee-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius);
  background: var(--danger-bg, #fff2f0);
  color: var(--accent);
  font-size: 12px;
}

/* 页签头 */
.ee-panes {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.ee-pane-head {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  height: 36px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}

.ee-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
}

.ee-tab:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.04));
}

.ee-tab.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.ee-pane-spacer {
  flex: 1;
}

.ee-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
}

.ee-check:hover {
  background: var(--bg);
  color: var(--text);
}

.ee-check:disabled {
  opacity: 0.55;
  cursor: default;
}

/* 左右分栏 */
.ee-split {
  flex: 1;
  min-height: 0;
  display: flex;
}

.ee-tree {
  width: 46%;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.ee-tree-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  flex-shrink: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
  color: var(--text-3);
  font-size: 12px;
}

.ee-tree-col-check {
  width: 14px;
}

.ee-tree-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 0 8px;
}

.ee-tree-loading,
.ee-tree-empty {
  padding: 16px 12px;
  color: var(--text-3);
  font-size: 12px;
}

.ee-node {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding-right: 10px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-2);
}

.ee-node:hover {
  background: var(--panel);
}

.ee-node.is-self {
  background: var(--row-selected, #eaf2ff);
  color: var(--text);
  font-weight: 600;
}

.ee-node-box {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  border: 1px solid var(--border-strong, #c9c9cf);
  border-radius: 3px;
  background: var(--bg);
}

.ee-node-box.is-checked {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: inset 0 0 0 2px var(--bg);
}

.ee-node-label {
  font-family: var(--mono, ui-monospace, Consolas, monospace);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ee-node-text {
  color: var(--text-3);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 属性表 */
.ee-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ee-attr-head {
  display: grid;
  grid-template-columns: 14px 1fr 84px 1fr 20px;
  align-items: center;
  gap: 6px;
  height: 30px;
  flex-shrink: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
  color: var(--text-3);
  font-size: 12px;
}

.ee-attr-col-check {
  width: 14px;
}

.ee-attr-col-name,
.ee-attr-col-value {
  min-width: 0;
}

.ee-attr-col-match {
  min-width: 0;
}

.ee-attr-col-act {
  width: 20px;
}

.ee-attr-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 10px;
}

.ee-attr-row {
  display: grid;
  grid-template-columns: 14px 1fr 84px 1fr 20px;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.ee-attr-name,
.ee-attr-match,
.ee-attr-value {
  min-width: 0;
}

.ee-attr-del {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}

.ee-attr-del:hover {
  background: var(--panel);
  color: var(--accent);
}

.ee-attr-add {
  width: 22px;
  height: 22px;
  margin-left: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-3);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.ee-attr-add:hover {
  background: var(--panel);
  color: var(--accent);
}

/* 预览 */
.ee-preview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
}

.ee-pv-grid {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 8px 10px;
  align-items: start;
}

.ee-pv-k {
  color: var(--text-3);
}

.ee-pv-v {
  color: var(--text);
  word-break: break-all;
}

.ee-pv-v.mono {
  font-family: var(--mono, ui-monospace, Consolas, monospace);
  font-size: 12px;
}

.ee-pv-check {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
}

.ee-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.ee-badge.ok {
  background: #e8f8ee;
  color: #12a150;
}

.ee-badge.warn {
  background: #fff7e6;
  color: #d48806;
}

.ee-badge.err {
  background: #fff2f0;
  color: var(--accent);
}

/* 锚点行 */
.ee-anchor {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ee-anchor-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-2);
  font-size: 12px;
  white-space: nowrap;
}

.ee-anchor-input {
  position: relative;
  flex: 1;
  min-width: 0;
}

.ee-anchor-input :deep(.el-input__inner) {
  padding-right: 30px;
}

.ee-fx {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-3);
  font-size: 11px;
  font-style: italic;
  cursor: pointer;
}

.ee-fx:hover {
  background: var(--var-bg);
  color: var(--var-fg);
}

.ee-icon-btn {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text-2);
  cursor: pointer;
}

.ee-icon-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* 选择器类型 */
.ee-selector-type {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding-top: 2px;
}

.ee-spark {
  width: 13px;
  height: 13px;
  color: var(--text-3);
}

/* 底部 */
.ee-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  height: 52px;
  padding: 0 14px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}

.ee-footer-spacer {
  flex: 1;
}

.ee-help p {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-2);
}

.ee-help p:last-child {
  margin-bottom: 0;
}
</style>
