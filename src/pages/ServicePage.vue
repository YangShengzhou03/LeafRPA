<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import { copyText } from '../clipboard'
import { toastSuccess, toastWarning } from '../notify'
import PageShell from '../components/PageShell.vue'
import * as bridge from '../bridge'
import { t, type MessageKey } from '../i18n'

const store = useAppStore()
const REPO_URL = 'https://gitee.com/Yangshengzhou/leaf-rpa'
const ISSUE_URL = `${REPO_URL}/issues`
const SUPPORT_EMAIL = 'support@leaf-rpa.dev'

const channels: { key: string; title: MessageKey; desc: MessageKey; action: MessageKey }[] = [
  {
    key: 'repo',
    title: 'service.channel.repo.title',
    desc: 'service.channel.repo.desc',
    action: 'service.channel.repo.action',
  },
  {
    key: 'email',
    title: 'service.channel.email.title',
    desc: 'service.channel.email.desc',
    action: 'service.channel.email.action',
  },
  {
    key: 'doc',
    title: 'service.channel.doc.title',
    desc: 'service.channel.doc.desc',
    action: 'service.channel.doc.action',
  },
]

const topic = ref('使用问题')
const title = ref('')
const desc = ref('')
const sending = ref(false)

/** 问题类型值（拼入反馈文本）→ 显示文案 */
const topics = ['使用问题', '功能建议', 'Bug 反馈', '增值服务咨询', '其他']
const TOPIC_KEYS: Record<string, MessageKey> = {
  使用问题: 'service.topic.usage',
  功能建议: 'service.topic.feature',
  'Bug 反馈': 'service.topic.bug',
  增值服务咨询: 'service.topic.vip',
  其他: 'service.topic.other',
}
const topicLabel = (v: string) => t(TOPIC_KEYS[v] ?? 'service.topic.other')

const canSend = computed(() => title.value.trim().length > 0 && desc.value.trim().length > 0)

async function onChannel(key: string) {
  if (key === 'repo') {
    await bridge.openInBrowser(ISSUE_URL)
    return
  }
  if (key === 'email') {
    if (await copyText(SUPPORT_EMAIL)) toastSuccess(t('service.emailCopied'))
    else toastWarning(t('common.copyFailed'))
    return
  }
  store.navigate('help')
}

async function copyIssueUrl() {
  if (await copyText(ISSUE_URL)) toastSuccess(t('service.issueCopied'))
  else toastWarning(t('common.copyFailed'))
}

async function sendFeedback() {
  if (!canSend.value) {
    toastWarning(t('service.fillRequired'))
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
      toastSuccess(t('service.feedbackCopied'))
      title.value = ''
      desc.value = ''
    } else {
      toastWarning(t('service.copyFailedSelect'))
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <PageShell :title="t('service.title')" :kicker="t('service.kicker')" :sub="t('service.sub')">
    <div class="service-layout">
      <div class="service-left">
        <p class="service-note">
          {{ t('service.note') }}
        </p>

        <section class="sec-card">
          <h2 class="sec-title">{{ t('service.channelsTitle') }}</h2>
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
                  <span class="channel-title">{{ t(c.title) }}</span>
                  <span class="channel-action">
                    {{ t(c.action) }}
                    <el-icon :size="12"><ArrowRight /></el-icon>
                  </span>
                </span>
                <span class="channel-desc">{{ t(c.desc) }}</span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <section class="sec-card service-form">
        <h2 class="sec-title">{{ t('service.formTitle') }}</h2>
        <el-form class="service-form-body" label-position="top" @submit.prevent>
          <el-form-item :label="t('service.labelTopic')">
            <el-select v-model="topic" style="width: 100%">
              <el-option v-for="tp in topics" :key="tp" :label="topicLabel(tp)" :value="tp" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('service.labelTitle')">
            <el-input v-model="title" maxlength="60" show-word-limit :placeholder="t('service.titlePlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('service.labelDesc')">
            <el-input
              v-model="desc"
              type="textarea"
              :rows="5"
              maxlength="800"
              show-word-limit
              :placeholder="t('service.descPlaceholder')"
            />
          </el-form-item>
          <div class="service-form-foot">
            <el-button @click="copyIssueUrl">{{ t('service.copyIssueUrl') }}</el-button>
            <el-button type="primary" :loading="sending" :disabled="!canSend" @click="sendFeedback">
              {{ t('service.generate') }}
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
  padding: 12px 16px;
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
  padding: 12px 0;
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
