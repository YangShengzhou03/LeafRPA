<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import { copyText } from '../clipboard'
import { toastSuccess, toastWarning } from '../notify'
import PageShell from '../components/PageShell.vue'
import * as bridge from '../bridge'

const store = useAppStore()
const REPO_URL = 'https://gitee.com/Yangshengzhou/leaf-rpa'
const ISSUE_URL = `${REPO_URL}/issues`
const SUPPORT_EMAIL = 'support@leaf-rpa.dev'

const channels = [
  {
    key: 'repo',
    title: '开源仓库 Issues',
    desc: '提交 Bug、功能建议或使用问题，开发者会直接在仓库中回复。',
    action: '打开仓库',
  },
  {
    key: 'email',
    title: '邮件支持',
    desc: '将问题描述发送到支持邮箱，通常在 1 个工作日内回复。',
    action: '复制邮箱',
  },
  {
    key: 'doc',
    title: '帮助文档',
    desc: '查看常见问题与使用教程，快速上手轻羽 RPA。',
    action: '查看帮助',
  },
]

const topic = ref('使用问题')
const title = ref('')
const desc = ref('')
const sending = ref(false)

const topics = ['使用问题', '功能建议', 'Bug 反馈', '增值服务咨询', '其他']

const canSend = computed(() => title.value.trim().length > 0 && desc.value.trim().length > 0)

async function onChannel(key: string) {
  if (key === 'repo') {
    await bridge.openInBrowser(ISSUE_URL)
    return
  }
  if (key === 'email') {
    if (await copyText(SUPPORT_EMAIL)) toastSuccess('支持邮箱已复制')
    else toastWarning('复制失败，请手动复制')
    return
  }
  store.navigate('help')
}

async function copyIssueUrl() {
  if (await copyText(ISSUE_URL)) toastSuccess('反馈地址已复制')
  else toastWarning('复制失败，请手动复制')
}

async function sendFeedback() {
  if (!canSend.value) {
    toastWarning('请填写标题与问题描述')
    return
  }
  sending.value = true
  try {
    const text = [
      `【${topic.value}】${title.value.trim()}`,
      '',
      desc.value.trim(),
      '',
      '---',
      `应用版本：轻羽 RPA v0.1.0`,
      `操作系统：${navigator.platform || '未知'}`,
      `提交时间：${new Date().toLocaleString('zh-CN')}`,
    ].join('\n')
    if (await copyText(text)) {
      toastSuccess('反馈内容已复制，请粘贴到仓库 Issues 或邮件中发送')
      title.value = ''
      desc.value = ''
    } else {
      toastWarning('复制失败，请手动选择并复制反馈内容')
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <PageShell title="联系客服" kicker="支持渠道" sub="我们通过开源社区提供支持，所有反馈都会被认真对待">
    <div class="service-layout">
      <div class="service-left">
        <p class="service-note">
          轻羽 RPA 是开源项目，没有客服工单系统。你可以通过以下渠道获得帮助。
        </p>

        <section class="sec-card">
          <h2 class="sec-title">支持渠道</h2>
          <div class="channel-list">
            <button
              v-for="c in channels"
              :key="c.key"
              type="button"
              class="channel"
              @click="onChannel(c.key)"
            >
              <span class="channel-body">
                <span class="channel-head">
                  <span class="channel-title">{{ c.title }}</span>
                  <span class="channel-action">
                    {{ c.action }}
                    <el-icon :size="12"><ArrowRight /></el-icon>
                  </span>
                </span>
                <span class="channel-desc">{{ c.desc }}</span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <section class="sec-card service-form">
        <h2 class="sec-title">问题反馈</h2>
        <el-form class="service-form-body" label-position="top" @submit.prevent>
          <el-form-item label="问题类型">
            <el-select v-model="topic" style="width: 100%">
              <el-option v-for="t in topics" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="标题">
            <el-input v-model="title" maxlength="60" show-word-limit placeholder="一句话描述问题" />
          </el-form-item>
          <el-form-item label="详细描述">
            <el-input
              v-model="desc"
              type="textarea"
              :rows="5"
              maxlength="800"
              show-word-limit
              placeholder="请说明操作步骤、预期结果与实际结果"
            />
          </el-form-item>
          <div class="service-form-foot">
            <el-button @click="copyIssueUrl">复制反馈地址</el-button>
            <el-button type="primary" :loading="sending" :disabled="!canSend" @click="sendFeedback">
              生成并复制反馈内容
            </el-button>
          </div>
        </el-form>
      </section>
    </div>
  </PageShell>
</template>

<style scoped>
.service-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 16px;
  align-items: start;
}

.service-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.service-note {
  margin: 0;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--panel);
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}

.channel-list {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}

.channel {
  display: block;
  width: 100%;
  padding: 10px 0;
  border: none;
  border-top: 1px solid var(--border);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.channel:first-child {
  border-top: none;
}

.channel:hover .channel-title,
.channel:hover .channel-action {
  color: var(--accent);
}

.channel-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.channel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.channel-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  transition: color 0.15s;
}

.channel-desc {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.6;
}

.channel-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-3);
  transition: color 0.15s;
}

.service-form-body {
  margin-top: 8px;
}

.service-form-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
