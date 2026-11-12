<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Aim,
  Back,
  DocumentChecked,
  Download,
  Files,
  MoreFilled,
  Plus,
  RefreshLeft,
  RefreshRight,
  VideoCamera,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue'
import CommandPanel from './CommandPanel.vue'
import StepList from './StepList.vue'
import FlowOutlinePanel from './FlowOutlinePanel.vue'
import BottomPanel from './BottomPanel.vue'
import WindowControls from './WindowControls.vue'

import { useAppStore, type FlowIssue } from '../store'
import { pollPluginEvents, runWebCommand } from '../web-executor'
import { toastError, toastSuccess, toastWarning } from '../notify'

type ToolPanel = '' | 'export' | 'check' | 'selector' | 'capture' | 'subflow' | 'record'

const PANEL_TITLES: Record<Exclude<ToolPanel, ''>, string> = {
  export: '导出流程',
  check: '流程检查',
  selector: '选择器',
  capture: '数据抓取',
  subflow: '新建子流程',
  record: '智能录制',
}

const store = useAppStore()

const nameDraft = ref('')
watch(
  () => store.current?.id,
  () => {
    nameDraft.value = store.current?.name ?? ''
  },
  { immediate: true },
)

const rename = () => {
  if (!store.current) return
  const trimmed = nameDraft.value.trim()
  if (!trimmed) {
    nameDraft.value = store.current.name
    return
  }
  store.renameFlow(trimmed)
}

const appNameChar = computed(() => (store.current?.name ?? '应').charAt(0) || '应')
const typeLabel = computed(() => {
  const t = store.current?.type
  return t === 'mobile' ? '手机应用' : t === 'instruction' ? '自定义指令' : 'PC 应用'
})

/* ---------- 工具面板（抽屉） ---------- */
const panel = ref<ToolPanel>('')
const panelTitle = computed(() => (panel.value ? PANEL_TITLES[panel.value] : ''))
const panelOpen = computed({
  get: () => !!panel.value,
  set: (v: boolean) => {
    if (!v) closePanel()
  },
})

function closePanel() {
  if (panel.value === 'record') void stopRecord()
  panel.value = ''
}

/* ---------- 选择器 ---------- */
const selectorValue = ref('')
const selectorChecking = ref(false)
const selectorOk = ref(false)

function nextNodePos() {
  const nodes = store.current?.nodes ?? []
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 40)
  return { x: 120, y: maxY + 120 }
}

function openSelector() {
  selectorValue.value = (store.selectedNode?.props.selector as string) ?? ''
  selectorOk.value = false
  panel.value = 'selector'
}

async function checkSelector() {
  const selector = selectorValue.value.trim()
  if (!selector) {
    toastWarning('请输入元素选择器', { title: '选择器为空' })
    return
  }
  selectorChecking.value = true
  try {
    await runWebCommand('get-element-web', { selector, variable: '__selectorCheck' })
    selectorOk.value = true
  } catch (e) {
    selectorOk.value = false
    toastError((e as Error).message, { title: '校验失败' })
  } finally {
    selectorChecking.value = false
  }
}

function insertSelector() {
  const selector = selectorValue.value.trim()
  if (!selector) return
  const target = store.selectedNode
  if (target && 'selector' in target.props) {
    target.props.selector = selector
    store.markDirty()
    toastSuccess('已更新选中节点的选择器', { title: '选择器已应用' })
  } else {
    const pos = nextNodePos()
    store.addNode('web.click', pos.x, pos.y)
    const created = store.selectedNode
    if (created) created.props.selector = selector
    store.markDirty()
    toastSuccess('已插入「点击元素」节点', { title: '节点已插入' })
  }
  panel.value = ''
}

/* ---------- 数据抓取 ---------- */
type CaptureKind = 'text' | 'element' | 'related' | 'similar'

const CAPTURE_TYPES: Record<CaptureKind, { label: string; type: string }> = {
  text: { label: '获取文本', type: 'web.getText' },
  element: { label: '获取元素对象', type: 'get-element-web' },
  related: { label: '获取关联元素', type: 'get-related-web' },
  similar: { label: '获取相似元素列表', type: 'get-similar-web' },
}

