<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { ArrowDown, ArrowUp, Close, Delete, DocumentCopy, EditPen, Link, Minus, Monitor, Plus, Position } from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import { pickElement, runWebCommand, type PickedElement } from '../web-executor'
import { copyText } from '../clipboard'
import { suggestName, saveElements, type CapturedElement } from '../elements'
import {
  listenElementEditorDone,
  openElementEditor,
  payloadOfElement,
} from '../element-editor'
import { toastError, toastSuccess, toastWarning } from '../notify'

const store = useAppStore()

type TabKey = 'elements' | 'images' | 'errors' | 'logs' | 'table' | 'drag'
const active = ref<TabKey>('logs')
const listRef = ref<HTMLElement | null>(null)

const tabs: { key: TabKey; label: string; dot?: boolean }[] = [
  { key: 'elements', label: '元素库' },
  { key: 'images', label: '图像库' },
  { key: 'errors', label: '错误列表', dot: true },
  { key: 'logs', label: '运行日志' },
  { key: 'table', label: '数据表格' },
  { key: 'drag', label: '流程参数' },
]

function setTab(key: string | number) {
  active.value = key as TabKey
}

function scrollBottom() {
  void nextTick(() => {
    const el = listRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(
  () => store.logs.length,
  () => {
    if (active.value === 'logs') scrollBottom()
  },
)

watch(active, () => {
  if (active.value === 'logs') scrollBottom()
})

function fmt(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/* ---------- 元素库：数据存在 store，此处只负责展示与交互 ---------- */
const elements = computed(() => store.elements)
const elementGroups = computed(() => store.elementGroups)
const selectedElement = computed(() => store.selectedElement)
/** 选中元素的 {{引用}} 文本（模板内直接写会与插值语法冲突） */
const refText = computed(() => (selectedElement.value ? `{{${selectedElement.value.name}}}` : ''))
/** 折叠的页面分组 id 集合 */
const collapsedGroups = ref<Set<string>>(new Set())

function toggleGroup(id: string) {
  const next = new Set(collapsedGroups.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedGroups.value = next
}

function selectElement(id: string) {
  store.selectedElementId = store.selectedElementId === id ? null : id
}

const captureVisible = ref(false)
const captureSelector = ref('')
const captureName = ref('')
const capturing = ref(false)
const picking = ref(false)

/** 到浏览器页面上点选元素，自动回填选择器与名称 */
async function pickFromPage() {
  if (picking.value) return
  picking.value = true
  try {
    const { selector, element } = await pickElement()
    captureSelector.value = selector
    if (!captureName.value.trim()) {
      captureName.value = suggestName(element)
    }
    // 抓取到的元素直接入库
    const el = store.addElement({
      name: captureName.value.trim() || suggestName(element),
      selector,
      xpath: element.xpath,
      tagName: element.tagName,
      text: element.text,
      similarCount: element.similarCount,
      url: element.url,
    })
    if (el) {
      captureName.value = el.name
      toastSuccess(`已加入元素库：{{${el.name}}}`, { title: '抓取成功', duration: 2200 })
    }
  } catch (e) {
    toastError((e as Error).message, { title: '抓取失败' })
  } finally {
    picking.value = false
  }
}

async function captureElement() {
  const selector = captureSelector.value.trim()
  if (!selector) {
    toastWarning('请输入元素选择器', { title: '选择器为空' })
    return
  }
  capturing.value = true
  try {
    const data = (await runWebCommand('get-element-web', {
      selector,
      variable: '__capturedElement',
    })) as { info?: PickedElement } | null
    const info = data?.info
    const el = store.addElement({
      name: captureName.value.trim() || (info ? suggestName(info) : '') || selector,
      selector,
      xpath: info?.xpath,
      tagName: info?.tagName,
      text: info?.text,
      similarCount: info?.similarCount,
      url: info?.url,
    })
    if (!el) {
      toastWarning('选择器为空，未加入元素库', { title: '保存失败' })
      return
    }
    captureName.value = el.name
    captureSelector.value = ''
    captureVisible.value = false
    toastSuccess(`元素已存为元素变量 {{${el.name}}}`, { title: '采集成功', duration: 2200 })
  } catch (e) {
    toastError((e as Error).message, { title: '采集失败' })
  } finally {
    capturing.value = false
  }
}

/** 复制元素引用 {{name}}，便于在指令参数里直接粘贴 */
async function copyRef(el: { name: string }) {
  const ok = await copyText(`{{${el.name}}}`)
  if (ok) toastSuccess(`已复制 {{${el.name}}}`, { title: '已复制引用', duration: 1800 })
  else toastWarning('复制失败，请手动输入引用', { title: '复制失败' })
}

function removeElement(id: string) {
  store.removeElement(id)
}

/** 清空元素库（危险操作，需确认） */
async function clearElements() {
  if (!elements.value.length) return
  try {
    await ElMessageBox.confirm(
      `确定清空元素库？将移除 ${elements.value.length} 个元素及其对应的元素变量，已引用这些变量的指令会失效。`,
      '清空元素库',
      { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  const names = elements.value.map((el) => el.name)
  store.elements = []
  store.selectedElementId = null
  saveElements([])
  names.forEach((n) => store.removeGlobalVar(n))
  toastSuccess('元素库已清空', { title: '已清空' })
}

/** 重命名：元素库面板内联编辑 */
const renamingId = ref<string | null>(null)
const renameValue = ref('')

function startRename(el: { id: string; name: string }) {
  renamingId.value = el.id
  renameValue.value = el.name
  void nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.ele-rename input')
    input?.focus()
    input?.select()
  })
}

function confirmRename() {
  if (!renamingId.value) return
  const id = renamingId.value
  // 先收起编辑态，避免 blur 与 enter 重复触发
  renamingId.value = null
  store.renameElement(id, renameValue.value)
}

function cancelRename() {
  renamingId.value = null
}

/* ---------- 元素编辑器子窗口 ---------- */

/** 新建元素时记住来源页面，便于元素库分组 */
const draftSource = ref<{ url: string; title: string } | null>(null)

/** 打开元素编辑器：编辑现有元素，或传入空数据新建 */
async function openEditor(el?: CapturedElement) {
  if (el) {
    draftSource.value = null
    try {
      await openElementEditor(payloadOfElement(el))
    } catch (e) {
      toastError((e as Error).message, { title: '打开元素编辑器失败' })
    }
    return
  }
  // 新建：以当前选中元素所在页面为来源，取不到则留空
  const src = selectedElement.value
  draftSource.value = src?.url
    ? { url: src.url, title: src.title ?? '' }
    : null
  try {
    await openElementEditor({
      name: '',
      selector: '',
      url: draftSource.value?.url,
      title: draftSource.value?.title,
    })
  } catch (e) {
    toastError((e as Error).message, { title: '打开元素编辑器失败' })
  }
}

/**
 * 子窗口点「完成」后回传结果：
 * 已有元素走原地更新（名称可能改动，需同步元素变量），
 * 新建元素则入库。
 */
let unlistenEditor: (() => void) | null = null

onMounted(async () => {
  unlistenEditor = await listenElementEditorDone((res) => {
    if (res.cancel) return
    const name = res.name.trim()
    const selector = res.selector.trim()
    if (!name || !selector) return

    if (res.id) {
      const el = store.elements.find((e) => e.id === res.id)
      if (!el) return
      // 名字改过时先校验重名，再同步元素变量
      if (el.name !== name && !store.renameElement(el.id, name)) return
      store.updateElementSelector(el.id, selector)
      if (res.xpath) el.xpath = res.xpath
      saveElements(store.elements)
      store.syncElementVars()
      toastSuccess(`已更新元素：${name}`, { title: '已保存', duration: 1800 })
      return
    }

    const created = store.addElement({
      name,
      selector,
      xpath: res.xpath,
      url: draftSource.value?.url,
      title: draftSource.value?.title,
    })
    if (created) toastSuccess(`已加入元素库：${created.name}`, { title: '已保存', duration: 1800 })
  })
})

onBeforeUnmount(() => {
  unlistenEditor?.()
  unlistenEditor = null
})

/* ---------- 面板高度可调（拖拽 / 双击复位 / 键盘微调，本地持久化） ---------- */
const HEIGHT_KEY = 'leaf-rpa.bottom-panel.height'
const DEFAULT_HEIGHT = 200
const MIN_HEIGHT = 120
const MAX_HEIGHT = 600

function clampHeight(h: number): number {
  const max = Math.min(MAX_HEIGHT, Math.floor(window.innerHeight * 0.7))
  return Math.min(max, Math.max(MIN_HEIGHT, Math.round(h)))
}

function loadHeight(): number {
  try {
    const raw = localStorage.getItem(HEIGHT_KEY)
    if (!raw) return DEFAULT_HEIGHT
    const n = Number(raw)
    return Number.isFinite(n) ? clampHeight(n) : DEFAULT_HEIGHT
  } catch {
    return DEFAULT_HEIGHT
  }
}

function persistHeight() {
  try {
    localStorage.setItem(HEIGHT_KEY, String(panelHeight.value))
  } catch {
    /* 忽略本地存储失败 */
  }
}

const panelHeight = ref(loadHeight())
const dragging = ref(false)
let startY = 0
let startH = 0

function onHandleDown(e: MouseEvent) {
  if (e.button !== 0) return
  dragging.value = true
  startY = e.clientY
  startH = panelHeight.value
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onHandleMove)
  window.addEventListener('mouseup', onHandleUp)
}

function onHandleMove(e: MouseEvent) {
  if (!dragging.value) return
  panelHeight.value = clampHeight(startH + (startY - e.clientY))
}

function onHandleUp() {
  if (!dragging.value) return
  dragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onHandleMove)
  window.removeEventListener('mouseup', onHandleUp)
  persistHeight()
}

function onHandleKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  e.preventDefault()
  panelHeight.value = clampHeight(panelHeight.value + (e.key === 'ArrowUp' ? -16 : 16))
  persistHeight()
}

function resetHeight() {
  panelHeight.value = DEFAULT_HEIGHT
  persistHeight()
}

/* ---------- 折叠 / 关闭（本地持久化） ---------- */
const COLLAPSED_KEY = 'leaf-rpa.bottom-panel.collapsed'
const CLOSED_KEY = 'leaf-rpa.bottom-panel.closed'

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function saveFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* 忽略本地存储失败 */
  }
}

const collapsed = ref(loadFlag(COLLAPSED_KEY))
const closed = ref(loadFlag(CLOSED_KEY))

const activeLabel = computed(() => tabs.find((t) => t.key === active.value)?.label ?? '')

function collapsePanel() {
  if (collapsed.value) return
  collapsed.value = true
  saveFlag(COLLAPSED_KEY, true)
}

function expandPanel() {
  if (!collapsed.value) return
  collapsed.value = false
  saveFlag(COLLAPSED_KEY, false)
}

function closePanel() {
  closed.value = true
  saveFlag(CLOSED_KEY, true)
}

function openPanel() {
  closed.value = false
  collapsed.value = false
  saveFlag(CLOSED_KEY, false)
  saveFlag(COLLAPSED_KEY, false)
}

async function clearLogs() {
  if (!store.logs.length) return
  try {
    await ElMessageBox.confirm('确定清空全部运行日志？', '清空日志', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  store.clearLogs()
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onHandleMove)
  window.removeEventListener('mouseup', onHandleUp)
})
</script>

<template>
  <div
    v-if="!closed"
    class="bottom-panel"
    :style="{ height: collapsed ? '38px' : panelHeight + 'px' }"
  >
    <div
      v-if="!collapsed"
      class="bp-resize"
      :class="{ dragging }"
      role="separator"
      tabindex="0"
      title="拖拽调整高度，双击恢复默认"
      @mousedown="onHandleDown"
      @dblclick="resetHeight"
      @keydown="onHandleKeydown"
    >
      <span class="bp-grip"></span>
    </div>

    <div class="bottom-head">
      <el-tooltip v-if="collapsed" content="展开面板" placement="bottom" :show-after="300">
        <el-button class="collapsed-tab" text @click="expandPanel">
          <el-icon :size="13"><Plus /></el-icon>
          {{ activeLabel }}
        </el-button>
      </el-tooltip>
      <template v-else>
        <el-tabs class="bp-tabs" :model-value="active" @update:model-value="setTab">
          <el-tab-pane v-for="t in tabs" :key="t.key" :name="t.key">
            <template #label>
              <el-badge v-if="t.dot" is-dot class="bp-dot-badge">{{ t.label }}</el-badge>
              <span v-else>{{ t.label }}</span>
            </template>
          </el-tab-pane>
        </el-tabs>
        <el-button v-if="active === 'logs'" class="head-btn" text @click="clearLogs">清空</el-button>
        <span class="deco">
          <el-tooltip content="折叠面板" placement="bottom" :show-after="300">
            <el-button class="deco-btn" text circle @click="collapsePanel">
              <el-icon :size="14"><Minus /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="关闭面板" placement="bottom" :show-after="300">
            <el-button class="deco-btn" text circle @click="closePanel">
              <el-icon :size="14"><Close /></el-icon>
            </el-button>
          </el-tooltip>
        </span>
      </template>
    </div>

    <div v-if="!collapsed" class="bottom-body">
      <template v-if="active === 'logs'">
        <div ref="listRef" class="log-scroll">
          <el-empty
            v-if="store.logs.length === 0"
            description="暂无日志，运行流程后在此显示输出。"
            :image-size="72"
          />
          <div v-for="(line, i) in store.logs" :key="i" class="log-line" :class="line.level">
            <span class="time">{{ fmt(line.time) }}</span>
            <span class="msg">{{ line.message }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="active === 'elements'">
        <div class="ele-layout">
          <!-- 左：按来源页面分组的元素树 -->
          <div class="ele-tree">
            <div v-if="elements.length === 0" class="ele-tree-empty">
              <el-empty description="暂无元素，点击右上角「捕获新元素」开始采集" :image-size="64" />
            </div>
            <template v-else>
              <div v-for="g in elementGroups" :key="g.group.id" class="ele-group">
                <button class="ele-group-head" @click="toggleGroup(g.group.id)">
                  <el-icon class="ele-caret" :class="{ folded: collapsedGroups.has(g.group.id) }" :size="11">
                    <ArrowDown />
                  </el-icon>
                  <el-icon class="ele-page-icon" :size="13"><Monitor /></el-icon>
                  <span class="ele-group-title" :title="g.group.url">{{ g.group.title }}</span>
                  <span class="ele-group-count">{{ g.group.count }}</span>
                </button>
                <div v-show="!collapsedGroups.has(g.group.id)" class="ele-group-body">
                  <div
                    v-for="el in g.items"
                    :key="el.id"
                    class="ele-row"
                    :class="{ active: store.selectedElementId === el.id }"
                    role="button"
                    tabindex="0"
                    @click="selectElement(el.id)"
                    @keydown.enter="selectElement(el.id)"
                  >
                    <el-icon class="ele-link-icon" :size="13"><Link /></el-icon>
                    <template v-if="renamingId === el.id">
                      <el-input
                        v-model="renameValue"
                        size="small"
                        class="ele-rename"
                        @click.stop
                        @keyup.enter="confirmRename"
                        @keyup.esc="cancelRename"
                        @blur="confirmRename"
                      />
                    </template>
                    <template v-else>
                      <span
                        class="ele-name"
                        :title="`${el.name}\n${el.selector}`"
                        @dblclick.stop="startRename(el)"
                      >
                        {{ el.name }}
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- 右：选中元素的详情 / 采集表单 -->
          <div class="ele-detail">
            <div class="ele-detail-head">
              <el-button class="head-btn" @click="openEditor()">
                <el-icon :size="12"><Plus /></el-icon>
                捕获新元素
              </el-button>
              <el-button class="head-btn" :disabled="!selectedElement" @click="openEditor(selectedElement!)">
                <el-icon :size="12"><EditPen /></el-icon>
                编辑元素
              </el-button>
              <el-dropdown trigger="click" class="ele-detail-more">
                <el-button class="deco-btn" text>
                  <el-icon :size="14"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="captureVisible = !captureVisible">
                      手动填写选择器
                    </el-dropdown-item>
                    <el-dropdown-item :disabled="!elements.length" @click="clearElements">
                      清空元素库
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <!-- 采集表单 -->
            <div v-if="captureVisible" class="ele-capture">
              <div class="cap-field">
                <label>元素选择器（CSS / XPath）</label>
                <div class="cap-pick-row">
                  <el-input
                    v-model="captureSelector"
                    placeholder="例如 #submit-btn 或 //button[@id='submit']"
                    clearable
                    @keyup.enter="captureElement"
                  />
                  <el-button :loading="picking" @click="pickFromPage">
                    <el-icon :size="12"><Position /></el-icon>
                    抓取
                  </el-button>
                </div>
              </div>
              <div class="cap-field">
                <label>元素变量名</label>
                <el-input
                  v-model="captureName"
                  placeholder="留空则根据元素文本自动命名"
                  clearable
                  @keyup.enter="captureElement"
                />
              </div>
              <p class="capture-tip">
                抓取会在浏览器中校验元素是否存在，需要已安装并连接轻羽浏览器插件；保存后可在任意输入框的 fx 中选择该元素变量。
              </p>
              <div class="cap-actions">
                <el-button @click="captureVisible = false">取消</el-button>
                <el-button type="primary" :loading="capturing" @click="captureElement">
                  校验并保存
                </el-button>
              </div>
            </div>

            <!-- 元素详情 -->
            <div v-else-if="selectedElement" class="ele-info">
              <div class="ei-head">
                <span class="ei-title" :title="selectedElement.name">{{ selectedElement.name }}</span>
                <span class="ei-tag">元素变量</span>
              </div>
              <div class="ei-grid">
                <span class="ei-k">引用</span>
                <div class="ei-v">
                  <code class="ei-code">{{ refText }}</code>
                  <el-tooltip content="复制引用" placement="top" :show-after="300">
                    <button class="ei-act" @click="copyRef(selectedElement)">
                      <el-icon :size="12"><DocumentCopy /></el-icon>
                    </button>
                  </el-tooltip>
                </div>

                <span class="ei-k">标签</span>
                <div class="ei-v">
                  <span v-if="selectedElement.tagName">&lt;{{ selectedElement.tagName }}&gt;</span>
                  <span v-else class="ei-muted">—</span>
                  <span v-if="selectedElement.similarCount && selectedElement.similarCount > 1" class="ei-similar">
                    相似元素 {{ selectedElement.similarCount }} 个
                  </span>
                </div>

                <span class="ei-k">文本</span>
                <div class="ei-v">
                  <span v-if="selectedElement.text" class="ei-ellipsis" :title="selectedElement.text">
                    {{ selectedElement.text }}
                  </span>
                  <span v-else class="ei-muted">—</span>
                </div>

                <span class="ei-k">CSS</span>
                <div class="ei-v">
                  <code class="ei-code ei-ellipsis" :title="selectedElement.selector">
                    {{ selectedElement.selector }}
                  </code>
                </div>

                <span class="ei-k">XPath</span>
                <div class="ei-v">
                  <code v-if="selectedElement.xpath" class="ei-code ei-ellipsis" :title="selectedElement.xpath">
                    {{ selectedElement.xpath }}
                  </code>
                  <span v-else class="ei-muted">—</span>
                </div>

                <span class="ei-k">来源</span>
                <div class="ei-v">
                  <span v-if="selectedElement.url" class="ei-ellipsis" :title="selectedElement.url">
                    {{ selectedElement.title || selectedElement.url }}
                  </span>
                  <span v-else class="ei-muted">未知页面</span>
                </div>
              </div>
              <div class="ei-actions">
                <el-button size="small" @click="startRename(selectedElement)">
                  <el-icon :size="12"><EditPen /></el-icon>
                  重命名
                </el-button>
                <el-button size="small" @click="copyRef(selectedElement)">
                  <el-icon :size="12"><DocumentCopy /></el-icon>
                  复制引用
                </el-button>
                <el-button size="small" type="danger" plain @click="removeElement(selectedElement.id)">
                  <el-icon :size="12"><Delete /></el-icon>
                  删除
                </el-button>
              </div>
            </div>

            <!-- 未选中元素 -->
            <div v-else class="ele-empty">
              <el-empty
                :description="elements.length ? '在左侧选择元素查看详情' : '捕获到的页面元素会出现在这里'"
                :image-size="64"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <el-empty
          :description="active === 'images' ? '暂无图像' : active === 'errors' ? '暂无错误列表' : active === 'table' ? '暂无数据表格' : '暂无流程参数'"
          :image-size="70"
        />
      </template>
    </div>

  </div>

  <el-tooltip v-else content="打开底部面板" placement="top" :show-after="300">
    <el-button class="reopen-panel" round @click="openPanel">
      <el-icon :size="16"><ArrowUp /></el-icon>
      面板
    </el-button>
  </el-tooltip>
</template>

<style scoped>
.bottom-panel {
  background: var(--bg);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
}

.bp-resize {
  height: 2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  position: relative;
  z-index: 2;
}

.bp-resize::before {
  content: '';
  position: absolute;
  inset: 0;
  transition: background 0.15s;
}

/* 命中区域向上下各扩 4px，视觉仍保持 2px */
.bp-resize::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -4px;
  bottom: -4px;
}

.bp-resize:hover::before,
.bp-resize.dragging::before,
.bp-resize:focus-visible::before {
  background: var(--accent-soft);
}

.bp-grip {
  width: 44px;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  transition: background 0.15s;
}

.bp-resize:hover .bp-grip,
.bp-resize.dragging .bp-grip,
.bp-resize:focus-visible .bp-grip {
  background: var(--accent);
}

.bp-resize:focus-visible {
  outline: none;
}

.bottom-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  height: 40px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

/* el-tabs 扁平化适配：沿用面板头高度与主题变量 */
.bp-tabs {
  --el-tabs-header-height: 40px;
  flex: 1;
  min-width: 0;
}

.bp-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.bp-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.bp-tabs :deep(.el-tabs__item) {
  padding: 0 8px;
  font-size: 13px;
  color: var(--text-2);
}

.bp-tabs :deep(.el-tabs__item:hover),
.bp-tabs :deep(.el-tabs__item.is-active) {
  color: var(--text);
}

.bp-tabs :deep(.el-tabs__item.is-active) {
  font-weight: 500;
}

.bp-tabs :deep(.el-tabs__active-bar) {
  border-radius: 2px;
  background-color: var(--accent);
}

.bp-dot-badge {
  --el-badge-bg-color: var(--accent);
}

/* 头部小按钮（清空/添加新元素）尺寸收敛 */
.head-btn {
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  margin-right: 8px;
}

.deco {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.deco-btn {
  width: 24px;
  height: 24px;
  color: var(--text-3);
}

.collapsed-tab {
  height: 26px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

.reopen-panel {
  position: fixed;
  right: 16px;
  bottom: 12px;
  z-index: 90;
}

.bottom-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 14px;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.9;
}

.log-line .time {
  color: var(--text-3);
  margin-right: 10px;
}

.log-line.info .msg { color: var(--text-2); }
.log-line.success .msg { color: var(--el-color-success); }
.log-line.warn .msg { color: var(--el-color-warning); }
.log-line.error .msg { color: var(--accent); }

/* ---------- 元素库：左右分栏 ---------- */
.ele-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/* 左：来源页面分组树 */
.ele-tree {
  width: 300px;
  flex-shrink: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 8px;
  border-right: 1px solid var(--border);
}

.ele-tree-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ele-group + .ele-group {
  margin-top: 2px;
}

.ele-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 6px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}

.ele-group-head:hover {
  background: var(--panel);
}

.ele-caret {
  color: var(--text-3);
  transition: transform 0.15s;
  flex-shrink: 0;
}

.ele-caret.folded {
  transform: rotate(-90deg);
}

.ele-page-icon {
  color: var(--text-3);
  flex-shrink: 0;
}

.ele-group-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ele-group-count {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-3);
  padding: 0 5px;
  border-radius: 999px;
  background: var(--panel);
}

