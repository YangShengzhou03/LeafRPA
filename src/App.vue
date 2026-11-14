<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import TopBar from './components/TopBar.vue'
import Sidebar from './components/Sidebar.vue'
import LoginView from './components/LoginView.vue'
import HomeView from './components/HomeView.vue'
import AppListView from './components/AppListView.vue'
import DesignerView from './components/DesignerView.vue'
import TriggerView from './components/TriggerView.vue'
import MarketView from './components/MarketView.vue'
import TutorialView from './components/TutorialView.vue'
import CommunityView from './components/CommunityView.vue'
import { useAppStore, type ThemeMode } from './store'
import { useAuthStore } from './auth'
import { useTriggerStore, startScheduler, runTriggerNow } from './triggers'
import { onTriggerDue, setTzOffset, isTauri } from './bridge'
import SettingsPage from './pages/SettingsPage.vue'
import ServicePage from './pages/ServicePage.vue'
import HelpPage from './pages/HelpPage.vue'
import InvitePage from './pages/InvitePage.vue'
import NoticePage from './pages/NoticePage.vue'
import VipPage from './pages/VipPage.vue'
import AchievementPage from './pages/AchievementPage.vue'
import ToolsPage from './pages/ToolsPage.vue'

const store = useAppStore()
const auth = useAuthStore()
const triggerStore = useTriggerStore()

/** 取消触发器事件订阅 / 兜底调度器 */
let offTriggerDue: (() => void) | null = null
let stopFallbackScheduler: (() => void) | null = null

/** 设计器视图独占整个窗口（不显示顶栏与应用侧栏） */
const immersive = computed(
  () => store.page === 'home' && store.tab === 'app' && store.view === 'designer',
)

const THEME_KEY = 'leaf-rpa.theme'
let media: MediaQueryList | null = null

function applyTheme(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && !!window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

function onMediaChange() {
  if (store.themeMode === 'system') applyTheme('system')
}

onMounted(async () => {
  const saved = (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? 'light'
  store.setThemeMode(saved)
  applyTheme(saved)
  media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onMediaChange)
  auth.restoreSession()
  if (!auth.session) return
  // 校验 token 有效性；服务不可达时保留本地会话（离线可用）
  void auth.verifySession()
  // 元素库在 store 初始化时从本地读取，这里把历史元素重新同步为元素变量
  store.syncElementVars()
  try {
    await store.loadDataDir()
    await store.refreshFlows()
  } catch (err) {
    console.error('init failed', err)
  }
  // 触发器：Tauri 环境由 Rust 常驻线程调度（事件驱动），浏览器环境用前端兜底调度
  void triggerStore.load()
  if (isTauri()) {
    void setTzOffset(-new Date().getTimezoneOffset())
    offTriggerDue = onTriggerDue((t) => {
      void handleDueTrigger(t.id)
    })
  } else {
    stopFallbackScheduler = startScheduler(store, triggerStore)
  }
})

/** Rust 调度线程通知触发器到期：更新状态并执行关联流程 */
async function handleDueTrigger(id: string) {
  const trigger = triggerStore.triggers.find((t) => t.id === id)
  if (!trigger || store.running) return
  trigger.lastRun = new Date().toLocaleString('zh-CN', { hour12: false })
  trigger.lastRunAt = Date.now()
  triggerStore.persist()
  const run = await runTriggerNow(store, trigger)
  triggerStore.record(run)
}

onBeforeUnmount(() => {
  media?.removeEventListener('change', onMediaChange)
  offTriggerDue?.()
  stopFallbackScheduler?.()
})

watch(
  () => store.themeMode,
  (mode) => {
    localStorage.setItem(THEME_KEY, mode)
    applyTheme(mode)
  },
)
</script>

<template>
  <LoginView v-if="!auth.session" />
  <div v-else-if="immersive" class="app-immersive">
    <DesignerView />
  </div>
  <div v-else class="app-shell">
    <TopBar />
    <div class="app-body">
      <Sidebar v-if="store.page === 'home' && store.tab === 'app'" />
      <main>
        <SettingsPage v-if="store.page === 'settings'" />
        <ServicePage v-else-if="store.page === 'service'" />
        <HelpPage v-else-if="store.page === 'help'" />
        <InvitePage v-else-if="store.page === 'invite'" />
        <NoticePage v-else-if="store.page === 'notice'" />
        <VipPage v-else-if="store.page === 'vip'" />
        <AchievementPage v-else-if="store.page === 'achievement'" />
        <ToolsPage v-else-if="store.page === 'tools'" />
        <TriggerView v-else-if="store.tab === 'trigger'" />
        <MarketView v-else-if="store.tab === 'market'" />
        <TutorialView v-else-if="store.tab === 'tutorial'" />
        <CommunityView v-else-if="store.tab === 'community'" />
        <template v-else>
          <HomeView v-if="store.view === 'home'" />
          <AppListView v-else-if="store.view === 'apps'" />
          <DesignerView v-else />
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-immersive {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
  background: var(--panel);
}

main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  border-top-left-radius: 8px;
}
</style>
