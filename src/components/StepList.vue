<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { MoreFilled, Plus, Search, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { COMMANDS, commandByType } from '../commands'
import { useAppStore } from '../store'
import { kindColor, splitRefs } from '../vars'
import CommandDialog from './CommandDialog.vue'
import type { CommandDefinition, FlowNode } from '../types'

const store = useAppStore()

const nodes = computed<FlowNode[]>(() => store.current?.nodes ?? [])

/* ---------- 在此行后插入 ---------- */
const insertVisible = ref(false)
const insertTarget = ref<FlowNode | null>(null)
const insertKeyword = ref('')

const insertResults = computed<CommandDefinition[]>(() => {
  const kw = insertKeyword.value.trim().toLowerCase()
  if (!kw) return COMMANDS
  return COMMANDS.filter(
    (c) => c.name.toLowerCase().includes(kw) || c.description.toLowerCase().includes(kw),
  )
})

function openInsert(node: FlowNode) {
  insertTarget.value = node
  insertKeyword.value = ''
  insertVisible.value = true
}

function pickInsert(cmd: CommandDefinition) {
  const target = insertTarget.value
  if (!target) return
  store.insertNodeAfter(target.id, cmd.type)
  insertVisible.value = false
}

function iconChar(node: FlowNode): string {
  return (commandByType(node.type)?.name ?? node.name).charAt(0)
}

function iconColor(node: FlowNode): string {
  return commandByType(node.type)?.color ?? '#64748b'
}

/* ---------- 参数摘要（含变量引用 chip 高亮） ---------- */
function summarySegments(node: FlowNode) {
  const props = node.props ?? {}
  const def = commandByType(node.type)
  const parts: string[] = []
  if (def) {
    for (const p of def.params) {
      const v = props[p.key]
      if (v === '' || v === undefined || v === null) continue
      if (typeof v === 'boolean') {
        if (v) parts.push(p.label)
      } else {
        parts.push(`${p.label}：${String(v)}`)
      }
      if (parts.length >= 3) break
    }
  }
  const summary = parts.join(' · ') || '未配置参数，单击该行进行编辑'
  return splitRefs(summary).map((seg) => ({
    text: seg.text,
    ref: seg.ref,
    color: seg.ref ? kindColor(store.globalVars.find((v) => v.name === seg.ref)?.kind ?? 'text') : '',
    missing: seg.ref ? !store.globalVars.some((v) => v.name === seg.ref) : false,
  }))
}

/* ---------- 拖拽排序 ---------- */
const dragId = ref<string | null>(null)
/** 当前悬停的目标行 */
const overId = ref<string | null>(null)
/** 悬停时指针是否落在目标行的下半部分（决定插到其后） */
const overAfter = ref(false)

function onDragStart(e: DragEvent, node: FlowNode) {
  dragId.value = node.id
  // Firefox 要求必须 setData 才会启动拖拽
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
  }
}

function onDragOver(e: DragEvent, node: FlowNode) {
  if (!dragId.value) return
  if (dragId.value === node.id) {
    overId.value = null
    return
  }
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  overId.value = node.id
  overAfter.value = e.clientY > rect.top + rect.height / 2
}

function onDrop(e: DragEvent, node: FlowNode) {
  e.preventDefault()
  if (dragId.value && dragId.value !== node.id) {
    store.reorderNode(dragId.value, node.id, overAfter.value)
  }
  onDragEnd()
}

function onDragEnd() {
  dragId.value = null
  overId.value = null
  overAfter.value = false
}

