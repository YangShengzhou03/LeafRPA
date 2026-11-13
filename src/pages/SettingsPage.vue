<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAppStore, type ThemeMode } from '../store'
import { useTriggerStore } from '../triggers'
import { installedApps } from '../installedApps'
import { copyText } from '../clipboard'
import { toastError, toastSuccess } from '../notify'
import { i18n, setLocale, t, type Locale } from '../i18n'
import type { CloseAction } from '../bridge'
import PageShell from '../components/PageShell.vue'

const store = useAppStore()
const triggerStore = useTriggerStore()
const REPO_URL = 'https://gitee.com/Yangshengzhou/leaf-rpa'

type SectionKey = 'general' | 'appearance' | 'data' | 'about' | 'danger'

const sectionLabels: Record<SectionKey, 'nav.general' | 'nav.appearance' | 'nav.data' | 'nav.about' | 'nav.danger'> = {
  general: 'nav.general',
  appearance: 'nav.appearance',
  data: 'nav.data',
  about: 'nav.about',
  danger: 'nav.danger',
}
const sections = Object.keys(sectionLabels) as SectionKey[]

const locales: { value: Locale; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
]

const closeActions: { value: CloseAction; label: 'closeAction.exit' | 'closeAction.minimize' | 'closeAction.tray' }[] = [
  { value: 'exit', label: 'closeAction.exit' },
  { value: 'minimize', label: 'closeAction.minimize' },
  { value: 'tray', label: 'closeAction.tray' },
]

const themes: { value: ThemeMode; label: 'theme.light' | 'theme.dark' | 'theme.system' }[] = [
  { value: 'light', label: 'theme.light' },
  { value: 'dark', label: 'theme.dark' },
  { value: 'system', label: 'theme.system' },
]

/* ---------- 左侧锚点目录：点击滚动定位 + 滚动跟随高亮 ---------- */
const active = ref<SectionKey>('general')
const rootEl = ref<HTMLElement | null>(null)
const sectionEls = new Map<SectionKey, HTMLElement>()
let scrollBox: HTMLElement | null = null
let spyLock = false

function setSectionRef(key: SectionKey) {
  return (el: unknown) => {
    if (el) sectionEls.set(key, el as HTMLElement)
    else sectionEls.delete(key)
  }
}

function scrollToSection(key: SectionKey) {
  const el = sectionEls.get(key)
  if (!el) return
  spyLock = true
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  active.value = key
  window.setTimeout(() => (spyLock = false), 500)
}

function onScroll() {
  if (spyLock) return
  const boxTop = scrollBox?.getBoundingClientRect().top ?? 0
  let current: SectionKey = 'general'
  for (const key of sections) {
    const el = sectionEls.get(key)
    if (el && el.getBoundingClientRect().top - boxTop <= 80) current = key
  }
  active.value = current
}

onMounted(() => {
  // 页面滚动容器为本页所在的 .page 内容区（多页签共存，需取最近祖先）
  scrollBox = rootEl.value?.closest('.page') as HTMLElement | null
  const target: HTMLElement | Window = scrollBox ?? window
  target.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  const target: HTMLElement | Window = scrollBox ?? window
  target.removeEventListener('scroll', onScroll)
})

/* ---------- 通用：语言 / 关闭行为 ---------- */

function onLocaleChange(v: string | number | boolean) {
  setLocale(v as Locale)
}

/* ---------- 数据位置 ---------- */

async function changeDataDir() {
  const picked = await store.changeDataRoot()
  if (picked) toastSuccess(t('settings.data.changeOk'))
}

async function resetDataDir() {
  try {
    await ElMessageBox.confirm(t('settings.data.resetConfirm'), t('settings.data.migrateConfirmTitle'), {
      type: 'warning',
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
    })
  } catch {
    return
  }
  const ok = await store.resetDataRoot()
  if (ok) toastSuccess(t('settings.data.resetOk'))
}

/* ---------- 关于 / 危险操作 ---------- */

async function copyRepo() {
  if (await copyText(REPO_URL)) toastSuccess(t('settings.about.repoCopied'))
  else toastError(t('settings.about.copyFailed'))
}

async function clearAll() {
  try {
    await ElMessageBox.confirm(t('settings.danger.confirmText'), t('settings.danger.confirmTitle'), {
      type: 'warning',
      confirmButtonText: t('settings.danger.confirmBtn'),
      cancelButtonText: t('common.cancel'),
    })
  } catch {
    return
  }
  try {
    await store.clearAllData()
    triggerStore.load()
    toastSuccess(t('settings.danger.cleared'))
  } catch (err) {
    toastError(t('settings.danger.clearFailed', { err: err instanceof Error ? err.message : String(err) }))
  }
}
</script>

