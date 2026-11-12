<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../store'
import { useTriggerStore } from '../triggers'
import { useAuthStore } from '../auth'
import { Lock, Trophy } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'

const store = useAppStore()
const triggerStore = useTriggerStore()
const auth = useAuthStore()

const stats = computed(() => [
  { label: '已创建流程', value: store.flows.length, suffix: '个' },
  { label: '触发器数量', value: triggerStore.triggers.length, suffix: '个' },
  { label: '今日运行', value: triggerStore.todayRuns, suffix: '次' },
  { label: '累计运行', value: triggerStore.history.length, suffix: '次' },
])

const daysSinceLogin = computed(() => {
  if (!auth.session) return 0
  return Math.max(1, Math.floor((Date.now() - auth.session.loginAt) / 86400000) + 1)
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
      name: '初出茅庐',
      desc: '创建第 1 个流程',
      unlocked: flows >= 1,
      progress: Math.min(1, flows / 1),
    },
    {
      key: 'five-flows',
      name: '小有产出',
      desc: '创建 5 个流程',
      unlocked: flows >= 5,
      progress: Math.min(1, flows / 5),
    },
    {
      key: 'flow-master',
      name: '流程大师',
      desc: '创建 20 个流程',
      unlocked: flows >= 20,
      progress: Math.min(1, flows / 20),
    },
    {
      key: 'first-run',
      name: '第一次运行',
      desc: '完成 1 次流程运行',
      unlocked: runs >= 1,
      progress: Math.min(1, runs / 1),
    },
    {
      key: 'hundred-runs',
      name: '百次运行',
      desc: '累计运行 100 次',
      unlocked: runs >= 100,
      progress: Math.min(1, runs / 100),
    },
    {
      key: 'scheduler',
      name: '调度达人',
      desc: '创建 3 个触发器',
      unlocked: triggers >= 3,
      progress: Math.min(1, triggers / 3),
    },
    {
      key: 'three-days',
      name: '三日留存',
      desc: '连续使用 3 天',
      unlocked: days >= 3,
      progress: Math.min(1, days / 3),
    },
    {
      key: 'seven-days',
      name: '七日留存',
      desc: '连续使用 7 天',
      unlocked: days >= 7,
      progress: Math.min(1, days / 7),
    },
  ]
})

const unlockedCount = computed(() => badges.value.filter((b) => b.unlocked).length)

const nextBadge = computed(() => badges.value.find((b) => !b.unlocked) ?? null)
</script>

<template>
  <PageShell title="我的成就" kicker="成长足迹" sub="记录你在轻羽 RPA 中的成长轨迹">
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
            <h2 class="sec-title">成就进度</h2>
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
            <span v-else class="badge-done">已解锁</span>
          </div>
        </div>
      </div>

      <aside class="ach-side">
        <section class="sec-card">
          <h2 class="sec-title">使用天数</h2>
          <div class="day-count">{{ daysSinceLogin }}</div>
          <div class="sec-meta day-label">
            自 {{ auth.session ? new Date(auth.session.loginAt).toLocaleDateString('zh-CN') : '—' }} 起
          </div>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">下一个成就</h2>
          <template v-if="nextBadge">
            <div class="next-name">{{ nextBadge.name }}</div>
            <div class="next-desc">{{ nextBadge.desc }}</div>
            <el-progress
              :percentage="Math.round(nextBadge.progress * 100)"
              :stroke-width="8"
            />
          </template>
          <el-empty v-else description="全部成就已解锁" :image-size="72" />
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
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 0;
}

.stat-suffix {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-3);
}

.ach-progress {
  margin-top: 14px;
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
  margin-top: 10px;
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
  margin-top: 10px;
  width: 100%;
}

.badge-done {
  margin-top: 10px;
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
  margin: 6px 0 12px;
  font-size: 12px;
  color: var(--text-3);
}
</style>