/* ---------- 行内菜单 ---------- */
async function onRowMenu(cmd: string, node: FlowNode) {
  if (cmd === 'toggle') store.toggleNodeDisabled(node.id)
  else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除指令「${node.name}」？`, '删除指令', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
    store.removeNode(node.id)
  }
}

/* 点击空白处取消选中：属性面板彻底折叠 */
function onCanvasMouseDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.step-row')) return
  store.selectNode(null)
}

/* ---------- 属性抽屉（单击右侧展开） ---------- */
const editorVisible = ref(false)
const editorNode = ref<FlowNode | null>(null)

function openEditor(node: FlowNode) {
  editorNode.value = node
  editorVisible.value = true
  if (store.selectedNodeId !== node.id) store.selectNode(node.id)
}
</script>

<template>
  <div class="step-list" @mousedown="onCanvasMouseDown">
    <div v-if="nodes.length === 0" class="step-empty">
      <el-empty description="还没有任何步骤" :image-size="96">
        <div class="empty-desc">
          点击左侧指令面板中的指令即可添加第一个步骤；<br />
          添加后可拖拽行调整执行顺序，点击行查看与编辑属性。
        </div>
      </el-empty>
    </div>
    <template v-else>
      <div class="guide-line"></div>
      <div
        v-for="(node, i) in nodes"
        :key="node.id"
        class="step-row"
        :class="{
          selected: store.selectedNodeId === node.id,
          disabled: node.disabled,
          'drag-over': overId === node.id,
          'drag-over-after': overId === node.id && overAfter,
          'drag-over-before': overId === node.id && !overAfter,
          dragging: dragId === node.id,
        }"
        draggable="true"
        role="button"
        tabindex="0"
        title="点击编辑指令参数，拖拽可调整顺序"
        @click="openEditor(node)"
        @keydown.enter="openEditor(node)"
        @keydown.space.prevent="openEditor(node)"
        @dragstart="onDragStart($event, node)"
        @dragover="onDragOver($event, node)"
        @drop="onDrop($event, node)"
        @dragend="onDragEnd"
      >
        <div class="gutter">
          <span v-if="node.breakpoint" class="bp-dot" title="断点"></span>
          <span class="line-no">{{ i + 1 }}</span>
        </div>

        <div class="step-main">
          <div class="step-title">
            <span class="cmd-icon" :style="{ background: iconColor(node) }">{{ iconChar(node) }}</span>
            <span class="step-name">{{ node.name }}</span>
            <span v-if="node.disabled" class="disabled-tag" title="运行与调试时会跳过该步骤">已注释</span>
          </div>
          <div class="step-summary">
            <template v-for="(seg, si) in summarySegments(node)" :key="si">
              <span
                v-if="seg.ref"
                class="var-chip"
                :class="{ 'is-missing': seg.missing }"
                :style="seg.color ? { color: seg.color, borderColor: seg.color } : undefined"
              >
                {{ seg.text }}
              </span>
              <template v-else>{{ seg.text }}</template>
            </template>
          </div>
        </div>

        <div class="step-actions" @click.stop>
          <el-tooltip content="在此行后插入" placement="top" :show-after="300">
            <button class="act" @click="openInsert(node)">
              <el-icon :size="13"><Plus /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip
            :content="node.breakpoint ? '移除断点' : '设置断点'"
            placement="top"
            :show-after="300"
          >
            <button
              class="act"
              :class="{ 'bp-on': node.breakpoint }"
              @click="store.toggleNodeBreakpoint(node.id)"
            >
              <el-icon :size="13">
                <VideoPause v-if="node.breakpoint" />
                <VideoPlay v-else />
              </el-icon>
            </button>
          </el-tooltip>
          <el-dropdown trigger="click" @command="(cmd: string) => onRowMenu(cmd, node)">
            <button class="act" title="更多操作">
              <el-icon :size="13"><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="toggle">{{ node.disabled ? '取消注释' : '注释' }}</el-dropdown-item>
                <el-dropdown-item command="delete">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </template>

    <el-dialog v-model="insertVisible" title="在此行后插入指令" width="440px" append-to-body>
      <el-input
        v-model="insertKeyword"
        placeholder="搜索指令"
        clearable
        :prefix-icon="Search"
        style="margin-bottom: 12px"
      />
      <div class="insert-list">
        <el-tooltip
          v-for="cmd in insertResults"
          :key="cmd.type"
          :content="cmd.description"
          placement="top"
          :show-after="300"
        >
          <button class="insert-item" @click="pickInsert(cmd)">
            <span class="dot" :style="{ background: cmd.color }"></span>
            <span class="label">{{ cmd.name }}</span>
            <span class="desc">{{ cmd.description }}</span>
          </button>
        </el-tooltip>
      </div>
    </el-dialog>

    <CommandDialog v-model:visible="editorVisible" :node="editorNode" />
  </div>
</template>

<style scoped>
.step-list {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow-y: auto;
  background: var(--bg);
  padding: 8px 0 24px;
}

.step-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
}

.empty-desc {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.8;
}

/* 左侧灰色细竖线（贯穿所有步骤行） */
.guide-line {
  position: absolute;
  left: 52px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
  pointer-events: none;
}

.step-row {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 5px 12px 5px 0;
  cursor: pointer;
  position: relative;
  user-select: none;
}

.step-row:hover {
  background: var(--panel);
}

.step-row.selected {
  background: var(--row-selected);
}

.step-row.dragging {
  opacity: 0.4;
}

/* 放置指示线：按指针位于行的上半/下半部分显示在行上方或下方 */
.step-row.drag-over-before::before,
.step-row.drag-over-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  z-index: 1;
}

.step-row.drag-over-before::before {
  top: -1px;
}

.step-row.drag-over-after::after {
  bottom: -1px;
}

.step-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* 行号列 */
.gutter {
  width: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 0 10px 0 12px;
}

.line-no {
  font-size: 12px;
  color: var(--text-3);
  text-align: left;
}

.bp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f53f3f;
  flex-shrink: 0;
}

.step-main {
  flex: 1;
  min-width: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.step-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cmd-icon {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-name {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.disabled-tag {
  font-size: 10px;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--text-3);
  flex-shrink: 0;
}

.step-summary {
  font-size: 12px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 禁用行整行灰显 */
.step-row.disabled .cmd-icon {
  background: var(--text-3) !important;
}

.step-row.disabled .step-name,
.step-row.disabled .step-summary {
  color: var(--text-3);
}

.step-row.disabled .step-main {
  opacity: 0.75;
}

/* 行尾 hover 操作 */
.step-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.step-row:hover .step-actions,
.step-row.selected .step-actions,
.step-row:focus-within .step-actions {
  opacity: 1;
}

.act {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.act:hover {
  background: var(--hover);
  color: var(--text);
}

.act.bp-on {
  color: #f53f3f;
}

.insert-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.insert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  text-align: left;
  color: var(--text);
}

.insert-item:hover {
  background: var(--accent-soft);
}

.insert-item .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.insert-item .label {
  flex-shrink: 0;
  font-size: 13px;
}

.insert-item .desc {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
