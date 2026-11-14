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
import { flowShareApi, ApiError } from '../api'
import { useAuthStore } from '../auth'
import type { FlowMeta } from '../types'
import { toastError, toastSuccess, toastWarning } from '../notify'
import { t } from '../i18n'

type AppView = '' | 'rename' | 'release' | 'share'

const store = useAppStore()
const auth = useAuthStore()

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
  if (diff < min) return t('common.justNow')
  if (diff < hour) return t('common.minAgo', { n: Math.floor(diff / min) })
  if (diff < day) return t('common.hourAgo', { n: Math.floor(diff / hour) })
  if (diff < 30 * day) return t('common.dayAgo', { n: Math.floor(diff / day) })
  return t('common.monthAgo', { n: Math.max(1, Math.floor(diff / (30 * day))) })
}

function selectRow(id: string) {
  selectedId.value = id
}

function openApp(app: FlowMeta) {
  void store.openFlow(app.id)
}

function ensureSelected(): FlowMeta | null {
  if (!selected.value) {
    toastWarning(t('apps.selectFirst'), { title: t('apps.noSelection') })
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
    toastWarning(t('apps.versionRequired'), { title: t('apps.versionEmpty') })
    return
  }
  publishedMap.value = {
    ...publishedMap.value,
    [app.id]: { version, publishedAt: Date.now() },
  }
  savePublished()
  view.value = ''
  toastSuccess(t('apps.publishedOk', { name: app.name, version }), { title: t('apps.publishOk'), duration: 2600 })
}

async function onShare() {
  const app = ensureSelected()
  if (!app) return
  shareApp.value = app
  shareName.value = app.name
  shareDesc.value = ''
  shareMode.value = 'cloud'
  view.value = 'share'
}

/* ---------- 分享流程 ---------- */
const shareApp = ref<FlowMeta | null>(null)
const shareMode = ref<'cloud' | 'file'>('cloud')
const shareName = ref('')
const shareDesc = ref('')
const sharing = ref(false)

function buildEnvelope(flow: unknown): string {
  return JSON.stringify(
    { format: 'leafrpa', version: 1, exportedAt: new Date().toISOString(), flow },
    null,
    2,
  )
}

