<script setup lang="ts">
/**
 * 变量选择器：输入框右侧 fx 按钮的弹出层。
 * 列出变量表中的全部变量（含元素变量），点击即把 {{变量名}} 插入到目标输入框光标处。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import { kindColor, kindLabel, type VarKind } from '../vars'
import { t } from '../i18n'

const props = defineProps<{
  /** 当前输入中已引用的变量（用于说明不会重复插入） */
  context?: string
  /** 只允许选择这些类型（不传表示全部） */
  only?: VarKind[]
}>()

const emit = defineEmits<{ (e: 'pick', name: string): void }>()

const store = useAppStore()
const keyword = ref('')
const searchRef = ref<{ focus: () => void } | null>(null)

const all = computed(() => {
  const list = props.only?.length
    ? store.globalVars.filter((v) => props.only?.includes(v.kind))
    : store.globalVars
  return list
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return all.value
  return all.value.filter(
    (v) => v.name.toLowerCase().includes(kw) || kindLabel(v.kind).includes(kw),
  )
})

/** 运行期有值但未声明的变量（例如子流程写入的结果）也允许选择 */
const runtimeOnly = computed(() => {
  const declared = new Set(store.globalVars.map((v) => v.name))
  const kw = keyword.value.trim().toLowerCase()
  return Object.keys(store.vars)
    .filter((k) => !declared.has(k))
    .filter((k) => (kw ? k.toLowerCase().includes(kw) : true))
    .slice(0, 20)
})

function pick(name: string) {
  emit('pick', name)
}

function focusSearch() {
  void nextTick(() => searchRef.value?.focus())
}

watch(() => props.context, focusSearch, { immediate: true })
defineExpose({ focusSearch })
</script>

<template>
  <div class="var-picker">
    <div class="vp-search">
      <el-input ref="searchRef" v-model="keyword" :placeholder="t('designer.searchVars')" clearable>
        <template #prefix>
          <el-icon :size="12"><Search /></el-icon>
        </template>
      </el-input>
    </div>
    <div class="vp-list">
      <button
        v-for="v in filtered"
        :key="v.name"
        class="vp-item"
        :title="`${t('designer.insertRef')}{{${v.name}}}`"
        @click="pick(v.name)"
      >
        <span class="vp-dot" :style="{ background: kindColor(v.kind) }"></span>
        <span class="vp-name">{{ v.name }}</span>
        <span class="vp-kind">{{ kindLabel(v.kind) }}</span>
      </button>

      <template v-if="runtimeOnly.length">
        <div class="vp-group">{{ t('designer.runtimeVars') }}</div>
        <button v-for="name in runtimeOnly" :key="name" class="vp-item" @click="pick(name)">
          <span class="vp-dot" :style="{ background: 'var(--text-3)' }"></span>
          <span class="vp-name">{{ name }}</span>
          <span class="vp-kind">{{ store.vars[name] ? t('designer.hasValue') : t('designer.emptyValue') }}</span>
        </button>
      </template>

      <el-empty
        v-if="!filtered.length && !runtimeOnly.length"
        :image-size="72"
        :description="t('designer.noVars')"
      />
    </div>
  </div>
</template>

<style scoped>
.var-picker {
  width: 100%;
  display: flex;
  flex-direction: column;
  max-height: 280px;
}

.vp-search {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}

.vp-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
}

.vp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  text-align: left;
  color: var(--text);
  font-size: 12px;
}

.vp-item:hover {
  background: var(--hover);
}

.vp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.vp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--mono, ui-monospace, SFMono-Regular, Consolas, monospace);
}

.vp-kind {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-3);
}

.vp-group {
  padding: 8px 8px 4px;
  font-size: 11px;
  color: var(--text-3);
}
</style>
