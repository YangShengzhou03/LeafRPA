<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '../store'
import { useTriggerStore } from '../triggers'
import { useAuthStore } from '../auth'
import { userApi, type UserProfileFull } from '../api'
import { i18n, t } from '../i18n'
import { Lock, Trophy } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'

const store = useAppStore()
const triggerStore = useTriggerStore()
const auth = useAuthStore()

/* 服务端统计：社区帖子 / 回复计数来自 /api/users/me（未登录或离线时隐藏） */
const serverProfile = ref<UserProfileFull | null>(null)

onMounted(async () => {
  if (!auth.isLoggedIn) return
  try {
    serverProfile.value = await userApi.me()
  } catch {
    serverProfile.value = null
  }
})

const stats = computed(() => {
  const base = [
    { label: t('stats.flows'), value: store.flows.length, suffix: t('stats.flowsUnit') },
    { label: t('stats.triggers'), value: triggerStore.triggers.length, suffix: t('stats.triggersUnit') },
    { label: t('stats.todayRuns'), value: triggerStore.todayRuns, suffix: t('stats.runsUnit') },
    { label: t('stats.totalRuns'), value: triggerStore.history.length, suffix: t('stats.runsUnit') },
  ]
  if (serverProfile.value) {
    base.push(
      { label: t('stats.posts'), value: serverProfile.value.posts, suffix: t('stats.postsUnit') },
      { label: t('stats.replies'), value: serverProfile.value.replies, suffix: t('stats.repliesUnit') },
    )
  }
  return base
})

const daysSinceLogin = computed(() => {
  if (!auth.session) return 0
  return Math.max(1, Math.floor((Date.now() - auth.session.loginAt) / 86400000) + 1)
})

/* 使用起始日：跟随当前语言格式化日期 */
const sinceLabel = computed(() => {
  if (!auth.session) return '—'
  const date = new Date(auth.session.loginAt).toLocaleDateString(i18n.locale)
  return t('achievement.since', { date })
})

interface Badge {
  key: string
  name: string
  desc: string
  unlocked: boolean
  progress: number
}

const badges = computed<Badge[]>(() => {
  const flows = store.flows.length
  const runs = triggerStore.history.length
  const triggers = triggerStore.triggers.length
  const days = daysSinceLogin.value
  return [
    {
      key: 'first-flow',
      name: t('achievement.badge.firstFlow.name'),
      desc: t('achievement.badge.firstFlow.desc'),
      unlocked: flows >= 1,
      progress: Math.min(1, flows / 1),
    },
    {
      key: 'five-flows',
      name: t('achievement.badge.fiveFlows.name'),
      desc: t('achievement.badge.fiveFlows.desc'),
      unlocked: flows >= 5,
      progress: Math.min(1, flows / 5),
    },
    {
      key: 'flow-master',
      name: t('achievement.badge.flowMaster.name'),
      desc: t('achievement.badge.flowMaster.desc'),
      unlocked: flows >= 20,
      progress: Math.min(1, flows / 20),
    },
    {
      key: 'first-run',
      name: t('achievement.badge.firstRun.name'),
      desc: t('achievement.badge.firstRun.desc'),
      unlocked: runs >= 1,
      progress: Math.min(1, runs / 1),
    },
    {
      key: 'hundred-runs',
      name: t('achievement.badge.hundredRuns.name'),
      desc: t('achievement.badge.hundredRuns.desc'),
      unlocked: runs >= 100,
      progress: Math.min(1, runs / 100),
    },
    {
      key: 'scheduler',
      name: t('achievement.badge.scheduler.name'),
      desc: t('achievement.badge.scheduler.desc'),
      unlocked: triggers >= 3,
      progress: Math.min(1, triggers / 3),
    },
    {
      key: 'three-days',
      name: t('achievement.badge.threeDays.name'),
      desc: t('achievement.badge.threeDays.desc'),
      unlocked: days >= 3,
      progress: Math.min(1, days / 3),
    },
    {
      key: 'seven-days',
      name: t('achievement.badge.sevenDays.name'),
      desc: t('achievement.badge.sevenDays.desc'),
      unlocked: days >= 7,
      progress: Math.min(1, days / 7),
    },
  ]
})

