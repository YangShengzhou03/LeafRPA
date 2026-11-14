<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ modelValue: string; label?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const areaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)

const lines = computed(() => {
  const count = props.modelValue.split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1)
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

function syncGutter() {
  if (areaRef.value && gutterRef.value) {
    gutterRef.value.scrollTop = areaRef.value.scrollTop
  }
}

function onKeydown(e: KeyboardEvent) {
  // Tab 插入两个空格而不是切换焦点
  if (e.key === 'Tab' && areaRef.value) {
    e.preventDefault()
    const el = areaRef.value
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = props.modelValue.slice(0, start) + '    ' + props.modelValue.slice(end)
    emit('update:modelValue', next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 4
    })
  }
}

watch(
  () => props.modelValue,
  () => syncGutter(),
)
</script>

<template>
  <div class="code-editor">
    <div ref="gutterRef" class="gutter">{{ lines.join('\n') }}</div>
    <textarea
      ref="areaRef"
      class="code-area"
      :value="modelValue"
      spellcheck="false"
      wrap="off"
      @input="onInput"
      @scroll="syncGutter"
      @keydown="onKeydown"
    ></textarea>
  </div>
</template>

<style scoped>
.code-editor {
  display: flex;
  height: 160px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--panel);
}
.gutter {
  flex: 0 0 36px;
  padding: 8px;
  text-align: right;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
  background: var(--bg);
  border-right: 1px solid var(--border);
  overflow: hidden;
  user-select: none;
  white-space: pre;
}
.code-area {
  flex: 1;
  padding: 8px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
  background: transparent;
  white-space: pre;
  overflow: auto;
}
.code-area::placeholder {
  color: var(--text-3);
}
</style>
