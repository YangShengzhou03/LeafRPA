<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toastInfo, toastSuccess } from '../notify'
import PageShell from '../components/PageShell.vue'

interface Notice {
  id: string
  title: string
  desc: string
  time: number
  unread: boolean
  category: '运行' | '市场' | '社区' | '系统'
}

const STORAGE_KEY = 'leaf-rpa.notices'

const seed: Notice[] = [
  {
    id: 'n1',
    title: '流程运行成功',
    desc: '「登录流程」已运行完成，共 6 个步骤，耗时 8.4 秒。',
    time: Date.now() - 10 * 60 * 1000,
    unread: true,
    category: '运行',
  },
  {
    id: 'n2',
    title: '市场安装提醒',
    desc: '你安装的应用「网页数据抓取」有可用更新，建议升级到最新版本。',
    time: Date.now() - 2 * 60 * 60 * 1000,
    unread: true,
    category: '市场',
  },
  {
    id: 'n3',
    title: '社区回复',
    desc: '青梧 回复了你的帖子「定时触发器不执行？」：可以检查一下调度器是否在前台。',
    time: Date.now() - 26 * 60 * 60 * 1000,
    unread: false,
    category: '社区',
  },
  {
    id: 'n4',
    title: '版本更新',
    desc: '轻羽 RPA v0.1.0 已发布，新增子流程与智能录制能力。',
    time: Date.now() - 3 * 24 * 60 * 60 * 1000,
    unread: false,
    category: '系统',
  },
]

const notices = ref<Notice[]>([])
const tab = ref<'全部' | '未读'>('全部')

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      notices.value = JSON.parse(raw) as Notice[]
      return
    }
  } catch {
    /* 数据损坏时回落到默认消息 */
  }
  notices.value = seed
  persist()
})

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notices.value))
}

const filtered = computed(() =>
  tab.value === '未读' ? notices.value.filter((n) => n.unread) : notices.value,
)

const unreadCount = computed(() => notices.value.filter((n) => n.unread).length)

function formatTime(t: number) {
  const diff = Date.now() - t
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  return new Date(t).toLocaleDateString('zh-CN')
}

function readNotice(n: Notice) {
  if (!n.unread) return
  n.unread = false
  persist()
}

function readAll() {
  notices.value.forEach((n) => (n.unread = false))
  persist()
  toastSuccess('已全部标记为已读')
}

function clearAll() {
  notices.value = []
  persist()
  toastInfo('消息已清空')
}

function removeNotice(id: string) {
  notices.value = notices.value.filter((n) => n.id !== id)
  persist()
}
</script>

<template>
  <PageShell title="消息中心" kicker="系统通知" sub="查看运行结果、市场动态与社区互动">
    <div class="notice-wrap">
      <div class="notice-toolbar">
        <el-radio-group v-model="tab">
          <el-radio-button value="全部">全部（{{ notices.length }}）</el-radio-button>
          <el-radio-button value="未读">未读（{{ unreadCount }}）</el-radio-button>
        </el-radio-group>
        <div class="notice-head-actions">
          <el-button link type="primary" :disabled="unreadCount === 0" @click="readAll">
            全部已读
          </el-button>
          <el-button link type="danger" :disabled="!notices.length" @click="clearAll">
            清空消息
          </el-button>
        </div>
      </div>

      <section v-if="filtered.length" class="sec-card notice-card">
        <div
          v-for="n in filtered"
          :key="n.id"
          class="notice-row"
          :class="{ unread: n.unread }"
          role="button"
          tabindex="0"
          @click="readNotice(n)"
          @keydown.enter="readNotice(n)"
        >
          <span class="notice-badge">{{ n.category }}</span>
          <div class="notice-body">
            <div class="notice-title">
              {{ n.title }}
              <span v-if="n.unread" class="notice-dot"></span>
            </div>
            <div class="notice-desc">{{ n.desc }}</div>
          </div>
          <span class="notice-time">{{ formatTime(n.time) }}</span>
          <el-tooltip content="删除消息" placement="top" :show-after="300">
            <el-button class="row-x" text @click.stop="removeNotice(n.id)">×</el-button>
          </el-tooltip>
        </div>
      </section>
      <el-empty
        v-else
        :image-size="96"
        :description="tab === '未读' ? '没有未读消息' : '暂无消息'"
      />
    </div>
  </PageShell>
</template>

<style scoped>
.notice-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.notice-head-actions {
  display: flex;
  align-items: center;
}

.notice-card {
  padding: 2px 0;
}

.notice-card:hover {
  box-shadow: none;
}

.notice-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}

.notice-row:first-child {
  border-top: none;
}

.notice-row:hover {
  background: var(--panel);
}

.notice-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.notice-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 16px;
  background: var(--panel);
  color: var(--text-2);
}

.notice-row.unread .notice-badge {
  background: var(--accent-soft);
  color: var(--accent);
}

.notice-body {
  flex: 1;
  min-width: 0;
}

.notice-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text);
}

.notice-row.unread .notice-title {
  font-weight: 500;
}

.notice-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.notice-desc {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-3);
}
</style>
