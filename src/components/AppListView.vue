<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  CaretBottom,
  CaretTop,
  EditPen,
  MoreFilled,
  Search,
  Share,
  Upload,
  VideoPlay,
} from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import * as bridge from '../bridge'
import type { FlowMeta } from '../types'
import { toastError, toastSuccess, toastWarning } from '../notify'

type AppView = '' | 'rename' | 'release'

const store = useAppStore()

const selectedId = ref<string | null>(null)
const keyword = ref('')
const sortKey = ref<'name' | 'updatedAt' | null>(null)
const sortOrder = ref<'asc' | 'desc'>('asc')
const view = ref<AppView>('')

const apps = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const list = store.flows.filter((f) => !kw || f.name.toLowerCase().includes(kw))
  if (!sortKey.value) return list
  const dir = sortOrder.value === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    if (sortKey.value === 'name') return a.name.localeCompare(b.name, 'zh-CN') * dir
    return (a.updatedAt - b.updatedAt) * dir
  })
})

const selected = computed(() => store.flows.find((f) => f.id === selectedId.value) ?? null)

function toggleSort(key: 'name' | 'updatedAt') {
  if (sortKey.value === key) {
    // 同一列再次点击时切换方向
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    // 名称按字典序升序更自然；时间默认最新在前
    sortOrder.value = key === 'name' ? 'asc' : 'desc'
  }
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)}天前`
  return `${Math.max(1, Math.floor(diff / (30 * day)))}个月前`
}

function selectRow(id: string) {
  selectedId.value = id
}

function openApp(app: FlowMeta) {
  void store.openFlow(app.id)
}

function ensureSelected(): FlowMeta | null {
  if (!selected.value) {
    toastWarning('请先选择一个应用', { title: '未选择应用' })
    return null
  }
  return selected.value
}

async function onRun() {
  const app = ensureSelected()
  if (!app) return
  await store.openFlow(app.id)
  void store.run()
}

function onEdit() {
  const app = ensureSelected()
  if (!app) return
  void store.openFlow(app.id)
}

/* ---------- 发版 / 分享 ---------- */
interface PublishedInfo {
  version: string
  publishedAt: number
}

const PUBLISHED_KEY = 'leaf-rpa.publishedApps.v1'

function loadPublished(): Record<string, PublishedInfo> {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY)
    if (!raw) return {}
    return JSON.parse(raw) ?? {}
  } catch {
    return {}
  }
}

const publishedMap = ref<Record<string, PublishedInfo>>(loadPublished())

function savePublished() {
  try {
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(publishedMap.value))
  } catch {
    /* 忽略本地存储失败 */
  }
}

const releaseVersion = ref('1.0.0')
const releaseApp = ref<FlowMeta | null>(null)

function onRelease() {
  const app = ensureSelected()
  if (!app) return
  releaseApp.value = app
  releaseVersion.value = publishedMap.value[app.id]?.version ?? '1.0.0'
  view.value = 'release'
}

async function confirmRelease() {
  const app = releaseApp.value
  if (!app) return
  const version = releaseVersion.value.trim()
  if (!version) {
    toastWarning('请输入版本号', { title: '版本号为空' })
    return
  }
  publishedMap.value = {
    ...publishedMap.value,
    [app.id]: { version, publishedAt: Date.now() },
  }
  savePublished()
  view.value = ''
  toastSuccess(`已发布 ${app.name} v${version}`, { title: '发布成功', duration: 2600 })
}

async function onShare() {
  const app = ensureSelected()
  if (!app) return
  try {
    const flow = await bridge.readFlow(app.id)
    const envelope = {
      format: 'leafrpa',
      version: 1,
      exportedAt: new Date().toISOString(),
      flow,
    }
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${app.name}.leafrpa`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toastSuccess('流程文件已保存，在其它设备的设计器中「导入」即可使用', { title: '分享就绪', duration: 2800 })
  } catch {
    toastError('文件保存失败，请重试', { title: '分享失败' })
  }
}

