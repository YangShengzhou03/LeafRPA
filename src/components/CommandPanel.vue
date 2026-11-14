<script setup lang="ts">
import { computed, ref } from 'vue'
import { CaretBottom, CaretRight, Search } from '@element-plus/icons-vue'
import { COMMAND_CATEGORIES, COMMANDS } from '../commands'
import { useAppStore } from '../store'
import { toastSuccess } from '../notify'
import { t, type MessageKey } from '../i18n'
import type { CommandDefinition } from '../types'

const store = useAppStore()

const keyword = ref('')
const activeTab = ref<'standard' | 'custom'>('standard')
const expanded = ref<string | null>(null)

interface Group {
  key: string
  label: MessageKey
  /** 对应 COMMANDS 的分类；未映射的分类点击时提示敬请期待 */
  cat?: string
  /** 展开后的空态文案（收藏 / 自定义指令） */
  empty?: MessageKey
  badge?: MessageKey
}

const GROUPS: Group[] = [
  { key: 'fav', label: 'designer.groupFav', empty: 'designer.noFav' },
  { key: 'custom', label: 'designer.groupCustom', empty: 'designer.noCustom' },
  { key: 'basic', label: 'designer.groupBasic', badge: 'designer.badgeRecommended' },
  { key: 'if', label: 'designer.groupIf', cat: '控制流' },
  { key: 'loop', label: 'designer.groupLoop', cat: '控制流' },
  { key: 'wait', label: 'designer.groupWait', cat: '等待与录屏' },
  { key: 'mouse', label: 'designer.groupMouse' },
  { key: 'ai', label: 'designer.groupAi' },
  { key: 'web', label: 'designer.groupWeb', cat: '网页自动化' },
  { key: 'desktop', label: 'designer.groupDesktop', cat: '桌面自动化' },
  { key: 'keyboard', label: 'designer.groupKeyboard' },
  { key: 'grid', label: 'designer.tabTable' },
  { key: 'excel', label: 'designer.groupExcel' },
  { key: 'file', label: 'designer.groupFile' },
  { key: 'data', label: 'designer.groupData', cat: '数据处理' },
  { key: 'os', label: 'designer.groupOs' },
  { key: 'browse', label: 'designer.groupBrowse' },
  { key: 'net', label: 'designer.groupNet', cat: '网络与通知' },
  { key: 'other', label: 'designer.groupOther' },
]

function groupCommands(g: Group): CommandDefinition[] {
  if (!g.cat) return []
  return COMMANDS.filter((c) => c.category === g.cat)
}

/** 仅展示有真实指令的分类；未接入的分组不展示（DESIGN.md 第 6 条：隐藏未实现能力） */
const visibleGroups = computed(() =>
  GROUPS.filter((g) => g.empty || g.key === 'basic' || groupCommands(g).length > 0),
)

const searching = computed(() => keyword.value.trim() !== '')

const searchResults = computed<CommandDefinition[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  return COMMANDS.filter(
    (c) => c.name.toLowerCase().includes(kw) || c.description.toLowerCase().includes(kw),
  )
})

function toggleGroup(g: Group) {
  expanded.value = expanded.value === g.key ? null : g.key
}

function addCommand(type: string) {
  store.addNode(type, 120, 120)
  const def = COMMANDS.find((c) => c.type === type)
  toastSuccess(t('designer.addedCmd', { name: def?.name ?? type }), { title: t('designer.cmdAdded'), duration: 1800 })
}
</script>

