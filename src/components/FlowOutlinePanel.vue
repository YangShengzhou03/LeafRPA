<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Delete, Fold, MoreFilled, Plus, Search } from '@element-plus/icons-vue'
import { commandByType } from '../commands'
import { useAppStore } from '../store'
import { toastWarning } from '../notify'
import { VAR_KINDS, kindColor, kindLabel, type VarKind } from '../vars'
import { t } from '../i18n'

const store = useAppStore()
const activeLeaf = ref('main')
const refsOpen = ref(true)

/* ---------- 流程树搜索 / 展开 ---------- */
const searchVisible = ref(false)
const keyword = ref('')
const flowExpanded = ref(true)

const nodes = computed(() => store.current?.nodes ?? [])

/** 当前流程引用的子流程节点（type === instruction） */
const instructionNodes = computed(() => nodes.value.filter((n) => n.type === 'instruction'))

const visibleNodes = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return nodes.value
  return nodes.value.filter(
    (n) =>
      n.name.toLowerCase().includes(kw) ||
      (commandByType(n.type)?.description ?? '').toLowerCase().includes(kw),
  )
})

function nodeColor(id: string) {
  const node = nodes.value.find((n) => n.id === id)
  if (!node) return 'var(--text-3)'
  return commandByType(node.type)?.color ?? '#8b5cf6'
}

function selectNode(id: string) {
  store.selectNode(id)
}

/* ---------- 全局变量 ---------- */
const varFormOpen = ref(false)
const varName = ref('')
const varType = ref<VarKind>('text')

function openVarForm() {
  varName.value = ''
  varType.value = 'text'
  varFormOpen.value = true
}

function confirmVar() {
  const name = varName.value.trim()
  if (!name) {
    toastWarning(t('designer.varNameRequired'), { title: t('common.nameEmpty') })
    return
  }
  if (store.globalVars.some((v) => v.name === name)) {
    toastWarning(t('designer.varExists', { name }), { title: t('designer.nameDup') })
    return
  }
  store.upsertVar(name, varType.value)
  varFormOpen.value = false
}

async function clearVars() {
  if (store.globalVars.length === 0) return
  try {
    await ElMessageBox.confirm(
      t('designer.clearVarsConfirm', { n: store.globalVars.length }),
      t('designer.clearVars'),
      {
        type: 'warning',
        confirmButtonText: t('designer.clear'),
        cancelButtonText: t('common.cancel'),
      },
    )
  } catch {
    return
  }
  ;[...store.globalVars].forEach((v) => store.removeGlobalVar(v.name))
}
</script>

