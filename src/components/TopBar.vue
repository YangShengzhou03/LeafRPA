<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import {
  Grid, Lightning, Compass, Reading, Guide, Present, Service,
  QuestionFilled, Bell, ArrowRight, Back,
  Setting, Monitor, Tools, Star, Trophy, SwitchButton, Select,
} from '@element-plus/icons-vue'
import WindowControls from './WindowControls.vue'
import { useAppStore, type TabKey } from '../store'
import { useAuthStore } from '../auth'
import { avatarSrcOrInitial } from '../avatar'
import { toastSuccess } from '../notify'
import { t, type MessageKey } from '../i18n'
import { watch } from 'vue'

const store = useAppStore()
const auth = useAuthStore()

/* ---- 顶栏头像与展示名：来自 /api/users/me 的昵称 / 头像地址，设置页保存后即时同步 ---- */
const avatarDisplay = computed(() => avatarSrcOrInitial(auth.profile?.avatarUrl ?? null, auth.session?.username))
const avatarFailed = ref(false)
watch(
  () => avatarDisplay.value.src,
  () => {
    avatarFailed.value = false
  },
)

const tabs: { key: TabKey; label: MessageKey; icon: any }[] = [
  { key: 'app', label: 'topbar.tab.apps', icon: Grid },
  { key: 'trigger', label: 'topbar.tab.triggers', icon: Lightning },
  { key: 'market', label: 'topbar.tab.market', icon: Compass },
  { key: 'tutorial', label: 'topbar.tab.tutorial', icon: Reading },
  { key: 'community', label: 'topbar.tab.community', icon: Guide },
]

/* ---- 消息小面板：公告服务尚未上线，展示空态并跳转消息中心 ---- */
const noticeVisible = ref(false)

function goNoticePage() {
  noticeVisible.value = false
  store.navigate('notice')
}

/* ---- 用户菜单 ---- */
const userMenuVisible = ref(false)

const userMenuItems: { key: string; label: MessageKey; icon: any }[] = [
  { key: 'system', label: 'topbar.menu.system', icon: Monitor },
  { key: 'settings', label: 'topbar.menu.settings', icon: Setting },
  { key: 'tools', label: 'topbar.menu.tools', icon: Tools },
  { key: 'vip', label: 'topbar.menu.vip', icon: Star },
  { key: 'service', label: 'topbar.menu.service', icon: Service },
  { key: 'achievement', label: 'topbar.menu.achievement', icon: Trophy },
]

function onUserMenu(key: string) {
  userMenuVisible.value = false
  if (key === 'system') {
    store.setThemeMode('system')
    toastSuccess(t('topbar.switchedSystem'))
    return
  }
  store.navigate(key as 'settings' | 'tools' | 'vip' | 'service' | 'achievement')
}

async function onLogout() {
  userMenuVisible.value = false
  try {
    await ElMessageBox.confirm(t('topbar.logoutConfirm'), t('topbar.logoutTitle'), {
      type: 'warning',
      confirmButtonText: t('topbar.logoutBtn'),
      cancelButtonText: t('common.cancel'),
    })
  } catch {
    return
  }
  auth.logout()
  toastSuccess(t('topbar.loggedOut'))
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
    <el-tooltip v-if="store.page !== 'home'" :content="t('topbar.back')" placement="bottom" :show-after="300">
      <button class="icon-btn" @click="goBack">
        <el-icon :size="17"><Back /></el-icon>
      </button>
    </el-tooltip>

    <el-tooltip :content="t('topbar.backHome')" placement="bottom" :show-after="300">
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
          <img src="../assets/logo.png" :alt="t('app.name')" />
        </span>
        <span class="brand-name">{{ t('app.name') }}</span>
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
        <span>{{ t(tab.label) }}</span>
      </button>
    </nav>

    <div class="top-spacer" data-tauri-drag-region></div>

    <div class="top-actions">
      <el-tooltip :content="t('topbar.tipSettings')" placement="bottom" :show-after="300">
        <button class="icon-btn" @click="store.navigate('settings')">
          <el-icon :size="18"><Setting /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip :content="t('topbar.tipInvite')" placement="bottom" :show-after="300">
        <button class="icon-btn" @click="store.navigate('invite')">
          <el-icon :size="18" color="#f75661"><Present /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip :content="t('topbar.tipService')" placement="bottom" :show-after="300">
        <button class="icon-btn" @click="store.navigate('service')">
          <el-icon :size="18"><Service /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip :content="t('topbar.tipHelp')" placement="bottom" :show-after="300">
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
      >
        <template #reference>
          <button class="icon-btn" :title="t('topbar.noticeCenter')">
            <el-icon :size="18"><Bell /></el-icon>
          </button>
        </template>
        <div class="notice-panel">
          <div class="notice-panel-head">
            <span class="notice-panel-title">{{ t('topbar.noticeTitle') }}</span>
          </div>
          <el-empty :image-size="72" :description="t('topbar.noticeEmpty')" />
          <button class="notice-panel-all" @click="goNoticePage">
            {{ t('topbar.noticeAll') }}
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
          <button class="avatar" :title="auth.session?.username">
            <img
              v-if="avatarDisplay.src && !avatarFailed"
              :src="avatarDisplay.src"
              alt=""
              @error="avatarFailed = true"
            />
            <template v-else>{{ avatarDisplay.initial }}</template>
          </button>
        </template>
        <div class="user-head">
          <div class="user-avatar">
            <img
              v-if="avatarDisplay.src && !avatarFailed"
              :src="avatarDisplay.src"
              alt=""
              @error="avatarFailed = true"
            />
            <template v-else>{{ avatarDisplay.initial }}</template>
          </div>
          <div class="user-info">
            <div class="user-name">{{ auth.displayName }}</div>
            <div class="user-phone">{{ auth.session?.username }} · {{ auth.maskedPhone }}</div>
          </div>
        </div>
        <div class="user-plan">
          <span class="plan-badge">{{ t('vip.freeBadge') }}</span>
          <el-tooltip :content="t('topbar.tipUpgrade')" placement="bottom" :show-after="300">
            <span
              class="plan-upgrade"
              role="button"
              tabindex="0"
              @click="onUserMenu('vip')"
              @keydown.enter="onUserMenu('vip')"
            >
              {{ t('topbar.upgrade') }}
              <el-icon :size="11"><ArrowRight /></el-icon>
            </span>
          </el-tooltip>
        </div>
        <div class="user-menu">
          <button
            v-for="item in userMenuItems"
            :key="item.key"
            class="user-menu-item"
            @click="onUserMenu(item.key)"
          >
            <el-icon :size="15"><component :is="item.icon" /></el-icon>
            <span>{{ t(item.label) }}</span>
            <el-icon v-if="item.key === 'system' && store.themeMode === 'system'" :size="13" class="menu-check"><Select /></el-icon>
          </button>
          <div class="user-menu-divider"></div>
          <button class="user-menu-item logout" @click="onLogout">
            <el-icon :size="15"><SwitchButton /></el-icon>
            <span>{{ t('topbar.logout') }}</span>
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
  padding: 16px !important;
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
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.notice-panel-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.notice-panel-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 12px 0;
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
  gap: 12px;
  padding: 0 0 12px;
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
  overflow: hidden;
}

/* 自定义头像图片铺满圆形容器，加载失败回退首字 */
.avatar img,
.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
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
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-3);
}

.user-plan {
  position: relative;
  border-radius: 8px;
  background: #f3efff;
  padding: 12px;
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
  top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.user-menu {
  display: flex;
  flex-direction: column;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
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
  margin: 8px 0;
}
</style>