const unlockedCount = computed(() => badges.value.filter((b) => b.unlocked).length)

const nextBadge = computed(() => badges.value.find((b) => !b.unlocked) ?? null)
</script>

<template>
  <PageShell :title="t('achievement.title')" :kicker="t('achievement.kicker')" :sub="t('achievement.sub')">
    <div class="ach-layout">
      <div class="ach-main">
        <div class="stat-row">
          <div v-for="s in stats" :key="s.label" class="stat-card">
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value">
              {{ s.value }}<span class="stat-suffix">{{ s.suffix }}</span>
            </div>
          </div>
        </div>

        <section class="sec-card">
          <div class="sec-card-head">
            <h2 class="sec-title">{{ t('achievement.progressTitle') }}</h2>
            <span class="sec-meta">{{ unlockedCount }} / {{ badges.length }}</span>
          </div>
          <el-progress
            class="ach-progress"
            :percentage="Math.round((unlockedCount / badges.length) * 100)"
            :stroke-width="10"
          />
        </section>

        <div class="badge-grid">
          <div
            v-for="b in badges"
            :key="b.key"
            class="sec-card badge"
            :class="{ locked: !b.unlocked }"
          >
            <div class="badge-icon" :class="{ on: b.unlocked }">
              <el-icon :size="14"><component :is="b.unlocked ? Trophy : Lock" /></el-icon>
            </div>
            <div class="badge-name">{{ b.name }}</div>
            <div class="badge-desc">{{ b.desc }}</div>
            <el-progress
              v-if="!b.unlocked"
              class="badge-progress"
              :percentage="Math.round(b.progress * 100)"
              :stroke-width="4"
              :show-text="false"
            />
            <span v-else class="badge-done">{{ t('achievement.unlocked') }}</span>
          </div>
        </div>
      </div>

      <aside class="ach-side">
        <section class="sec-card">
          <h2 class="sec-title">{{ t('achievement.daysTitle') }}</h2>
          <div class="day-count">{{ daysSinceLogin }}</div>
          <div class="sec-meta day-label">{{ sinceLabel }}</div>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">{{ t('achievement.nextTitle') }}</h2>
          <template v-if="nextBadge">
            <div class="next-name">{{ nextBadge.name }}</div>
            <div class="next-desc">{{ nextBadge.desc }}</div>
            <el-progress
              :percentage="Math.round(nextBadge.progress * 100)"
              :stroke-width="8"
            />
          </template>
          <el-empty v-else :description="t('achievement.allUnlocked')" :image-size="72" />
        </section>
      </aside>
    </div>
  </PageShell>
</template>

<style scoped>
.ach-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

.ach-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-row {
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 0;
}

.stat-suffix {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-3);
}

.ach-progress {
  margin-top: 16px;
}

.badge-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.badge {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.badge.locked {
  opacity: 0.55;
}

.badge-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--panel);
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-icon.on {
  background: var(--accent-soft);
  color: var(--accent);
}

.badge-name {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.badge-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
  flex: 1;
}

.badge-progress {
  margin-top: 8px;
  width: 100%;
}

.badge-done {
  margin-top: 8px;
  font-size: 12px;
  color: var(--accent);
}

.ach-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.day-count {
  margin-top: 12px;
  font-size: 32px;
  font-weight: 600;
  color: var(--text);
  line-height: 1;
}

.day-label {
  margin-top: 8px;
}

.next-name {
  margin-top: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.next-desc {
  margin: 8px 0 12px;
  font-size: 12px;
  color: var(--text-3);
}
</style>
