<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { copyText } from '../clipboard'
import { toastSuccess, toastWarning } from '../notify'
import PageShell from '../components/PageShell.vue'

const INVITE_CODE = 'QYRPA-2026-LEAF'
const REPO_URL = 'https://gitee.com/Yangshengzhou/leaf-rpa'

interface InviteRecord {
  name: string
  time: number
  rewarded: boolean
}

const STORAGE_KEY = 'leaf-rpa.invites'
const records = ref<InviteRecord[]>([])

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) records.value = JSON.parse(raw) as InviteRecord[]
  } catch {
    records.value = []
  }
})

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.value))
}

const inviteLink = computed(() => `${REPO_URL}?invite=${INVITE_CODE}`)
const shareText = computed(
  () =>
    `我在用轻羽 RPA 做自动化，输入邀请码 ${INVITE_CODE} 注册，我们都能获得额外的运行时长奖励。`,
)

const rewardSteps = [
  { title: '分享邀请码', desc: '把邀请码或邀请链接发给朋友' },
  { title: '好友注册并完成一次运行', desc: '好友使用邀请码注册，并成功运行任意流程' },
  { title: '双方获得奖励', desc: '奖励会自动发放到双方账号的运行额度中' },
]

async function copyCode() {
  if (await copyText(INVITE_CODE)) toastSuccess('邀请码已复制')
  else toastWarning('复制失败，请手动复制')
}

async function copyLink() {
  if (await copyText(inviteLink.value)) toastSuccess('邀请链接已复制')
  else toastWarning('复制失败，请手动复制')
}

async function copyShareText() {
  if (await copyText(shareText.value)) toastSuccess('分享文案已复制')
  else toastWarning('复制失败，请手动复制')
}

function addRecord() {
  const name = `好友 ${records.value.length + 1}`
  records.value.unshift({ name, time: Date.now(), rewarded: false })
  persist()
  toastSuccess('已记录一次邀请，奖励将在好友完成运行后发放')
}

function removeRecord(index: number) {
  records.value.splice(index, 1)
  persist()
}

function formatTime(t: number) {
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <PageShell title="邀请好友" kicker="邀请有礼" sub="分享邀请码，与朋友一起体验自动化的乐趣">
    <div class="invite-layout">
      <div class="invite-main">
        <section class="sec-card">
          <h2 class="sec-title">我的邀请码</h2>
          <div class="code-box">
            <span class="code-text">{{ INVITE_CODE }}</span>
            <el-button type="primary" plain @click="copyCode">复制邀请码</el-button>
          </div>
          <div class="link-box">
            <span class="link-text" :title="inviteLink">{{ inviteLink }}</span>
            <el-button link type="primary" @click="copyLink">复制链接</el-button>
          </div>
          <p class="sec-meta invite-tip">
            邀请码仅在注册时可用一次。好友使用你的邀请码注册并完成首次运行后，
            双方都会获得额外的运行额度奖励。
          </p>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">分享文案</h2>
          <p class="share-text">{{ shareText }}</p>
          <el-button plain @click="copyShareText">复制分享文案</el-button>
        </section>
      </div>

      <aside class="invite-side">
        <section class="sec-card">
          <h2 class="sec-title">奖励规则</h2>
          <ol class="steps">
            <li v-for="(s, i) in rewardSteps" :key="s.title" class="step">
              <span class="step-no">{{ i + 1 }}</span>
              <div class="step-name">{{ s.title }}</div>
              <div class="step-desc">{{ s.desc }}</div>
            </li>
          </ol>
        </section>

        <section class="sec-card">
          <div class="sec-card-head">
            <h2 class="sec-title">邀请记录</h2>
            <span class="sec-meta">{{ records.length }} 条</span>
          </div>
          <el-empty v-if="!records.length" description="还没有邀请记录" :image-size="72" />
          <ul v-else class="record-list">
            <li v-for="(r, i) in records" :key="`${r.time}-${i}`" class="record-item">
              <div class="record-body">
                <div class="record-name">{{ r.name }}</div>
                <div class="sec-meta">{{ formatTime(r.time) }}</div>
              </div>
              <el-tag :type="r.rewarded ? 'success' : 'info'" effect="plain">
                {{ r.rewarded ? '已奖励' : '待完成' }}
              </el-tag>
              <el-tooltip content="移除记录" placement="top" :show-after="300">
                <el-button class="row-x" text @click="removeRecord(i)">×</el-button>
              </el-tooltip>
            </li>
          </ul>
          <el-button class="record-add" plain @click="addRecord">
            模拟一次邀请记录
          </el-button>
        </section>
      </aside>
    </div>
  </PageShell>
</template>

<style scoped>
.invite-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}

.invite-main,
.invite-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.code-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--panel);
  margin-top: 14px;
}

.code-text {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 1px;
  color: var(--accent);
}

.link-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-top: 10px;
}

.link-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-3);
}

.invite-tip {
  margin: 12px 0 0;
}

.share-text {
  margin: 12px 0 14px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.7;
}

.record-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.record-item:first-child {
  border-top: none;
  margin-top: 4px;
}

.record-body {
  flex: 1;
  min-width: 0;
}

.record-name {
  font-size: 13px;
  color: var(--text);
}

.record-add {
  width: 100%;
}
</style>