const captureSelector = ref('')
const captureKind = ref<CaptureKind>('text')
const captureRelation = ref('parent')
const captureRunning = ref(false)
const captureInsert = ref(true)

function openCapture() {
  captureSelector.value = (store.selectedNode?.props.selector as string) ?? ''
  captureKind.value = 'text'
  captureRunning.value = false
  panel.value = 'capture'
}

async function runCapture() {
  const selector = captureSelector.value.trim()
  if (!selector) {
    toastWarning('请输入元素选择器', { title: '选择器为空' })
    return
  }
  const meta = CAPTURE_TYPES[captureKind.value]
  captureRunning.value = true
  try {
    const params: Record<string, unknown> = { selector, variable: '__captured' }
    if (captureKind.value === 'related') params.relation = captureRelation.value
    if (captureKind.value === 'similar') params.limit = 50
    await runWebCommand(meta.type, params)
    if (captureInsert.value) {
      const pos = nextNodePos()
      store.addNode(meta.type, pos.x, pos.y)
      const created = store.selectedNode
      if (created) {
        created.props.selector = selector
        created.name = meta.label
      }
      store.markDirty()
    }
    toastSuccess('抓取完成，结果已保存到变量 __captured', { title: '抓取成功', duration: 2800 })
  } catch (e) {
    toastError((e as Error).message, { title: '抓取失败' })
  } finally {
    captureRunning.value = false
  }
}

/* ---------- 新建子流程 ---------- */
const subflowName = ref('')

function openSubflow() {
  subflowName.value = ''
  panel.value = 'subflow'
}

async function confirmSubflow() {
  const name = subflowName.value.trim()
  if (!name) {
    toastWarning('请输入子流程名称', { title: '名称为空' })
    return
  }
  if (store.flows.some((f) => f.type === 'instruction' && f.name === name)) {
    toastWarning('已存在同名子流程，请更换名称', { title: '名称重复' })
    return
  }
  try {
    await store.createSubflow(name)
  } catch (e) {
    toastError(e instanceof Error ? e.message : String(e), { title: '创建失败' })
    return
  }
  panel.value = ''
  toastSuccess(`子流程「${name}」已创建，并在流程末尾插入引用节点`, { title: '子流程已创建', duration: 3200 })
}

/* ---------- 智能录制 ---------- */
interface RecordItem {
  seq: number
  tag: string
  selector: string
  text: string
}

const recording = ref(false)
const recordItems = ref<RecordItem[]>([])
let recordTimer: ReturnType<typeof setInterval> | null = null
let recordSince = 0

function openRecord() {
  recordItems.value = []
  recordSince = 0
  panel.value = 'record'
}

async function startRecord() {
  try {
    await runWebCommand('plugin.record-start', {})
    // 丢弃启动前宿主内残留的历史事件
    const { seq } = await pollPluginEvents(Number.MAX_SAFE_INTEGER)
    recordSince = seq
  } catch (e) {
    toastError((e as Error).message, { title: '录制启动失败' })
    return
  }
  recording.value = true
  recordTimer = setInterval(() => void pollRecord(), 400)
}

async function pollRecord() {
  let result: { events: { seq: number; payload: unknown }[]; seq: number }
  try {
    result = await pollPluginEvents(recordSince)
  } catch (e) {
    stopRecord()
    toastError((e as Error).message, { title: '录制中断' })
    return
  }
  recordSince = result.seq
  for (const ev of result.events) {
    const payload = (ev.payload ?? {}) as Record<string, unknown>
    const tag = String(payload.tagName ?? '元素')
    const selector = String(payload.cssSelector ?? '')
    const text = String(payload.text ?? '').slice(0, 40)
    recordItems.value.push({ seq: ev.seq, tag, selector, text })
    store.appendNode('get-element-web', `元素 ${tag}`, {
      selector,
      variable: `el${recordItems.value.length}`,
    })
    store.log('success', `智能录制采集：<${tag}> ${selector.slice(0, 60)}`)
  }
}

