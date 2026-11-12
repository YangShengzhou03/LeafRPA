<script setup lang="ts">
import { computed, ref } from 'vue'
import { VideoPlay, ArrowRight, ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import { toastSuccess } from '../notify'

const store = useAppStore()

interface Tutorial {
  id: string
  title: string
  desc: string
  level: '入门' | '进阶' | '实战'
  minutes: number
  color: string
}

const categories = ['全部', '入门', '进阶', '实战']

const tutorials: Tutorial[] = [
  { id: '1', title: '5 分钟创建第一个自动化流程', desc: '从零开始，完成一个网页打开与数据填写的演示流程。', level: '入门', minutes: 5, color: '#3b6fe0' },
  { id: '2', title: '认识指令面板与参数配置', desc: '了解常用指令分类，学会配置参数与变量。', level: '入门', minutes: 8, color: '#22c55e' },
  { id: '3', title: '流程的调试与日志排查', desc: '使用单步执行、断点与运行日志定位问题。', level: '进阶', minutes: 12, color: '#f97154' },
  { id: '4', title: '循环与条件分支的最佳实践', desc: '用循环遍历数据，用条件判断处理异常分支。', level: '进阶', minutes: 15, color: '#a05ff7' },
  { id: '5', title: '网页元素定位详解', desc: '掌握选择器、XPath 与元素等待策略。', level: '进阶', minutes: 18, color: '#0ea5e9' },
  { id: '6', title: '实战：电商订单自动处理', desc: '串联抓取、判断、写入，完成一个完整的业务闭环。', level: '实战', minutes: 25, color: '#ec4899' },
  { id: '7', title: '实战：财务发票批量录入', desc: '结合 OCR 与表格写入，实现发票自动入账。', level: '实战', minutes: 30, color: '#f59e0b' },
  { id: '8', title: '实战：定时触发与异常告警', desc: '配置定时任务，失败时自动发送通知。', level: '实战', minutes: 22, color: '#6366f1' },
]

const activeCat = ref('全部')

const filtered = computed(() =>
  activeCat.value === '全部' ? tutorials : tutorials.filter((t) => t.level === activeCat.value),
)

function levelTag(level: Tutorial['level']) {
  return level === '入门' ? 'success' : level === '进阶' ? 'primary' : 'warning'
}

/* ---- 学习进度（本地持久化） ---- */
const PROGRESS_KEY = 'leaf-rpa.tutorialProgress.v1'

function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...learned.value]))
  } catch {
    /* 忽略本地存储失败 */
  }
}

const learned = ref<Set<string>>(loadProgress())
const progressPercent = computed(() =>
  tutorials.length ? Math.round((learned.value.size / tutorials.length) * 100) : 0,
)

function toggleLearned(t: Tutorial) {
  const next = new Set(learned.value)
  if (next.has(t.id)) {
    next.delete(t.id)
  } else {
    next.add(t.id)
  }
  learned.value = next
  saveProgress()
}

const detailView = ref(false)
const detail = ref<Tutorial | null>(null)

function openDetail(t: Tutorial) {
  detail.value = t
  detailView.value = true
}

function closeDetail() {
  detailView.value = false
  detail.value = null
}

/** 在设计器中新建一个以该教程命名的流程，边学边练 */
function practice() {
  if (!detail.value) return
  store.createAndOpen(`练习：${detail.value.title}`, 'pc')
  toastSuccess(`已创建练习流程「${detail.value.title}」`, { title: '开始练习', duration: 2600 })
  closeDetail()
}
</script>

<template>
  <section class="page">
    <template v-if="!detailView">
      <div class="page-head">
        <div class="page-head-main">
          <div class="page-kicker">边学边练</div>
          <h1 class="page-title">教程</h1>
          <p class="page-sub">从入门到实战，系统掌握轻羽 RPA</p>
        </div>
        <div class="tut-progress">
          <div class="tut-progress-text">
            已学 {{ learned.size }} / {{ tutorials.length }}
            <span class="tut-progress-pct">{{ progressPercent }}%</span>
          </div>
          <el-progress :percentage="progressPercent" :stroke-width="8" style="width: 180px" />
        </div>
      </div>

      <el-radio-group v-model="activeCat" class="cat-group">
        <el-radio-button v-for="c in categories" :key="c" :value="c">{{ c }}</el-radio-button>
      </el-radio-group>

      <div v-if="filtered.length === 0" class="tut-empty">
        <el-empty description="该分类下暂无教程，换个分类看看" :image-size="96" />
      </div>

      <div v-else class="card-grid">
        <div
          v-for="t in filtered"
          :key="t.id"
          class="tut-card"
          role="button"
          tabindex="0"
          @click="openDetail(t)"
          @keydown.enter="openDetail(t)"
        >
          <div class="tut-cover" :style="{ background: t.color }">
            <el-icon :size="18" color="#fff"><VideoPlay /></el-icon>
            <span class="tut-minutes">{{ t.minutes }} 分钟</span>
          </div>
          <div class="tut-body">
            <div class="tut-title">{{ t.title }}</div>
            <div class="tut-desc">{{ t.desc }}</div>
            <div class="tut-foot">
              <el-tag :type="levelTag(t.level)" effect="light" round>{{ t.level }}</el-tag>
              <el-tag
                v-if="learned.has(t.id)"
                type="success"
                effect="plain"
                round
              >
                已学
              </el-tag>
              <span class="tut-link">
                {{ learned.has(t.id) ? '继续学习' : '开始学习' }}
                <el-icon :size="13"><ArrowRight /></el-icon>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="detail">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="closeDetail">返回教程</el-button>
      </div>
      <div class="detail-card sec-card">
        <div class="detail-head">
          <div class="detail-cover" :style="{ background: detail.color }">
            <el-icon :size="24" color="#fff"><VideoPlay /></el-icon>
          </div>
          <h2 class="detail-title">{{ detail.title }}</h2>
          <div class="detail-meta">
            <el-tag :type="levelTag(detail.level)" effect="light" round>
              {{ detail.level }}
            </el-tag>
            <span class="detail-minutes">约 {{ detail.minutes }} 分钟</span>
          </div>
        </div>
        <p class="detail-desc">{{ detail.desc }}</p>
        <p class="detail-note">
          本教程为示例内容，点击下方按钮即可在设计器中创建配套练习流程，边学边练。
        </p>
        <div class="detail-actions">
          <el-button @click="detail && toggleLearned(detail)">
            {{ detail && learned.has(detail.id) ? '取消已学' : '标记为已学' }}
          </el-button>
          <el-button type="primary" @click="practice">打开设计器练习</el-button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* ---- 页头 ---- */
.tut-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.tut-progress-text {
  font-size: 13px;
  color: var(--text-2);
}

.tut-progress-pct {
  margin-left: 4px;
  color: var(--text-3);
}

.tut-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ---- 教程详情 ---- */
.detail-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-head {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 14px;
  align-items: center;
}

.detail-cover {
  grid-row: 1 / span 2;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-minutes {
  font-size: 12px;
  color: var(--text-3);
}

.detail-desc {
  margin: 12px 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.7;
}

.detail-note {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.7;
  background: var(--panel);
  border-radius: 8px;
}

.tut-empty {
  padding: 40px 0;
}
</style>