<template>
  <aside class="outline">
    <div class="outline-block">
      <div class="outline-title-row">
        <div class="outline-title">{{ t('designer.flow') }}</div>
        <div class="title-actions">
          <el-tooltip
            :content="searchVisible ? t('designer.closeSearch') : t('designer.searchNode')"
            placement="bottom"
            :show-after="300"
          >
            <button
              class="t-act"
              :class="{ on: searchVisible }"
              @click="searchVisible = !searchVisible; keyword = ''"
            >
              <el-icon :size="13"><Search /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip :content="flowExpanded ? t('designer.collapse') : t('designer.expand')" placement="bottom" :show-after="300">
            <button class="t-act" @click="flowExpanded = !flowExpanded">
              <el-icon :size="13"><Fold /></el-icon>
            </button>
          </el-tooltip>
          <el-dropdown trigger="click">
            <button class="t-act" :title="t('common.more')">
              <el-icon :size="13"><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="flowExpanded = true">{{ t('designer.expandAll') }}</el-dropdown-item>
                <el-dropdown-item @click="flowExpanded = false">{{ t('designer.collapseAll') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div v-show="searchVisible" class="tree-search">
        <el-input
          v-model="keyword"
          :placeholder="t('designer.searchNodePlaceholder')"
          clearable
          :prefix-icon="Search"
        />
      </div>

      <div v-show="flowExpanded" class="tree">
        <div class="tree-root" :title="store.current?.name">
          <span class="plus">+</span>
          <span class="root-name">{{ store.current?.name ?? t('designer.app') }}</span>
        </div>
        <div class="tree-children">
          <div class="tree-refs" :class="{ open: refsOpen }">
            <button class="tree-refs-title" @click="refsOpen = !refsOpen">
              <span class="tree-arrow">▸</span>
              <span>{{ t('designer.refs') }}</span>
              <span class="tree-refs-count">{{ instructionNodes.length }}</span>
            </button>
            <div v-show="refsOpen" class="tree-refs-list">
              <div v-if="instructionNodes.length === 0" class="tree-refs-empty">{{ t('designer.noRefs') }}</div>
              <div
                v-for="n in instructionNodes"
                :key="n.id"
                class="tree-leaf"
                :class="{ active: store.selectedNodeId === n.id }"
                role="button"
                tabindex="0"
                :title="String(n.props.name ?? n.name)"
                @click="selectNode(n.id)"
                @keydown.enter="selectNode(n.id)"
              >
                <span class="ref-dot"></span>
                <span class="ref-name">{{ n.props.name || n.name }}</span>
              </div>
            </div>
          </div>
          <div
            class="tree-leaf"
            :class="{ active: activeLeaf === 'main' }"
            role="button"
            tabindex="0"
            @click="activeLeaf = 'main'"
            @keydown.enter="activeLeaf = 'main'"
          >
            {{ t('designer.mainFlow') }}
          </div>
        </div>

        <el-empty
          v-if="visibleNodes.length === 0"
          :image-size="72"
          :description="keyword ? t('designer.noMatchNode') : t('designer.noNodes')"
        />
        <button
          v-for="(node, i) in visibleNodes"
          v-else
          :key="node.id"
          class="node-row"
          :class="{ active: store.selectedNodeId === node.id, disabled: node.disabled }"
          @click="selectNode(node.id)"
        >
          <span class="node-idx">{{ i + 1 }}</span>
          <span class="node-dot" :style="{ background: nodeColor(node.id) }"></span>
          <span class="node-name" :title="node.name">{{ node.name }}</span>
          <span v-if="node.breakpoint" class="node-bp">{{ t('designer.breakpoint') }}</span>
        </button>
      </div>
    </div>

    <div class="outline-block">
      <div class="outline-title-row">
        <div class="outline-title">{{ t('designer.globalVars') }}</div>
        <div class="title-actions">
          <el-tooltip :content="t('designer.addVar')" placement="bottom" :show-after="300">
            <button class="t-act" @click="openVarForm">
              <el-icon :size="13"><Plus /></el-icon>
            </button>
          </el-tooltip>
          <el-dropdown trigger="click">
            <button class="t-act" :title="t('common.more')">
              <el-icon :size="13"><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openVarForm">{{ t('designer.addVar') }}</el-dropdown-item>
                <el-dropdown-item @click="clearVars">{{ t('designer.clearVars') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div v-if="varFormOpen" class="var-form">
        <el-input
          v-model="varName"
          :placeholder="t('designer.varNameLabel')"
          @keydown.enter="confirmVar"
        />
        <el-select v-model="varType">
          <el-option v-for="k in VAR_KINDS" :key="k.kind" :label="k.label" :value="k.kind" />
        </el-select>
        <div class="var-form-actions">
          <el-button @click="varFormOpen = false">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="confirmVar">{{ t('designer.add') }}</el-button>
        </div>
      </div>
      <div class="var-head">
        <span>{{ t('designer.colVarName') }}</span>
        <span>{{ t('designer.colType') }}</span>
      </div>
      <div v-for="v in store.globalVars" :key="v.name" class="var-row">
        <span class="var-dot" :style="{ background: kindColor(v.kind) }"></span>
        <span class="var-name" :title="v.name">{{ v.name }}</span>
        <span class="var-type">{{ kindLabel(v.kind) }}</span>
        <el-tooltip :content="t('common.delete')" placement="top" :show-after="300">
          <button class="var-del" @click="store.removeGlobalVar(v.name)">
            <el-icon :size="12"><Delete /></el-icon>
          </button>
        </el-tooltip>
      </div>
      <div v-if="store.globalVars.length === 0" class="var-empty-line"></div>
    </div>
  </aside>
</template>

<style scoped>
.outline {
  width: 308px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.outline-block {
  background: var(--bg);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 0;
  overflow: hidden;
}

.outline-block:first-child {
  flex: 0 1 auto;
  max-height: 55%;
}

.outline-block:last-child {
  flex: 1;
}

.outline-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 8px 16px;
  flex-shrink: 0;
}

.outline-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  flex: 1;
  min-width: 0;
}

.title-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.t-act {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.t-act:hover {
  background: var(--hover);
  color: var(--text);
}

.t-act.on {
  color: var(--accent);
  background: var(--accent-soft);
}

.tree-search {
  padding: 0 12px 8px;
}

.tree-root {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text);
}

.tree-root .plus {
  color: var(--text-3);
  font-size: 14px;
  line-height: 1;
}

.root-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-children {
  padding-left: 24px;
}

.tree-refs-title {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  margin: 0 8px 0 0;
  font-size: 13px;
  color: var(--text-2);
  text-align: left;
}

.tree-refs-title:hover {
  background: var(--hover);
  color: var(--text);
}

.tree-arrow {
  display: inline-block;
  font-size: 10px;
  transition: transform 0.15s;
}

.tree-refs.open .tree-arrow {
  transform: rotate(90deg);
}

.tree-refs-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-3);
  background: var(--hover);
  border-radius: 8px;
  padding: 0 4px;
  line-height: 16px;
}

.tree-refs-list {
  padding-left: 12px;
}

.tree-refs-empty {
  padding: 4px 16px;
  font-size: 12px;
  color: var(--text-3);
}

.ref-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.ref-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-leaf {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-2);
  border-radius: 8px;
  margin: 0 8px 0 0;
  cursor: pointer;
}

.tree-leaf:hover {
  background: var(--hover);
  color: var(--text);
}

.tree-leaf.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% - 16px);
  margin: 0 8px 0 0;
  padding: 8px 12px 8px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-2);
  text-align: left;
}

.node-row:hover {
  background: var(--hover);
  color: var(--text);
}

.node-row.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.node-row.disabled {
  opacity: 0.5;
}

.node-idx {
  width: 16px;
  font-size: 11px;
  color: var(--text-3);
  flex-shrink: 0;
}

.node-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-bp {
  font-size: 11px;
  color: var(--el-color-danger);
  flex-shrink: 0;
}

.var-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 8px;
}

.var-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.var-head {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-3);
}

.var-head span:first-child {
  flex: 1;
}

.var-head span:last-child {
  width: 64px;
}

.var-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 16px;
  font-size: 12px;
  color: var(--text-2);
}

.var-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.var-row:hover {
  background: var(--hover);
}

.var-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

.var-type {
  width: 64px;
  flex-shrink: 0;
  color: var(--text-3);
}

.var-del {
  position: relative;
  width: 20px;
  height: 20px;
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

/* 命中区向四周扩 4px */
.var-del::after {
  content: '';
  position: absolute;
  inset: -4px;
}

.var-row:hover .var-del,
.var-row:focus-within .var-del {
  opacity: 1;
}

.var-del:hover {
  color: var(--el-color-danger);
  background: var(--panel);
}

.var-empty-line {
  margin: 8px 16px 0;
  height: 1px;
  background: var(--border);
}
</style>
