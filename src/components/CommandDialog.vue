<script setup lang="ts">
/**
 * 指令编辑弹窗：设计器内所有指令参数的统一编辑入口。
 * 布局参考通用 RPA 设计器：图标+标题+描述头部、常规/错误处理页签、
 * 指令输入/指令输出分区、每个输入框右侧 fx 变量选择、底部运行/确定/取消。
 */
import { computed, reactive, ref, watch } from 'vue'
import { InfoFilled, Loading, VideoPlay } from '@element-plus/icons-vue'
import { commandByType } from '../commands'
import { useAppStore } from '../store'
import type { CommandParam, FlowNode } from '../types'
import { declaresElement, declareKind, isDeclareKey, refsIn } from '../vars'
import { pickElement } from '../web-executor'
import CodeEditor from './CodeEditor.vue'
import VariableInput from './VariableInput.vue'

const props = defineProps<{ node: FlowNode | null }>()
const visible = defineModel<boolean>('visible', { default: false })

const store = useAppStore()

const def = computed(() => (props.node ? (commandByType(props.node.type) ?? null) : null))
const activeTab = ref<'general' | 'error'>('general')

/** 本地草稿：确定后才写回 store，取消即丢弃 */
const draft = reactive<Record<string, unknown>>({})

const inputParams = computed<CommandParam[]>(
  () => def.value?.params.filter((p) => !isDeclareKey(props.node?.type ?? '', p.key)) ?? [],
)
const outputParams = computed<CommandParam[]>(
  () => def.value?.params.filter((p) => isDeclareKey(props.node?.type ?? '', p.key)) ?? [],
)

watch(
  () => [props.node?.id, visible.value] as const,
  ([, open]) => {
    if (!open || !props.node) return
    activeTab.value = 'general'
    pickError.value = ''
    Object.keys(draft).forEach((k) => delete draft[k])
    Object.entries(props.node.props ?? {}).forEach(([k, v]) => {
      draft[k] = v
    })
  },
  { immediate: true },
)

const cmdIcon = computed(() => (def.value?.name ?? '指').charAt(0))
const cmdColor = computed(() => def.value?.color ?? 'var(--accent)')

function close() {
  visible.value = false
}

function confirm() {
  const node = props.node
  if (!node) return
  Object.entries(draft).forEach(([k, v]) => store.updateNodeProp(k, v, node.id))
  // 声明类参数写入后，立即把变量登记到变量表；元素结果同时记下选择器
  outputParams.value.forEach((p) => {
    const name = String(draft[p.key] ?? '').trim()
    if (!name || refsIn(name).length) return
    const kind = declareKind(node.type, p.key)
    const selector =
      kind === 'element'
        ? String(draft.selector ?? node.props.selector ?? '').trim() || undefined
        : undefined
    store.upsertVar(name, kind, selector ? { selector } : undefined)
  })
  close()
}

/* ---------- 元素抓取 ---------- */
const pickToken = reactive<Record<string, { cancelled: boolean }>>({})
const pickError = ref('')

const isSelectorParam = (p: CommandParam) =>
  p.type === 'string' && p.key.toLowerCase().includes('selector')

