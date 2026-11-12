<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import {
  Grid, Lightning, Compass, Reading, Guide, Present, Service,
  QuestionFilled, Bell, ArrowRight, Back,
  Setting, Monitor, Tools, Star, Trophy, SwitchButton, Select,
} from '@element-plus/icons-vue'
import WindowControls from './WindowControls.vue'
import { useAppStore, type TabKey } from '../store'
import { useAuthStore } from '../auth'
import { toastSuccess } from '../notify'

const store = useAppStore()
const auth = useAuthStore()

const tabs: { key: TabKey; label: string; icon: any }[] = [
  { key: 'app', label: '应用', icon: Grid },
  { key: 'trigger', label: '触发器', icon: Lightning },
  { key: 'market', label: '市场', icon: Compass },
  { key: 'tutorial', label: '教程', icon: Reading },
  { key: 'community', label: '社区', icon: Guide },
]

/* ---- 消息中心（读取消息中心页持久化的数据，保证与页面一致） ---- */
const NOTICE_KEY = 'leaf-rpa.notices'

interface NoticeItem {
  id: string
  title: string
  desc: string
  time: number
  unread: boolean
}

function loadNotices(): NoticeItem[] {
  try {
    const raw = localStorage.getItem(NOTICE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as NoticeItem[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const notices = ref<NoticeItem[]>([])
const unreadCount = computed(() => notices.value.filter((n) => n.unread).length)
/** 面板中最多展示的最新消息条数 */
const PANEL_LIMIT = 5
const panelNotices = computed(() => notices.value.slice(0, PANEL_LIMIT))

function persistNotices() {
  localStorage.setItem(NOTICE_KEY, JSON.stringify(notices.value))
}

function formatNoticeTime(t: number) {
  const diff = Date.now() - t
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  return new Date(t).toLocaleDateString('zh-CN')
}

/* ---- 消息小面板 ---- */
const noticeVisible = ref(false)

function onNoticeShow() {
  notices.value = loadNotices()
}

function readNotice(n: NoticeItem) {
  if (!n.unread) return
  const fresh = loadNotices()
  const target = fresh.find((x) => x.id === n.id)
  if (target) {
    target.unread = false
    persistNotices()
  }
  notices.value = fresh
}

function goNoticePage() {
  noticeVisible.value = false
  store.navigate('notice')
}

let noticeTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  notices.value = loadNotices()
  noticeTimer = setInterval(() => {
    if (!noticeVisible.value) notices.value = loadNotices()
  }, 3000)
})

onBeforeUnmount(() => {
  if (noticeTimer) clearInterval(noticeTimer)
})

/* ---- 用户菜单 ---- */
const userMenuVisible = ref(false)
const avatarChar = computed(() => (auth.session?.username?.charAt(0) ?? 'U').toUpperCase())

const userMenuItems: { key: string; label: string; icon: any }[] = [
  { key: 'system', label: '跟随系统设置', icon: Monitor },
  { key: 'settings', label: '设置', icon: Setting },
  { key: 'tools', label: '工具', icon: Tools },
  { key: 'vip', label: '增值服务', icon: Star },
  { key: 'service', label: '联系轻羽', icon: Service },
  { key: 'achievement', label: '我的成就', icon: Trophy },
]

function onUserMenu(key: string) {
  userMenuVisible.value = false
  if (key === 'system') {
    store.setThemeMode('system')
    toastSuccess('已切换为跟随系统外观')
    return
  }
  store.navigate(key as 'settings' | 'tools' | 'vip' | 'service' | 'achievement')
}

async function onLogout() {
  userMenuVisible.value = false
  try {
    await ElMessageBox.confirm('确定要退出当前账号吗？', '退出登录', {
      type: 'warning',
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  auth.logout()
  toastSuccess('已退出登录')
}

function goHome() {
  store.goHome()
}

function goBack() {
  store.goHome()
}
</script>

<template>
  <header class="topbar" data-tauri-drag-region>
    <el-tooltip v-if="store.page !== 'home'" content="返回" placement="bottom" :show-after="300">
      <button class="icon-btn" @click="goBack">
        <el-icon :size="17"><Back /></el-icon>
      </button>
    </el-tooltip>

    <el-tooltip content="返回首页" placement="bottom" :show-after="300">
      <div
        class="brand"
        data-tauri-drag-region
        role="button"
        tabindex="0"
        @click="goHome"
        @keydown.enter="goHome"
        @keydown.space.prevent="goHome"
      >
        <span class="brand-logo">
          <img src="../assets/logo.png" alt="轻羽RPA" />
        </span>
        <span class="brand-name">轻羽RPA</span>
        <span class="brand-tag">Ai</span>
      </div>
    </el-tooltip>

    <nav v-if="store.page === 'home'" class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: store.tab === tab.key }"
        @click="store.setTab(tab.key)"
      >
        <el-icon :size="15" class="tab-ico"><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <div class="top-spacer" data-tauri-drag-region></div>

    <div class="top-actions">
      <el-tooltip content="设置" placement="bottom" :show-after="300">
        <button class="icon-btn" @click="store.navigate('settings')">
          <el-icon :size="18"><Setting /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="邀请好友" placement="bottom" :show-after="300">
        <button class="icon-btn" @click="store.navigate('invite')">
          <el-icon :size="18" color="#f75661"><Present /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="联系客服" placement="bottom" :show-after="300">
        <button class="icon-btn" @click="store.navigate('service')">
          <el-icon :size="18"><Service /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="帮助中心" placement="bottom" :show-after="300">
        <button class="icon-btn" @click="store.navigate('help')">
          <el-icon :size="17"><QuestionFilled /></el-icon>
        </button>
      </el-tooltip>
      <el-popover
        v-model:visible="noticeVisible"
        placement="bottom-end"
        :width="320"
        trigger="click"
        :show-arrow="false"
        popper-class="notice-popover"
        @show="onNoticeShow"
      >
        <template #reference>
          <button
            class="icon-btn"
            :class="{ 'has-dot': unreadCount > 0 }"
            title="消息中心"
          >
            <el-icon :size="18"><Bell /></el-icon>
          </button>
        </template>
        <div class="notice-panel">
          <div class="notice-panel-head">
            <span class="notice-panel-title">消息通知</span>
            <span class="notice-panel-sub">{{ unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读' }}</span>
          </div>
          <div v-if="panelNotices.length" class="notice-panel-list">
            <div
              v-for="n in panelNotices"
              :key="n.id"
              class="notice-panel-item"
              :class="{ unread: n.unread }"
              role="button"
              tabindex="0"
              @click="readNotice(n)"
              @keydown.enter="readNotice(n)"
            >
              <span v-if="n.unread" class="notice-panel-dot"></span>
              <div class="notice-panel-body">
                <div class="notice-panel-item-title">{{ n.title }}</div>
                <div class="notice-panel-item-desc">{{ n.desc }}</div>
              </div>
              <span class="notice-panel-time">{{ formatNoticeTime(n.time) }}</span>
            </div>
          </div>
          <el-empty v-else :image-size="72" description="暂无消息" />
          <button class="notice-panel-all" @click="goNoticePage">
            全部消息
            <el-icon :size="12"><ArrowRight /></el-icon>
          </button>
        </div>
      </el-popover>

      <el-popover
        v-model:visible="userMenuVisible"
        placement="bottom-end"
        :width="232"
        trigger="click"
        :show-arrow="false"
        popper-class="user-popover"
      >
        <template #reference>
          <button class="avatar" :title="auth.session?.username">{{ avatarChar }}</button>
        </template>
        <div class="user-head">
          <div class="user-avatar">{{ avatarChar }}</div>
          <div class="user-info">
            <div class="user-name">{{ auth.session?.username }}</div>
            <div class="user-phone">{{ auth.maskedPhone }}</div>
          </div>
        </div>
        <div class="user-plan">
          <span class="plan-badge">创业版</span>
          <el-tooltip content="升级套餐" placement="bottom" :show-after="300">
            <span
              class="plan-upgrade"
              role="button"
              tabindex="0"
              @click="onUserMenu('vip')"
              @keydown.enter="onUserMenu('vip')"
            >
              升级
              <el-icon :size="11"><ArrowRight /></el-icon>
            </span>
          </el-tooltip>
          <div class="plan-expire">有效期至 2026-11-29</div>
        </div>
        <div class="user-menu">
          <button
            v-for="item in userMenuItems"
            :key="item.key"
            class="user-menu-item"
            @click="onUserMenu(item.key)"
          >
            <el-icon :size="15"><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
            <el-icon v-if="item.key === 'system' && store.themeMode === 'system'" :size="13" class="menu-check"><Select /></el-icon>
          </button>
          <div class="user-menu-divider"></div>
          <button class="user-menu-item logout" @click="onLogout">
            <el-icon :size="15"><SwitchButton /></el-icon>
            <span>退出登录</span>
          </button>
        </div>
      </el-popover>
    </div>

    <WindowControls />
  </header>
</template>

<style>
/* 用户菜单与消息面板 popper 挂载在 body 下，需使用全局样式 */
.user-popover {
  padding: 14px !important;
  border-radius: 12px !important;
}

.notice-popover {
  padding: 0 !important;
  border-radius: 12px !important;
}

.notice-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notice-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.notice-panel-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.notice-panel-sub {
  font-size: 12px;
  color: var(--text-3);
}

.notice-panel-list {
  max-height: 320px;
  overflow-y: auto;
}

.notice-panel-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px 10px 20px;
  cursor: pointer;
  transition: background 0.15s;
}

.notice-panel-item + .notice-panel-item {
  border-top: 1px solid var(--border);
}

.notice-panel-item:hover {
  background: var(--panel);
}

.notice-panel-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.notice-panel-dot {
  position: absolute;
  left: 10px;
  top: 16px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.notice-panel-body {
  flex: 1;
  min-width: 0;
}

.notice-panel-item-title {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-panel-item.unread .notice-panel-item-title {
  font-weight: 500;
}

.notice-panel-item-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-panel-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-3);
  line-height: 18px;
}

.notice-panel-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 11px 0;
  border: none;
  border-top: 1px solid var(--border);
  background: transparent;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.notice-panel-all:hover {
  background: var(--panel);
  color: var(--accent);
}

.user-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #8b5cf6;
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info {
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-phone {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
}

.user-plan {
  position: relative;
  border-radius: 8px;
  background: #f3efff;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6d4bd8;
}

.plan-upgrade {
  position: absolute;
  right: 12px;
  top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}

.plan-upgrade:hover {
  color: #6d4bd8;
}

.plan-upgrade:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.plan-expire {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-3);
}

.user-menu {
  display: flex;
  flex-direction: column;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text);
  text-align: left;
}

.user-menu-item .el-icon {
  color: var(--text-2);
}

.user-menu-item:hover {
  background: var(--panel);
}

.user-menu-item.logout {
  color: var(--accent);
}

.user-menu-item.logout .el-icon {
  color: var(--accent);
}

.user-menu-item.logout:hover {
  background: var(--accent-soft);
}

.menu-check {
  margin-left: auto;
  color: var(--accent) !important;
}

.user-menu-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}
</style>
