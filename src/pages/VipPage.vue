<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAppStore } from '../store'
import { useAuthStore } from '../auth'
import { userApi, type UserProfileFull } from '../api'
import { avatarSrcOrInitial } from '../avatar'
import { t } from '../i18n'
import PageShell from '../components/PageShell.vue'

const store = useAppStore()
const auth = useAuthStore()

/* 当前用户资料：昵称 / 头像来自服务端，未登录或离线时回退本地会话 */
const profile = ref<UserProfileFull | null>(null)

onMounted(async () => {
  if (!auth.isLoggedIn) return
  try {
    profile.value = await userApi.me()
  } catch {
    profile.value = null
  }
})

const displayName = computed(() => {
  if (profile.value) return profile.value.nickname || profile.value.username
  return auth.session?.username ?? ''
})

/* 头像：有自定义图片 URL 用图片，否则回退用户名首字；加载失败时同样回退 */
const avatar = computed(() => avatarSrcOrInitial(profile.value?.avatarUrl, displayName.value))
const avatarImgFailed = ref(false)
watch(() => avatar.value.src, () => {
  avatarImgFailed.value = false
})

/* 真实用量数据：本地流程数与运行日志条数（无虚构额度与百分比） */
const usageStats = computed(() => [
  { label: t('stats.flows'), value: store.flows.length, suffix: t('stats.flowsUnit') },
  { label: t('stats.logs'), value: store.logs.length, suffix: t('stats.logsUnit') },
])
</script>

<template>
  <PageShell :title="t('vip.title')" :kicker="t('vip.kicker')" :sub="t('vip.sub')">
    <div class="vip-layout">
      <div class="vip-main">
        <section class="sec-card">
          <h2 class="sec-title">{{ t('vip.currentVersion') }}</h2>
          <div class="plan-current">
            <span class="current-avatar">
              <img
                v-if="avatar.src && !avatarImgFailed"
                :src="avatar.src"
                alt=""
                @error="avatarImgFailed = true"
              />
              <template v-else>{{ avatar.initial }}</template>
            </span>
            <div class="current-info">
              <div class="current-name">{{ displayName || t('vip.notLoggedIn') }}</div>
              <div class="sec-meta">{{ auth.session?.username || t('vip.loginHint') }}</div>
            </div>
            <span class="current-badge">{{ t('vip.freeBadge') }}</span>
          </div>
          <p class="sec-meta plan-hint">{{ t('vip.freeHint') }}</p>
        </section>

        <section class="sec-card">
          <div class="sec-card-head">
            <h2 class="sec-title">{{ t('vip.paidPlans') }}</h2>
          </div>
          <el-empty :image-size="88" :description="t('vip.paidEmpty')" />
          <p class="sec-meta plan-hint">{{ t('vip.paidHint') }}</p>
        </section>
      </div>

      <aside class="vip-side">
        <section class="sec-card">
          <h2 class="sec-title">{{ t('vip.usageTitle') }}</h2>
          <div class="usage-rows">
            <div v-for="s in usageStats" :key="s.label" class="usage-row">
              <span class="usage-label">{{ s.label }}</span>
              <span class="usage-value">
                {{ s.value }}<span class="usage-suffix">{{ s.suffix }}</span>
              </span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </PageShell>
</template>

<style scoped>
.vip-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

.vip-main,
.vip-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* 当前版本卡片：头像 + 昵称 + 版本徽标 */
.plan-current {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.current-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
  user-select: none;
}

.current-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.current-info {
  flex: 1;
  min-width: 0;
}

.current-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-badge {
  flex-shrink: 0;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
}

.plan-hint {
  margin: 12px 0 0;
}

/* 使用数据：真实计数，无虚构进度条 */
.usage-rows {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
}

.usage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  border-top: 1px solid var(--border);
}

.usage-row:first-child {
  border-top: none;
}

.usage-label {
  font-size: 13px;
  color: var(--text);
}

.usage-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.usage-suffix {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}
</style>
