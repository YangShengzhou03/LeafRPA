<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { ArrowUp, Close, Delete, Minus, Plus } from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import { pickElement, runWebCommand } from '../web-executor'
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

/* ---------- 元素库：采集到的页面元素即「元素变量」（本地持久化） ---------- */
interface CapturedElement {
  id: string
  name: string
  selector: string
  createdAt: number
}

const ELEMENTS_KEY = 'leaf-rpa.elements.v1'

function loadElements(): CapturedElement[] {
  try {
    const raw = localStorage.getItem(ELEMENTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveElements() {
  try {
    localStorage.setItem(ELEMENTS_KEY, JSON.stringify(elements.value))
  } catch {
    /* 忽略本地存储失败 */
  }
}

const elements = ref<CapturedElement[]>(loadElements())
const captureVisible = ref(false)
const captureSelector = ref('')
const captureName = ref('')
const capturing = ref(false)
const capturing2 = ref(false)

/** 把元素库中的元素同步为元素变量，供 fx 变量选择器使用 */
function syncElementVars() {
  elements.value.forEach((el) => {
    store.upsertVar(el.name, 'element', { selector: el.selector })
  })
}

onMounted(syncElementVars)

function openCapture() {
  captureSelector.value = ''
  captureName.value = ''
  captureVisible.value = true
}

/** 到浏览器页面上点选元素，自动回填选择器与名称 */
async function pickFromPage() {
  if (capturing2.value) return
  capturing2.value = true
  try {
    const { selector, element } = await pickElement()
    captureSelector.value = selector
    if (!captureName.value.trim()) {
      captureName.value = element.text?.trim().slice(0, 20) || element.tagName
    }
  } catch (e) {
    toastError((e as Error).message, { title: '抓取失败' })
  } finally {
    capturing2.value = false
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
    await runWebCommand('get-element-web', { selector, variable: '__capturedElement' })
    const name = captureName.value.trim() || selector
    elements.value.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      selector,
      createdAt: Date.now(),
    })
    saveElements()
    store.upsertVar(name, 'element', { selector })
    captureVisible.value = false
    toastSuccess(`元素已存为元素变量 {{${name}}}`, { title: '采集成功', duration: 2200 })
  } catch (e) {
    toastError((e as Error).message, { title: '采集失败' })
  } finally {
    capturing.value = false
  }
}

function removeElement(id: string) {
  const target = elements.value.find((el) => el.id === id)
  elements.value = elements.value.filter((el) => el.id !== id)
  saveElements()
  if (target) store.removeGlobalVar(target.name)
}

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
        <el-button v-if="active === 'elements'" class="head-btn" @click="openCapture">
          <el-icon :size="12"><Plus /></el-icon>
          添加新元素
        </el-button>
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
              <el-button :loading="capturing2" @click="pickFromPage">抓取</el-button>
            </div>
          </div>
          <div class="cap-field">
            <label>元素变量名</label>
            <el-input
              v-model="captureName"
              placeholder="留空则使用选择器作为变量名"
              clearable
              @keyup.enter="captureElement"
            />
          </div>
          <p class="capture-tip">
            保存前会在浏览器中校验元素是否存在，需要已安装并连接轻羽浏览器插件；保存后可在任意输入框的 fx 中选择该元素变量。
          </p>
          <div class="cap-actions">
            <el-button @click="captureVisible = false">取消</el-button>
            <el-button type="primary" :loading="capturing" @click="captureElement">
              校验并保存
            </el-button>
          </div>
        </div>
        <div v-else-if="elements.length === 0" class="ele-empty">
          <el-empty description="暂无元素，可通过「添加新元素」采集页面元素" :image-size="70" />
        </div>
        <div v-else class="ele-list">
          <div v-for="el in elements" :key="el.id" class="ele-row">
            <span class="ele-name" :title="el.name">{{ el.name }}</span>
            <span class="ele-sel" :title="el.selector">{{ el.selector }}</span>
            <el-tooltip content="删除" placement="top" :show-after="300">
              <button class="ele-del" @click="removeElement(el.id)">
                <el-icon :size="12"><Delete /></el-icon>
              </button>
            </el-tooltip>
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

.ele-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ele-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px;
}

.ele-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
}

.ele-row:hover {
  background: var(--panel);
}

.ele-name {
  font-size: 13px;
  color: var(--text);
  flex-shrink: 0;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ele-sel {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ele-del {
  position: relative;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  flex-shrink: 0;
}

/* 命中区向四周扩 5px */
.ele-del::after {
  content: '';
  position: absolute;
  inset: -5px;
}

.ele-row:hover .ele-del,
.ele-row:focus-within .ele-del {
  opacity: 1;
}

.ele-del:hover {
  color: var(--el-color-danger);
  background: var(--hover);
}

.ele-capture {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
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