.ele-group-body {
  padding-left: 14px;
}

/* 元素行 */
.ele-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}

.ele-row:hover {
  background: var(--panel);
}

.ele-row.active {
  background: var(--row-selected);
}

.ele-row:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.ele-link-icon {
  color: var(--text-3);
  flex-shrink: 0;
}

.ele-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ele-rename {
  flex: 1;
  min-width: 0;
}

/* 右：详情面板 */
.ele-detail {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ele-detail-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 8px 10px;
}

.ele-detail-head .head-btn {
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--accent);
  border-color: var(--border);
}

.ele-detail-head .head-btn:hover {
  color: var(--accent-hover);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.ele-detail-more .deco-btn {
  width: 24px;
  height: 24px;
  color: var(--text-3);
}

.ele-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 元素详情内容 */
.ele-info {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 12px;
}

.ei-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}

.ei-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ei-tag {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--var-elem-fg);
  background: var(--var-elem-bg);
  border: 1px solid var(--var-elem-border);
  border-radius: 999px;
  padding: 0 6px;
  line-height: 17px;
}

.ei-grid {
  display: grid;
  grid-template-columns: 52px 1fr;
  row-gap: 8px;
  column-gap: 10px;
  align-items: center;
  font-size: 12px;
}

.ei-k {
  color: var(--text-3);
}

.ei-v {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--text);
}

.ei-code {
  font-family: var(--mono, ui-monospace, SFMono-Regular, Consolas, monospace);
  font-size: 12px;
  color: var(--var-elem-fg);
  background: var(--var-elem-bg);
  border-radius: 4px;
  padding: 1px 6px;
  min-width: 0;
}

.ei-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ei-muted {
  color: var(--text-3);
}

.ei-similar {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-3);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0 6px;
  line-height: 16px;
}

.ei-act {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ei-act:hover {
  color: var(--text);
  background: var(--hover);
}

.ei-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

/* 采集表单 */
.ele-capture {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cap-field label {
  display: block;
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 4px;
}

.cap-pick-row {
  display: flex;
  gap: 6px;
}

.cap-pick-row :deep(.el-input) {
  flex: 1;
  min-width: 0;
}

.capture-tip {
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.7;
}

.cap-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