async function stopRecord() {
  if (recordTimer) {
    clearInterval(recordTimer)
    recordTimer = null
  }
  recording.value = false
  if (recordItems.value.length > 0) {
    try {
      await runWebCommand('plugin.record-stop', {})
    } catch {
      /* 停止失败忽略 */
    }
  }
}

/* ---------- 单步调试 ---------- */
const currentDebugNode = computed(() => {
  if (!store.debugging || !store.current) return null
  const id = store.debugIds[store.debugPos]
  return store.current.nodes.find((n) => n.id === id) ?? null
})

function toggleDebug() {
  if (store.debugging) store.finishDebug()
  else void store.startDebug()
}

const onStop = () => {
  if (!store.running) return
  store.stopRequested = true
  toastSuccess('已请求停止，将在当前节点结束后终止', { title: '停止请求已提交' })
}

const saveState = computed(() => {
  if (store.dirty) return '编辑中…'
  if (store.savedAt) {
    return `已保存 ${new Date(store.savedAt).toLocaleTimeString('zh-CN', { hour12: false })}`
  }
  return '未修改'
})

/* ---------- 导入 / 导出（入口在「更多」下拉） ---------- */
const exportText = ref('')
const importInput = ref<HTMLInputElement | null>(null)

function openExport() {
  exportText.value = store.exportCurrent()
  panel.value = 'export'
}