async function confirmShare() {
  const app = shareApp.value
  if (!app) return
  sharing.value = true
  try {
    const flow = await bridge.readFlow(app.id)
    const envelope = buildEnvelope(flow)
    if (shareMode.value === 'cloud') {
      if (!auth.session) {
        toastWarning(t('apps.loginToUpload'), { title: t('common.notLoggedIn') })
        return
      }
      const name = shareName.value.trim()
      if (!name) {
        toastWarning(t('apps.nameRequired'), { title: t('common.nameEmpty') })
        return
      }
      await flowShareApi.upload(name, shareDesc.value.trim(), flow.nodes.length, `${name}.leafrpa`, envelope)
      toastSuccess(t('apps.uploadedOk'), { title: t('apps.shareOk'), duration: 2800 })
    } else {
      const blob = new Blob([envelope], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${app.name}.leafrpa`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toastSuccess(t('apps.fileSaved'), { title: t('apps.shareReady'), duration: 2800 })
    }
    view.value = ''
  } catch (err) {
    if (err instanceof ApiError && err.offline) {
      toastError(t('apps.offlineCloud'), { title: t('apps.shareFailed') })
    } else {
      toastError(err instanceof Error ? err.message : t('apps.shareFailedRetry'), { title: t('apps.shareFailed') })
    }
  } finally {
    sharing.value = false
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
    toastWarning(t('apps.renameRequired'), { title: t('common.nameEmpty') })
    return
  }
  await store.renameFlow(renameDraft.value, app.id)
  view.value = ''
  toastSuccess(t('apps.renamedOk'), { title: t('apps.renamedTitle'), duration: 2000 })
}

async function onDelete() {
  const app = ensureSelected()
  if (!app) return
  try {
    await ElMessageBox.confirm(t('apps.deleteConfirm', { name: app.name }), t('sidebar.deleteTitle'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })
  } catch {
    return
  }
  if (selectedId.value === app.id) selectedId.value = null
  await store.removeFlow(app.id)
  toastSuccess(t('apps.deleteOk'), { title: t('apps.deletedTitle'), duration: 2000 })
}

function createApp() {
  void store.createAndOpen(t('sidebar.untitledApp', { n: store.flows.length + 1 }), 'pc')
}
</script>

<template>
  <section class="apps-page">
    <template v-if="!view">
    <div class="apps-head">
      <h1 class="apps-title">{{ t('sidebar.myDeveloped') }}</h1>
      <div class="apps-actions">
        <el-tooltip :content="t('apps.tipRun')" placement="bottom" :show-after="300">
          <el-button :icon="VideoPlay" @click="onRun">{{ t('apps.tipRun') }}</el-button>
        </el-tooltip>
        <el-tooltip :content="t('apps.tipEdit')" placement="bottom" :show-after="300">
          <el-button :icon="EditPen" @click="onEdit">{{ t('apps.tipEdit') }}</el-button>
        </el-tooltip>
        <el-tooltip :content="t('apps.tipRelease')" placement="bottom" :show-after="300">
          <el-button :icon="Upload" @click="onRelease">{{ t('apps.tipRelease') }}</el-button>
        </el-tooltip>
        <el-tooltip :content="t('apps.tipShare')" placement="bottom" :show-after="300">
          <el-button :icon="Share" @click="onShare">{{ t('apps.tipShare') }}</el-button>
        </el-tooltip>
        <el-dropdown trigger="click" @command="(cmd: string) => (cmd === 'rename' ? onRename() : onDelete())">
          <el-button :icon="MoreFilled" :title="t('common.more')" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename">{{ t('apps.rename') }}</el-dropdown-item>
              <el-dropdown-item command="delete">{{ t('common.delete') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-input
          v-model="keyword"
          class="apps-search"
          :placeholder="t('apps.searchPlaceholder')"
          clearable
          :prefix-icon="Search"
        />
      </div>
    </div>

    <el-empty
      v-if="apps.length === 0"
      class="apps-empty"
      :image-size="96"
      :description="keyword ? t('apps.emptyMatch') : t('apps.emptyNone')"
    >
      <el-button v-if="!keyword" type="primary" @click="createApp">{{ t('apps.create') }}</el-button>
    </el-empty>

    <table v-else class="table app-table">
      <thead>
        <tr>
          <th
            class="sortable th-name"
            tabindex="0"
            :title="t('apps.sortTip')"
            @click="toggleSort('name')"
            @keydown.enter="toggleSort('name')"
            @keydown.space.prevent="toggleSort('name')"
          >
            {{ t('apps.colName') }}
            <el-icon :size="12" class="sort-ico" :class="{ on: sortKey === 'name' }">
              <CaretTop v-if="sortKey === 'name' && sortOrder === 'desc'" />
              <CaretBottom v-else />
            </el-icon>
          </th>
          <th
            class="sortable th-time"
            tabindex="0"
            :title="t('apps.sortTip')"
            @click="toggleSort('updatedAt')"
            @keydown.enter="toggleSort('updatedAt')"
            @keydown.space.prevent="toggleSort('updatedAt')"
          >
            {{ t('apps.colUpdated') }}
            <el-icon :size="12" class="sort-ico" :class="{ on: sortKey === 'updatedAt' }">
              <CaretTop v-if="sortKey === 'updatedAt' && sortOrder === 'desc'" />
              <CaretBottom v-else />
            </el-icon>
          </th>
          <th class="th-status">{{ t('apps.colStatus') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="app in apps"
          :key="app.id"
          :class="{ picked: app.id === selectedId }"
          tabindex="0"
          :title="t('apps.rowTip')"
          @click="selectRow(app.id)"
          @dblclick="openApp(app)"
          @keydown.enter="openApp(app)"
          @keydown.space.prevent="selectRow(app.id)"
        >
          <td>
            <div class="app-cell">
              <span class="app-thumb">{{ app.name.charAt(0) || t('apps.thumbFallback') }}</span>
              <span class="app-name" :title="app.name">{{ app.name }}</span>
            </div>
          </td>
          <td class="cell-dim">{{ relTime(app.updatedAt) }}</td>
          <td>
            <span v-if="publishedMap[app.id]" class="edit-status released">
              <el-icon :size="13"><Upload /></el-icon>
              {{ t('apps.released', { version: publishedMap[app.id].version }) }}
            </span>
            <span v-else class="edit-status">
              <el-icon :size="13"><EditPen /></el-icon>
              {{ t('apps.editing') }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    </template>

    <template v-else-if="view === 'rename'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="view = ''">{{ t('apps.back') }}</el-button>
      </div>
      <div class="form-card sec-card">
        <h2 class="form-title">{{ t('apps.renameTitle') }}</h2>
        <el-form label-position="top">
          <el-form-item :label="t('apps.labelName')">
            <el-input
              v-model="renameDraft"
              :placeholder="t('apps.namePlaceholder')"
              maxlength="50"
              @keydown.enter="confirmRename"
            />
          </el-form-item>
        </el-form>
        <div class="form-actions">
          <el-button @click="view = ''">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="confirmRename">{{ t('common.confirm') }}</el-button>
        </div>
      </div>
    </template>

    <template v-else-if="view === 'release'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="view = ''">{{ t('apps.back') }}</el-button>
      </div>
      <div class="form-card sec-card">
        <h2 class="form-title">{{ t('apps.releaseTitle') }}</h2>
        <el-form label-position="top">
          <el-form-item :label="t('apps.labelName')">
            <el-input :model-value="releaseApp?.name ?? ''" disabled />
          </el-form-item>
          <el-form-item :label="t('apps.labelVersion')">
            <el-input v-model="releaseVersion" :placeholder="t('apps.versionPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('apps.labelNote')">
            <span class="release-note">
              {{ t('apps.releaseNote') }}
            </span>
          </el-form-item>
        </el-form>
        <div class="form-actions">
          <el-button @click="view = ''">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="confirmRelease">{{ t('apps.confirmPublish') }}</el-button>
        </div>
      </div>
    </template>
    <template v-else-if="view === 'share'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="view = ''">{{ t('apps.back') }}</el-button>
      </div>
      <div class="form-card sec-card">
        <h2 class="form-title">{{ t('apps.shareTitle') }}</h2>
        <el-form label-position="top">
          <el-form-item :label="t('apps.labelMode')">
            <el-radio-group v-model="shareMode">
              <el-radio-button value="cloud">{{ t('apps.modeCloud') }}</el-radio-button>
              <el-radio-button value="file">{{ t('apps.modeFile') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="t('apps.labelFlowName')">
            <el-input v-model="shareName" maxlength="120" :placeholder="t('apps.flowNamePlaceholder')" />
          </el-form-item>
          <el-form-item v-if="shareMode === 'cloud'" :label="t('apps.labelDesc')">
            <el-input
              v-model="shareDesc"
              type="textarea"
              :rows="3"
              maxlength="255"
              :placeholder="t('apps.descPlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="t('apps.labelNote')">
            <span class="release-note">
              {{ shareMode === 'cloud' ? t('apps.cloudNote') : t('apps.fileNote') }}
            </span>
          </el-form-item>
        </el-form>
        <div class="form-actions">
          <el-button @click="view = ''">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="sharing" @click="confirmShare">
            {{ shareMode === 'cloud' ? t('apps.uploadBtn') : t('apps.saveBtn') }}
          </el-button>
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
  gap: 12px;
  min-width: 0;
}

.app-thumb {
  width: 24px;
  height: 24px;
  border-radius: 8px;
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
  gap: 4px;
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