<template>
  <PageShell :title="t('settings.title')" :kicker="t('settings.kicker')" :sub="t('settings.sub')">
    <div ref="rootEl" class="set-layout">
      <nav class="set-nav">
        <button
          v-for="s in sections"
          :key="s"
          class="set-nav-item"
          :class="{ active: active === s }"
          @click="scrollToSection(s)"
        >
          {{ t(`settings.${sectionLabels[s]}`) }}
        </button>
      </nav>

      <div class="set-content">
        <section :ref="setSectionRef('general')" class="sec-card set-section">
          <h2 class="sec-title">{{ t('settings.nav.general') }}</h2>
          <div class="general-row">
            <div class="general-info">
              <div class="general-label">{{ t('settings.general.language') }}</div>
              <p class="sec-meta">{{ t('settings.general.languageHint') }}</p>
            </div>
            <el-select
              class="general-select"
              :model-value="i18n.locale"
              @change="onLocaleChange"
            >
              <el-option v-for="l in locales" :key="l.value" :value="l.value" :label="l.label" />
            </el-select>
          </div>
          <div class="general-row">
            <div class="general-info">
              <div class="general-label">{{ t('settings.general.closeAction') }}</div>
              <p class="sec-meta">{{ t('settings.general.closeActionHint') }}</p>
            </div>
            <el-select
              class="general-select"
              :model-value="store.closeAction"
              @change="(v: string) => store.setCloseAction(v as CloseAction)"
            >
              <el-option v-for="a in closeActions" :key="a.value" :value="a.value" :label="t(`settings.${a.label}`)" />
            </el-select>
          </div>
        </section>

        <section :ref="setSectionRef('appearance')" class="sec-card set-section">
          <h2 class="sec-title">{{ t('settings.appearance.title') }}</h2>
          <div class="general-row">
            <div class="general-info">
              <div class="general-label">{{ t('settings.appearance.title') }}</div>
              <p class="sec-meta">{{ t('settings.appearance.hint') }}</p>
            </div>
            <el-select
              class="general-select"
              :model-value="store.themeMode"
              @change="(v: string) => store.setThemeMode(v as ThemeMode)"
            >
              <el-option v-for="th in themes" :key="th.value" :value="th.value" :label="t(`settings.${th.label}`)" />
            </el-select>
          </div>
        </section>

        <section :ref="setSectionRef('data')" class="sec-card set-section">
          <h2 class="sec-title">{{ t('settings.data.title') }}</h2>
          <div class="sec-rows">
            <div class="sec-row">
              <span class="sec-row-label">{{ t('settings.data.location') }}</span>
              <span class="sec-row-value set-dir">
                <span class="set-ellipsis" :title="store.dataDir">
                  {{ store.dataDir || t('settings.data.notLoaded') }}
                </span>
                <span class="set-dir-tag" :class="{ custom: store.dataRootCustom }">
                  {{ store.dataRootCustom ? t('settings.data.customTag') : t('settings.data.defaultTag') }}
                </span>
                <el-button link type="primary" @click="changeDataDir">
                  {{ t('settings.data.change') }}
                </el-button>
                <el-button
                  v-if="store.dataRootCustom"
                  link
                  @click="resetDataDir"
                >
                  {{ t('settings.data.reset') }}
                </el-button>
              </span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">{{ t('settings.data.flows') }}</span>
              <span class="sec-row-value">{{ store.flows.length }} {{ t('settings.data.flowsUnit') }}</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">{{ t('settings.data.triggers') }}</span>
              <span class="sec-row-value">{{ triggerStore.triggers.length }} {{ t('settings.data.flowsUnit') }}</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">{{ t('settings.data.apps') }}</span>
              <span class="sec-row-value">{{ installedApps.size }} {{ t('settings.data.flowsUnit') }}</span>
            </div>
          </div>
        </section>

        <section :ref="setSectionRef('about')" class="sec-card set-section">
          <h2 class="sec-title">{{ t('settings.nav.about') }}</h2>
          <div class="sec-rows">
            <div class="sec-row">
              <span class="sec-row-label">{{ t('settings.about.version') }}</span>
              <span class="sec-row-value">轻羽 RPA v0.1.0</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">{{ t('settings.about.repo') }}</span>
              <span class="sec-row-value">
                <span class="set-ellipsis">{{ REPO_URL }}</span>
                <el-button link type="primary" @click="copyRepo">{{ t('settings.about.repoCopy') }}</el-button>
              </span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">{{ t('settings.about.feedback') }}</span>
              <span class="sec-row-value">{{ t('settings.about.feedbackDesc') }}</span>
            </div>
          </div>
        </section>

        <section :ref="setSectionRef('danger')" class="sec-card set-danger set-section">
          <h2 class="sec-title">{{ t('settings.nav.danger') }}</h2>
          <div class="set-danger-body">
            <p class="sec-meta">{{ t('settings.danger.desc') }}</p>
            <el-button type="danger" plain @click="clearAll">{{ t('settings.danger.clear') }}</el-button>
          </div>
        </section>
      </div>
    </div>
  </PageShell>
</template>

<style scoped>
.set-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

/* 目录固定，右侧内容随页面滚动，目录仅作锚点定位 */
.set-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 16px;
}

.set-nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-2);
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.set-nav-item:hover {
  background: var(--panel);
  color: var(--text);
}

.set-nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}

.set-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.set-section {
  scroll-margin-top: 16px;
}

/* 通用分区：左侧说明 + 右侧控件 */
.general-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: 14px;
}

.general-row:first-of-type {
  margin-top: 0;
}

.general-info {
  min-width: 0;
}

.general-label {
  font-size: 13px;
  color: var(--text);
}

.general-info .sec-meta {
  margin: 4px 0 0;
}

.general-select {
  width: 160px;
  flex-shrink: 0;
}

/* 数据位置行：路径 + 标签 + 操作 */
.set-dir {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.set-dir > .set-ellipsis {
  max-width: 320px;
}

.set-dir-tag {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: var(--panel);
  color: var(--text-2);
}

.set-dir-tag.custom {
  background: var(--accent-soft);
  color: var(--accent);
}

.set-danger-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
}

.set-danger-body .sec-meta {
  margin: 0;
}

.set-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