/* ---------- 更多菜单 ---------- */
const renameDraft = ref('')

function onRename() {
  const app = ensureSelected()
  if (!app) return
  renameDraft.value = app.name
  view.value = 'rename'
}

async function confirmRename() {
  const app = selected.value
  if (!app) return
  if (!renameDraft.value.trim()) {
    toastWarning('应用名称不能为空', { title: '名称为空' })
    return
  }
  await store.renameFlow(renameDraft.value, app.id)
  view.value = ''
  toastSuccess('重命名成功', { title: '应用已重命名', duration: 2000 })
}

async function onDelete() {
  const app = ensureSelected()
  if (!app) return
  try {
    await ElMessageBox.confirm(`确定删除应用「${app.name}」吗？删除后不可恢复。`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  if (selectedId.value === app.id) selectedId.value = null
  await store.removeFlow(app.id)
  toastSuccess('删除成功', { title: '应用已删除', duration: 2000 })
}

function createApp() {
  void store.createAndOpen(`未命名应用 ${store.flows.length + 1}`, 'pc')
}
</script>

<template>
  <section class="apps-page">
    <template v-if="!view">
    <div class="apps-head">
      <h1 class="apps-title">我开发的应用</h1>
      <div class="apps-actions">
        <el-tooltip content="运行" placement="bottom" :show-after="300">
          <el-button :icon="VideoPlay" @click="onRun">运行</el-button>
        </el-tooltip>
        <el-tooltip content="编辑" placement="bottom" :show-after="300">
          <el-button :icon="EditPen" @click="onEdit">编辑</el-button>
        </el-tooltip>
        <el-tooltip content="发版" placement="bottom" :show-after="300">
          <el-button :icon="Upload" @click="onRelease">发版</el-button>
        </el-tooltip>
        <el-tooltip content="保存流程文件分享" placement="bottom" :show-after="300">
          <el-button :icon="Share" @click="onShare">分享</el-button>
        </el-tooltip>
        <el-dropdown trigger="click" @command="(cmd: string) => (cmd === 'rename' ? onRename() : onDelete())">
          <el-button :icon="MoreFilled" title="更多" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename">重命名</el-dropdown-item>
              <el-dropdown-item command="delete">删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-input
          v-model="keyword"
          class="apps-search"
          placeholder="搜索应用"
          clearable
          :prefix-icon="Search"
        />
      </div>
    </div>

    <el-empty
      v-if="apps.length === 0"
      class="apps-empty"
      :image-size="96"
      :description="keyword ? '没有匹配的应用' : '还没有应用，快来创建第一个自动化应用吧'"
    >
      <el-button v-if="!keyword" type="primary" @click="createApp">新建应用</el-button>
    </el-empty>

    <table v-else class="table app-table">
      <thead>
        <tr>
          <th
            class="sortable th-name"
            tabindex="0"
            title="点击或按回车排序"
            @click="toggleSort('name')"
            @keydown.enter="toggleSort('name')"
            @keydown.space.prevent="toggleSort('name')"
          >
            应用名称
            <el-icon :size="12" class="sort-ico" :class="{ on: sortKey === 'name' }">
              <CaretTop v-if="sortKey === 'name' && sortOrder === 'desc'" />
              <CaretBottom v-else />
            </el-icon>
          </th>
          <th
            class="sortable th-time"
            tabindex="0"
            title="点击或按回车排序"
            @click="toggleSort('updatedAt')"
            @keydown.enter="toggleSort('updatedAt')"
            @keydown.space.prevent="toggleSort('updatedAt')"
          >
            更新时间
            <el-icon :size="12" class="sort-ico" :class="{ on: sortKey === 'updatedAt' }">
              <CaretTop v-if="sortKey === 'updatedAt' && sortOrder === 'desc'" />
              <CaretBottom v-else />
            </el-icon>
          </th>
          <th class="th-status">编辑状态</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="app in apps"
          :key="app.id"
          :class="{ picked: app.id === selectedId }"
          tabindex="0"
          title="单击选中，双击打开，回车打开"
          @click="selectRow(app.id)"
          @dblclick="openApp(app)"
          @keydown.enter="openApp(app)"
          @keydown.space.prevent="selectRow(app.id)"
        >
          <td>
            <div class="app-cell">
              <span class="app-thumb">{{ app.name.charAt(0) || '应' }}</span>
              <span class="app-name" :title="app.name">{{ app.name }}</span>
            </div>
          </td>
          <td class="cell-dim">{{ relTime(app.updatedAt) }}</td>
          <td>
            <span v-if="publishedMap[app.id]" class="edit-status released">
              <el-icon :size="13"><Upload /></el-icon>
              已发布 v{{ publishedMap[app.id].version }}
            </span>
            <span v-else class="edit-status">
              <el-icon :size="13"><EditPen /></el-icon>
              编辑中
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    </template>

    <template v-else-if="view === 'rename'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="view = ''">返回应用列表</el-button>
      </div>
      <div class="form-card sec-card">
        <h2 class="form-title">重命名应用</h2>
        <el-form label-position="top">
          <el-form-item label="应用名称">
            <el-input
              v-model="renameDraft"
              placeholder="输入新的应用名称"
              maxlength="50"
              @keydown.enter="confirmRename"
            />
          </el-form-item>
        </el-form>
        <div class="form-actions">
          <el-button @click="view = ''">取消</el-button>
          <el-button type="primary" @click="confirmRename">确定</el-button>
        </div>
      </div>
    </template>

    <template v-else-if="view === 'release'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="view = ''">返回应用列表</el-button>
      </div>
      <div class="form-card sec-card">
        <h2 class="form-title">发布应用</h2>
        <el-form label-position="top">
          <el-form-item label="应用名称">
            <el-input :model-value="releaseApp?.name ?? ''" disabled />
          </el-form-item>
          <el-form-item label="版本号">
            <el-input v-model="releaseVersion" placeholder="例如 1.0.0" />
          </el-form-item>
          <el-form-item label="说明">
            <span class="release-note">
              发布信息保存在本地，应用列表会展示当前版本状态；演示版本不包含云端同步。
            </span>
          </el-form-item>
        </el-form>
        <div class="form-actions">
          <el-button @click="view = ''">取消</el-button>
          <el-button type="primary" @click="confirmRelease">确认发布</el-button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.apps-page {
  flex: 1;
  overflow-y: auto;
  background: var(--bg);
  padding: 20px 28px 28px;
  display: flex;
  flex-direction: column;
}

.apps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.apps-title {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  color: var(--text);
  letter-spacing: 0.2px;
}

.apps-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.apps-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.apps-search {
  width: 240px;
}

.apps-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.app-table {
  border-radius: 12px;
}

.app-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.app-table th.sortable:hover {
  color: var(--text);
  background: var(--hover);
}

.app-table th.sortable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  color: var(--text);
}

/* 固定列宽：名称列自适应占满，时间 / 状态列固定宽度不换行 */
.app-table th.th-name,
.app-table td:nth-child(1) {
  width: auto;
}

.app-table th.th-time,
.app-table td:nth-child(2) {
  width: 130px;
  white-space: nowrap;
}

.app-table th.th-status,
.app-table td:nth-child(3) {
  width: 150px;
  white-space: nowrap;
}

.sort-ico {
  color: var(--text-3);
  margin-left: 2px;
  vertical-align: -2px;
}

.sort-ico.on {
  color: var(--accent);
}

.app-table tbody tr {
  cursor: pointer;
}

.app-table tbody tr.picked {
  background: var(--accent-soft);
}

.app-table tbody tr:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.app-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.app-thumb {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--el-color-success);
  color: var(--el-color-white);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-2);
}

.edit-status.released {
  color: var(--el-color-success);
}

.release-note {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.7;
}
</style>