async function startPick(key: string) {
  if (pickToken[key]) {
    pickToken[key].cancelled = true
    delete pickToken[key]
    return
  }
  const token = { cancelled: false }
  pickToken[key] = token
  pickError.value = ''
  try {
    const { selector, element } = await pickElement(token)
    draft[key] = selector
    store.log('success', `已抓取元素 <${element.tagName}>${element.id ? '#' + element.id : ''}：${selector}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!token.cancelled) {
      pickError.value = msg
      store.log('error', `元素抓取失败：${msg}`)
    }
  } finally {
    delete pickToken[key]
  }
}

/* ---------- 运行单条指令 ---------- */
const running = ref(false)

async function runOnce() {
  const node = props.node
  if (!node || running.value) return
  // 先把草稿写回，保证运行的是界面上看到的值
  Object.entries(draft).forEach(([k, v]) => store.updateNodeProp(k, v, node.id))
  running.value = true
  try {
    await store.runNode(node)
  } finally {
    running.value = false
  }
}

/** 输出参数的提示文案：元素类结果变量额外说明 */
function outputHint(p: CommandParam): string {
  if (def.value && declaresElement(def.value.type, p.key)) {
    return '页面元素会存为元素变量，可用于后续的元素操作指令'
  }
  return '执行结果将保存到该变量'
}
</script>

<template>
  <el-drawer
    v-model="visible"
    size="460px"
    append-to-body
    :show-close="false"
    class="cmd-drawer"
    @closed="close"
  >
    <template #header>
      <div class="cd-head">
        <span
          class="cd-icon"
          :style="{ background: `color-mix(in srgb, ${cmdColor} 14%, var(--bg))`, color: cmdColor }"
        >
          {{ cmdIcon }}
        </span>
        <div class="cd-title-box">
          <div class="cd-title">{{ def?.name ?? '指令设置' }}</div>
          <div class="cd-desc">{{ def?.description ?? '设置该指令的参数' }}</div>
        </div>
      </div>
    </template>

    <el-tabs v-model="activeTab" class="cd-tabs">
      <el-tab-pane label="常规" name="general" />
      <el-tab-pane label="错误处理" name="error" />
    </el-tabs>

    <div class="cd-body">
      <template v-if="activeTab === 'general'">
        <section v-if="inputParams.length" class="cd-section">
          <div class="cd-section-title">指令输入</div>
          <div v-for="p in inputParams" :key="p.key" class="cd-row">
            <div class="cd-label">
              <span>{{ p.label }}</span>
              <el-tooltip :content="`参数键：${p.key}`" placement="top">
                <el-icon class="cd-info" :size="12"><InfoFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="cd-control">
              <el-select
                v-if="p.type === 'select'"
                :model-value="(draft[p.key] as string) ?? ''"
                @update:model-value="draft[p.key] = $event"
              >
                <el-option
                  v-for="opt in p.options ?? []"
                  :key="opt.value"
                  :value="opt.value"
                  :label="opt.label"
                />
              </el-select>

              <el-switch
                v-else-if="p.type === 'boolean'"
                :model-value="!!draft[p.key]"
                active-text="启用"
                @update:model-value="draft[p.key] = $event"
              />

              <el-input-number
                v-else-if="p.type === 'number'"
                :model-value="Number(draft[p.key] ?? 0)"
                :value-on-clear="0"
                class="cd-number"
                @update:model-value="draft[p.key] = $event"
              />

              <CodeEditor
                v-else-if="p.type === 'textarea' && p.key === 'code'"
                :model-value="(draft[p.key] as string) ?? ''"
                @update:model-value="draft[p.key] = $event"
              />

              <div v-else-if="isSelectorParam(p)" class="cd-selector">
                <VariableInput
                  v-model="draft[p.key] as string"
                  placeholder="点击「抓取」后在页面上点选元素"
                />
                <el-tooltip
                  :content="pickToken[p.key] ? '再次点击取消抓取' : '到浏览器页面上点选元素'"
                  placement="top"
                  :show-after="300"
                >
                  <el-button
                    type="primary"
                    :plain="!pickToken[p.key]"
                    size="small"
                    :class="{ picking: pickToken[p.key] }"
                    @click="startPick(p.key)"
                  >
                    {{ pickToken[p.key] ? '抓取中…' : '抓取' }}
                  </el-button>
                </el-tooltip>
              </div>

              <VariableInput
                v-else
                v-model="draft[p.key] as string"
                :type="p.type === 'textarea' ? 'textarea' : 'text'"
                :rows="3"
                :placeholder="`请输入${p.label}`"
              />
            </div>
          </div>
          <div v-if="pickError" class="cd-pick-error">{{ pickError }}</div>
        </section>

        <section v-if="outputParams.length" class="cd-section">
          <div class="cd-section-title">指令输出</div>
          <div v-for="p in outputParams" :key="p.key" class="cd-row">
            <div class="cd-label">
              <span>{{ p.label }}</span>
              <el-tooltip :content="outputHint(p)" placement="top">
                <el-icon class="cd-info" :size="12"><InfoFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="cd-control">
              <VariableInput v-model="draft[p.key] as string" :placeholder="`变量名，如 ${p.value}`" />
            </div>
          </div>
        </section>
      </template>

      <section v-else class="cd-section">
        <div class="cd-section-title">错误处理</div>
        <div class="cd-row">
          <div class="cd-label"><span>失败后</span></div>
          <div class="cd-control">
            <el-select model-value="stop">
              <el-option label="终止流程并记录错误" value="stop" />
              <el-option label="继续执行后续指令" value="continue" disabled />
            </el-select>
          </div>
        </div>
        <div class="cd-hint">当前版本指令失败会终止流程，并在「错误列表」中记录原因。</div>
      </section>
    </div>

    <template #footer>
      <div class="cd-footer">
        <el-button class="cd-run" :loading="running" @click="runOnce">
          <el-icon v-if="!running" :size="12"><VideoPlay /></el-icon>
          <el-icon v-else :size="12"><Loading /></el-icon>
          运行指令
        </el-button>
        <div class="cd-spacer"></div>
        <el-button type="primary" @click="confirm">确定</el-button>
        <el-button @click="close">取消</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.cd-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-right: 18px;
}

.cd-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cd-title-box {
  flex: 1;
  min-width: 0;
}

.cd-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  line-height: 20px;
}

.cd-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.cd-tabs {
  padding: 0 20px;
}

.cd-body {
  padding: 4px 20px 8px;
}

.cd-section {
  padding-top: 12px;
}

.cd-section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  margin-bottom: 8px;
}

.cd-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 5px 0;
}

.cd-label {
  width: 116px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 6px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 20px;
}

.cd-info {
  color: var(--text-3);
  flex-shrink: 0;
}

.cd-control {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cd-control :deep(.el-select),
.cd-control :deep(.el-input-number) {
  width: 100%;
}

/* 代码编辑器在弹窗里需要撑满整行 */
.cd-control :deep(.code-editor) {
  flex: 1;
  width: 100%;
}

.cd-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.cd-number {
  width: 100%;
}

.cd-pick-error {
  margin: 2px 0 0 128px;
  font-size: 11px;
  color: var(--el-color-danger, #f53f3f);
  word-break: break-all;
}

.cd-hint {
  padding: 2px 0 0 128px;
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.6;
}

.cd-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cd-spacer {
  flex: 1;
}

.cd-run {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.el-button.picking {
  color: var(--el-color-danger);
  border-color: var(--el-color-danger);
  animation: pick-pulse 1.2s ease-in-out infinite;
}

@keyframes pick-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>

<style>
/* 属性抽屉：右侧展开，头部/主体留白统一，头部下边框由页签承载 */
.cmd-drawer .el-drawer__header {
  margin-bottom: 0;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border);
}

.cmd-drawer .el-drawer__body {
  padding: 0;
  overflow-y: auto;
}

.cmd-drawer .el-drawer__footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
}
</style>
