<script setup lang="ts">
/**
 * 变量输入框：普通文本与 {{变量}} 混排，并通过 fx 按钮从变量表中选取变量。
 * 说明：Element Plus 的 input 无法内联渲染 chip，因此用一层「高亮浮层」叠加在真实输入框之上，
 * 只在失焦状态下显示高亮，聚焦时显示为纯文本编辑，保证编辑体验不变。
 */
import { computed, nextTick, ref } from 'vue'
import { useAppStore } from '../store'
import { insertRef, kindColor, splitRefs } from '../vars'
import VariablePicker from './VariablePicker.vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  type?: 'text' | 'textarea'
  rows?: number
  disabled?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const store = useAppStore()
const focused = ref(false)
const pickerVisible = ref(false)
const inputRef = ref<{ input?: HTMLInputElement; textarea?: HTMLTextAreaElement; focus: () => void } | null>(
  null,
)

const text = computed(() => String(props.modelValue ?? ''))

interface Chip {
  text: string
  ref?: string
  /** 变量类型对应颜色，未声明时为空串 */
  color: string
  missing: boolean
}

const chips = computed<Chip[]>(() =>
  splitRefs(text.value).map((seg) => {
    if (!seg.ref) return { text: seg.text, color: '', missing: false }
    const decl = store.globalVars.find((v) => v.name === seg.ref)
    return {
      text: seg.text,
      ref: seg.ref,
      color: decl ? kindColor(decl.kind) : '',
      missing: !decl,
    }
  }),
)

const hasRefs = computed(() => chips.value.some((c) => c.ref))

/**
 * 用 update:modelValue 而不是 @input：
 * Element Plus 的 ElInput 把原生 input 事件内部消化后转发，模板里监听 @input 并不可靠，
 * 而 update:modelValue 是稳定的 v-model 契约。
 */
function onModelChange(value: string) {
  emit('update:modelValue', value)
}

/** 当前光标位置（仅在输入框聚焦时有效），用于 fx 插入变量 */
function currentCaret(): number | null {
  const el = inputRef.value?.input ?? inputRef.value?.textarea
  if (!el || document.activeElement !== el) return null
  return el.selectionStart
}

function onPick(name: string) {
  const res = insertRef(text.value, name, currentCaret())
  emit('update:modelValue', res.text)
  pickerVisible.value = false
  void nextTick(() => {
    const el = inputRef.value?.input ?? inputRef.value?.textarea
    if (!el) return
    inputRef.value?.focus()
    el.setSelectionRange(res.caret, res.caret)
  })
}
</script>

<template>
  <div
    class="var-input"
    :class="{
      'is-textarea': type === 'textarea',
      'is-focused': focused,
      'is-mirrored': !focused && hasRefs,
    }"
  >
    <!-- 失焦态：渲染带 chip 的高亮文本，覆盖在输入框上（仅有变量引用时） -->
    <div v-if="!focused && hasRefs" class="vi-mirror">
      <template v-for="(c, i) in chips" :key="i">
        <span
          v-if="c.ref"
          class="var-chip"
          :class="{ 'is-missing': c.missing }"
          :style="c.color ? { color: c.color, borderColor: c.color } : undefined"
        >
          {{ c.text }}
        </span>
        <template v-else>{{ c.text }}</template>
      </template>
    </div>

    <el-input
      ref="inputRef"
      :model-value="text"
      :placeholder="placeholder"
      :type="type === 'textarea' ? 'textarea' : 'text'"
      :rows="rows ?? 3"
      :disabled="disabled"
      @update:model-value="onModelChange"
      @focus="focused = true"
      @blur="focused = false"
    />

    <el-popover
      v-model:visible="pickerVisible"
      :width="236"
      trigger="click"
      placement="bottom-end"
      :fallback-placements="['top-end', 'bottom-start', 'top-start']"
      :teleported="true"
      popper-class="var-picker-popper"
    >
      <template #reference>
        <button
          class="vi-fx"
          :disabled="disabled"
          :title="pickerVisible ? '收起变量' : '选择变量'"
          @mousedown.prevent
        >
          fx
        </button>
      </template>
      <VariablePicker @pick="onPick" />
    </el-popover>
  </div>
</template>

<style scoped>
.var-input {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
}

.var-input :deep(.el-input),
.var-input :deep(.el-textarea) {
  flex: 1;
  min-width: 0;
}

/* 为右侧 fx 按钮预留位置，避免文字被遮挡 */
.var-input :deep(.el-input__inner),
.var-input :deep(.el-textarea__inner) {
  padding-right: 30px;
}

/* 有变量引用且未聚焦时，真实文本透明，由浮层负责渲染 chip */
.var-input.is-mirrored :deep(.el-input__inner),
.var-input.is-mirrored :deep(.el-textarea__inner) {
  color: transparent;
}

.vi-mirror {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  overflow: hidden;
  padding: 0 30px 0 11px;
  font-size: 13px;
  line-height: 20px;
  color: var(--text);
  pointer-events: none;
  white-space: pre;
}

.var-input.is-textarea .vi-mirror {
  align-items: flex-start;
  padding-top: 6px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.vi-fx {
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
  font-weight: 500;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.var-input.is-textarea .vi-fx {
  top: 6px;
  transform: none;
}

.vi-fx:hover {
  background: var(--var-bg);
  color: var(--var-fg);
}
</style>