function downloadExport() {
  const blob = new Blob([exportText.value], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${store.current?.name ?? 'flow'}.leafrpa`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toastSuccess('流程文件已保存', { title: '导出完成', duration: 2000 })
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    await store.importFlow(text)
  } catch (err) {
    toastError(err instanceof Error ? err.message : '导入失败', { title: '导入失败' })
  }
}

/* ---------- 流程检查 ---------- */
const issues = ref<FlowIssue[]>([])

function runCheck() {
  issues.value = store.validateFlow()
  panel.value = 'check'
}

function onMenu(cmd: string) {
  if (cmd === 'import') importInput.value?.click()
  else if (cmd === 'export') openExport()
  else if (cmd === 'check') runCheck()
}

/* ---------- 快捷键 ---------- */
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const tag = target?.tagName ?? ''
  const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target?.isContentEditable
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  if (mod && key === 's') {
    e.preventDefault()
    void store.saveCurrent()
    return
  }
  if (editing || !mod) return
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault()
    store.redo()
  } else if (key === 'c') {
    // 复制选中步骤：无选中时不拦截，避免影响页面文本复制
    if (!store.selectedNodeId || !store.copyNode(store.selectedNodeId)) return
    e.preventDefault()
  } else if (key === 'v') {
    // 仅在应用内已复制过步骤时接管，否则让浏览器正常粘贴
    if (!store.clipboard) return
    e.preventDefault()
    const node = store.pasteNode()
    if (node) toastSuccess(`已粘贴「${node.name}」`)
  } else if (key === '/') {
    // Ctrl+/ 注释步骤：复用「禁用」标记，运行与调试时都会被跳过
    if (!store.selectedNodeId) return
    e.preventDefault()
    store.toggleNodeDisabled(store.selectedNodeId)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (recordTimer) clearInterval(recordTimer)
  if (recording.value) void stopRecord()
})
</script>

<template>
  <section v-if="store.current" class="designer">
    <header class="toolbar" data-tauri-drag-region>
      <div class="tb-left" data-tauri-drag-region>
        <el-tooltip content="返回应用列表" placement="bottom" :show-after="300">
          <el-button text circle @click="store.backHome()">
            <el-icon :size="16"><Back /></el-icon>
          </el-button>
        </el-tooltip>
        <span class="app-badge">{{ appNameChar }}</span>
        <el-input
          v-model="nameDraft"
          class="flow-name-input"
          placeholder="输入应用名称"
          @blur="rename"
          @keydown.enter="rename"
        />
        <el-tag type="info" effect="plain">{{ typeLabel }}</el-tag>
        <el-tooltip content="撤销（Ctrl+Z）" placement="bottom" :show-after="300">
          <el-button text circle @click="store.undo()">
            <el-icon :size="15"><RefreshLeft /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="重做（Ctrl+Y）" placement="bottom" :show-after="300">
          <el-button text circle @click="store.redo()">
            <el-icon :size="15"><RefreshRight /></el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <div class="tb-scroll" data-tauri-drag-region>
        <div class="tb-center" data-tauri-drag-region>
          <el-button text @click="openCapture">
            <el-icon :size="14"><Download /></el-icon>&nbsp;数据抓取
          </el-button>
          <el-button text @click="openSelector">
            <el-icon :size="14"><Aim /></el-icon>&nbsp;选择器
          </el-button>
          <el-button text @click="openRecord">
            <el-icon :size="14"><VideoCamera /></el-icon>&nbsp;智能录制
          </el-button>
          <el-button text @click="openSubflow">
            <el-icon :size="14"><Files /></el-icon>&nbsp;新建子流程
          </el-button>
        </div>
      </div>

      <div class="tb-actions" data-tauri-drag-region>
        <el-tooltip
          :content="store.running ? '停止运行' : '运行流程'"
          placement="bottom"
          :show-after="300"
        >
          <el-button
            :type="store.running ? 'danger' : 'primary'"
            @click="store.running ? onStop() : store.run()"
          >
            <el-icon :size="14">
              <VideoPause v-if="store.running" />
              <VideoPlay v-else />
            </el-icon>&nbsp;{{ store.running ? '停止' : '运行' }}
          </el-button>
        </el-tooltip>
        <el-tooltip content="单步调试" placement="bottom" :show-after="300">
          <el-button
            text
            :type="store.debugging ? 'primary' : 'default'"
            @click="toggleDebug"
          >
            {{ store.debugging ? '调试中' : '调试' }}
          </el-button>
        </el-tooltip>
      </div>

      <div class="tb-right" data-tauri-drag-region>
        <el-text type="info" class="save-state">{{ saveState }}</el-text>
        <el-tooltip content="保存（Ctrl+S）" placement="bottom" :show-after="300">
          <el-button text @click="store.saveCurrent()">
            <el-icon :size="14"><DocumentChecked /></el-icon>&nbsp;保存
          </el-button>
        </el-tooltip>
        <el-dropdown trigger="click" @command="onMenu">
          <el-button text title="更多操作">
            <el-icon :size="14"><MoreFilled /></el-icon>&nbsp;更多
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="import">导入流程</el-dropdown-item>
              <el-dropdown-item command="export">导出流程</el-dropdown-item>
              <el-dropdown-item command="check">检查流程</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <WindowControls />
      </div>
    </header>

    <div v-if="store.debugging" class="debug-bar">
      <span class="dbg-step">
        单步调试 · 第 {{ Math.min(store.debugPos + 1, store.debugIds.length) }} / {{ store.debugIds.length }} 步
      </span>
      <span v-if="currentDebugNode" class="dbg-name">{{ currentDebugNode.name }}</span>
      <div class="spacer"></div>
      <el-button :disabled="store.running" @click="store.debugStep()">单步执行</el-button>
      <el-button type="primary" plain @click="store.finishDebug()">结束调试</el-button>
    </div>

    <div class="designer-body">
      <div class="left-col">
        <div class="top-row">
          <CommandPanel />

          <div class="flow-card">
            <div class="flow-tabbar">
              <div class="flow-tab active">主流程.flow</div>
              <el-tooltip content="新建子流程" placement="bottom" :show-after="300">
                <button class="tab-add" @click="openSubflow">
                  <el-icon :size="12"><Plus /></el-icon>
                </button>
              </el-tooltip>
            </div>
            <div class="center-main">
              <StepList />
            </div>
          </div>
        </div>

        <BottomPanel />
      </div>

      <FlowOutlinePanel />
    </div>

    <input ref="importInput" type="file" accept=".leafrpa" style="display: none" @change="onImportFile" />

    <el-drawer v-model="panelOpen" :title="panelTitle" size="460px">
      <div class="tool-body">
        <template v-if="panel === 'export'">
          <div class="export-brief">
            <div class="export-name">{{ store.current?.name ?? '' }}</div>
            <div class="export-meta">
              <el-tag effect="plain" size="small">{{ typeLabel }}</el-tag>
              <span>{{ store.current?.nodes.length ?? 0 }} 个节点</span>
            </div>
          </div>
          <p class="sub">导出为轻羽RPA专有流程文件（.leafrpa），在其它设备通过「导入」即可恢复该流程。</p>
          <div class="tool-actions">
            <el-button type="primary" @click="downloadExport">保存文件</el-button>
          </div>
        </template>

        <template v-else-if="panel === 'check'">
          <el-empty v-if="!issues.length" description="未发现问题，可以直接运行" :image-size="80" />
          <ul v-else class="issue-list">
            <li v-for="(it, i) in issues" :key="i">
              <el-tag :type="it.level === 'error' ? 'danger' : 'warning'" effect="light">
                {{ it.level === 'error' ? '错误' : '提醒' }}
              </el-tag>
              <span>{{ it.message }}</span>
            </li>
          </ul>
        </template>

        <template v-else-if="panel === 'selector'">
          <el-input
            v-model="selectorValue"
            type="textarea"
            :rows="3"
            placeholder="输入 CSS 或 XPath 选择器，例如 #submit-btn"
            @input="selectorOk = false"
          />
          <div class="selector-actions">
            <el-button :loading="selectorChecking" @click="checkSelector">校验元素</el-button>
            <span v-if="selectorOk" class="check-ok">元素可用</span>
          </div>
          <div class="tool-actions">
            <el-button type="primary" :disabled="!selectorOk" @click="insertSelector">
              插入到流程
            </el-button>
          </div>
        </template>

        <template v-else-if="panel === 'capture'">
          <el-form label-position="top">
            <el-form-item label="元素选择器">
              <el-input v-model="captureSelector" placeholder="例如 .product-title" clearable />
            </el-form-item>
            <el-form-item label="抓取方式">
              <el-radio-group v-model="captureKind">
                <el-radio-button v-for="(m, k) in CAPTURE_TYPES" :key="k" :value="k">
                  {{ m.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="captureKind === 'related'" label="关联关系">
              <el-select v-model="captureRelation">
                <el-option label="父元素" value="parent" />
                <el-option label="子元素" value="child" />
                <el-option label="下一个兄弟" value="next" />
                <el-option label="上一个兄弟" value="prev" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="captureInsert">同时插入为流程节点</el-checkbox>
            </el-form-item>
          </el-form>
          <div class="tool-actions">
            <el-button type="primary" :loading="captureRunning" @click="runCapture">
              开始抓取
            </el-button>
          </div>
        </template>

        <template v-else-if="panel === 'subflow'">
          <el-form label-position="top">
            <el-form-item label="子流程名称">
              <el-input
                v-model="subflowName"
                placeholder="例如：登录流程"
                maxlength="40"
                clearable
                @keyup.enter="confirmSubflow"
              />
            </el-form-item>
            <p class="sub">
              创建后会生成一个「自定义指令」流程，并在当前流程末尾插入「子流程」引用节点；可稍后在「应用」列表中打开该子流程编辑步骤。
            </p>
          </el-form>
          <div class="tool-actions">
            <el-button type="primary" @click="confirmSubflow">创建</el-button>
          </div>
        </template>

        <template v-else-if="panel === 'record'">
          <div class="record-actions">
            <el-button v-if="!recording" type="primary" @click="startRecord">开始录制</el-button>
            <el-button v-else type="danger" @click="stopRecord">结束录制</el-button>
            <span class="record-hint" :class="{ recording: recording }">
              {{ recording ? '录制中… 请在浏览器里点击页面元素' : '需先连接浏览器插件' }}
            </span>
          </div>
          <p class="sub">
            开始录制后，在浏览器中依次点击页面元素，每个元素会自动转换为「获取元素对象」步骤并追加到流程末尾；按 Esc 或点击「结束录制」停止。
          </p>
          <div class="record-list">
            <div v-for="(item, i) in recordItems" :key="item.seq" class="record-item">
              <span class="record-index">{{ i + 1 }}</span>
              <span class="record-tag">&lt;{{ item.tag }}&gt;</span>
              <span class="record-selector">{{ item.selector }}</span>
              <span class="record-text">{{ item.text }}</span>
            </div>
            <el-empty v-if="!recordItems.length" description="暂无采集记录" :image-size="60" />
          </div>
        </template>
      </div>
    </el-drawer>
  </section>
</template>

<style scoped>


.app-badge {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--el-color-danger);
  color: var(--el-color-white);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.flow-name-input {
  width: 200px;
  min-width: 92px;
}

.flow-name-input :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  border-radius: 6px;
}

.flow-name-input :deep(.el-input__inner) {
  font-weight: 500;
}

.flow-name-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--border) inset;
}

.flow-name-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--accent) inset;
  background: var(--panel);
}










.save-state {
  font-size: 12px;
  color: var(--text-3);
  margin-right: 6px;
  white-space: nowrap;
}

.designer {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
}

/* 顶部工具栏：同时作为无边框窗口的拖拽区域 */
.toolbar {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 12px;
  flex-shrink: 0;
  overflow: hidden;
  user-select: none;
}

/* 中部工具按钮区可横向滚动；左侧信息区与右侧操作区固定不动 */
.tb-scroll {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
}

.tb-scroll::-webkit-scrollbar {
  height: 4px;
}

.tb-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.tb-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.toolbar > * {
  flex-shrink: 0;
}

.tb-left,
.tb-center,
.tb-actions,
.tb-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tb-left {
  padding-right: 8px;
  border-right: 1px solid var(--border);
}

.tb-center {
  gap: 2px;
  flex-shrink: 0;
}

.tb-actions {
  padding-left: 8px;
  margin-left: 4px;
  border-left: 1px solid var(--border);
}

.tb-right {
  gap: 4px;
}

.tool-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tool-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.record-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.record-hint {
  font-size: 12px;
  color: var(--text-3);
}

.record-hint.recording {
  color: var(--accent);
  font-weight: 500;
}

.record-list {
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  font-size: 12px;
  border-radius: 4px;
}

.record-item:nth-child(even) {
  background: var(--hover);
}

.record-index {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent);
  color: var(--el-color-white);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.record-tag {
  color: var(--text-1);
  font-weight: 500;
  flex-shrink: 0;
}

.record-selector {
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.record-text {
  color: var(--text-3);
  flex-shrink: 0;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.designer-body {
  flex: 1;
  display: flex;
  gap: 2px;
  padding: 0 8px 8px;
  min-height: 0;
}

/* 左侧：上排（指令 + 流程）与底部日志卡 */
.left-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
}

.top-row {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 2px;
}

/* 流程卡片：标签栏 + 步骤列表 */
.flow-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border-radius: var(--radius);
  overflow: hidden;
}

.flow-tabbar {
  height: 36px;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 6px 10px 0;
  background: color-mix(in srgb, var(--panel) 55%, var(--bg));
  flex-shrink: 0;
}

.flow-tab {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 14px;
  font-size: 13px;
  color: var(--text-2);
  border-radius: 8px 8px 0 0;
  background: transparent;
}

.flow-tab.active {
  color: var(--text);
  font-weight: 500;
  background: var(--bg);
}

.tab-add {
  width: 22px;
  height: 22px;
  margin-bottom: 4px;
  border: none;
  background: transparent;
  border-radius: 50%;
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-add:hover {
  background: var(--hover);
  color: var(--text);
}

.center-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.center-main > :first-child {
  flex: 1;
  min-width: 0;
}

.sub {
  font-size: 12px;
  color: var(--text-3);
  margin: 0 0 8px;
}

.export-brief {
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--border);
}

.export-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-1);
  margin-bottom: 8px;
  word-break: break-all;
}

.export-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}

.issue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
}

.debug-bar {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  background: var(--el-color-warning-light-9);
  border-bottom: 1px solid var(--el-color-warning-light-7);
  flex-shrink: 0;
}

.dbg-step {
  font-size: 13px;
  color: var(--el-color-warning-dark-2);
  white-space: nowrap;
}

.dbg-name {
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.check-ok {
  font-size: 12px;
  color: var(--el-color-success);
}
</style>