<template>
  <aside class="cmd-panel">
    <div class="cmd-head">
      <div class="cmd-title-row">
        <span class="cmd-title">{{ t('designer.commands') }}</span>
        <div class="cmd-search">
          <el-input v-model="keyword" :placeholder="t('designer.searchCommands')" clearable :prefix-icon="Search" />
        </div>
      </div>
      <div class="cmd-tabs">
        <button :class="{ active: activeTab === 'standard' }" @click="activeTab = 'standard'">{{ t('designer.standardCmds') }}</button>
        <button :class="{ active: activeTab === 'custom' }" @click="activeTab = 'custom'">{{ t('designer.customCmds') }}</button>
      </div>
    </div>

    <div class="cmd-body">
      <template v-if="activeTab === 'custom'">
        <div class="cmd-hint">{{ t('designer.noCustom') }}</div>
      </template>

      <template v-else-if="searching">
        <div v-if="!searchResults.length" class="cmd-hint">{{ t('designer.noMatchCmd') }}</div>
        <button
          v-for="cmd in searchResults"
          :key="cmd.type"
          class="cmd-item"
          :title="cmd.description"
          @click="addCommand(cmd.type)"
        >
          <span class="dot" :style="{ background: cmd.color }"></span>
          <span class="label">{{ cmd.name }}</span>
          <span class="desc">{{ cmd.description }}</span>
        </button>
      </template>

      <template v-else>
        <div v-for="g in visibleGroups" :key="g.key" class="cmd-group">
          <button class="group-head" @click="toggleGroup(g)">
            <el-icon :size="12" class="chev" :class="{ open: expanded === g.key }">
              <CaretBottom v-if="expanded === g.key" />
              <CaretRight v-else />
            </el-icon>
            <span class="group-name">{{ t(g.label) }}</span>
            <span v-if="g.badge" class="badge">{{ t(g.badge) }}</span>
          </button>
          <div v-if="expanded === g.key" class="group-body">
            <div v-if="g.empty" class="cmd-hint">{{ t(g.empty) }}</div>
            <template v-else-if="g.key === 'basic'">
              <template v-for="cat in COMMAND_CATEGORIES" :key="cat">
                <div class="sub-cat">{{ cat }}</div>
                <button
                  v-for="cmd in COMMANDS.filter((c) => c.category === cat)"
                  :key="cmd.type"
                  class="cmd-item"
                  :title="cmd.description"
                  @click="addCommand(cmd.type)"
                >
                  <span class="dot" :style="{ background: cmd.color }"></span>
                  <span class="label">{{ cmd.name }}</span>
                  <span class="desc">{{ cmd.description }}</span>
                </button>
              </template>
            </template>
            <template v-else>
              <button
                v-for="cmd in groupCommands(g)"
                :key="cmd.type"
                class="cmd-item"
                :title="cmd.description"
                @click="addCommand(cmd.type)"
              >
                <span class="dot" :style="{ background: cmd.color }"></span>
                <span class="label">{{ cmd.name }}</span>
                <span class="desc">{{ cmd.description }}</span>
              </button>
            </template>
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.cmd-panel {
  width: 236px;
  background: var(--bg);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
}

.cmd-head {
  padding: 12px;
  flex-shrink: 0;
}

.cmd-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
}

.cmd-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  flex-shrink: 0;
}

.cmd-search {
  flex: 1;
  min-width: 0;
}

.cmd-search :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding: 0;
}

.cmd-search :deep(.el-input__inner) {
  font-size: 13px;
}

.cmd-tabs {
  display: flex;
  gap: 4px;
  margin-top: 12px;
  padding: 4px;
  border-radius: 8px;
  background: var(--panel);
}

.cmd-tabs button {
  flex: 1;
  border: none;
  background: transparent;
  height: 28px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-2);
}

.cmd-tabs button:hover {
  color: var(--text);
}

.cmd-tabs button.active {
  color: var(--text);
  font-weight: 500;
  background: var(--bg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.cmd-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 20px;
}

.cmd-group + .cmd-group {
  margin-top: 4px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  text-align: left;
  color: var(--text);
  font-size: 13px;
}

.group-head:hover {
  background: var(--hover);
}

.chev {
  color: var(--text-3);
  flex-shrink: 0;
}

.group-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  font-size: 10px;
  line-height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}

.group-body {
  padding: 4px 0 8px;
}

.sub-cat {
  padding: 8px 12px 4px 32px;
  font-size: 12px;
  color: var(--text-3);
}

.cmd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px 8px 32px;
  border: none;
  background: transparent;
  text-align: left;
  color: var(--text);
  cursor: grab;
}

.cmd-item:hover {
  background: var(--accent-soft);
}

.cmd-item:hover .label {
  color: var(--accent);
}

.cmd-item .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cmd-item .label {
  flex-shrink: 0;
  font-size: 13px;
}

.cmd-item .desc {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cmd-hint {
  padding: 16px 12px;
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
}
</style>
