<script setup lang="ts">
import { computed } from 'vue'
import { copyText } from '../clipboard'
import { toastSuccess, toastWarning } from '../notify'
import { t } from '../i18n'
import { useAuthStore } from '../auth'
import PageShell from '../components/PageShell.vue'

const auth = useAuthStore()
const REPO_URL = 'https://gitee.com/Yangshengzhou/leaf-rpa'

/* 邀请码即当前登录用户名；未登录时为空，页面展示登录提示 */
const inviteCode = computed(() => auth.session?.username ?? '')
const inviteLink = computed(() =>
  inviteCode.value ? `${REPO_URL}?invite=${inviteCode.value}` : '',
)
const shareText = computed(() =>
  inviteCode.value ? t('invite.shareText', { code: inviteCode.value }) : '',
)

const rewardSteps = computed(() => [
  { title: t('invite.step1Title'), desc: t('invite.step1Desc') },
  { title: t('invite.step2Title'), desc: t('invite.step2Desc') },
  { title: t('invite.step3Title'), desc: t('invite.step3Desc') },
])

async function copyCode() {
  if (!inviteCode.value) {
    toastWarning(t('invite.loginFirstCode'))
    return
  }
  if (await copyText(inviteCode.value)) toastSuccess(t('invite.copiedCode'))
  else toastWarning(t('common.copyFailed'))
}

async function copyLink() {
  if (!inviteLink.value) {
    toastWarning(t('invite.loginFirstLink'))
    return
  }
  if (await copyText(inviteLink.value)) toastSuccess(t('invite.copiedLink'))
  else toastWarning(t('common.copyFailed'))
}

async function copyShareText() {
  if (!shareText.value) {
    toastWarning(t('invite.loginFirstShare'))
    return
  }
  if (await copyText(shareText.value)) toastSuccess(t('invite.copiedShare'))
  else toastWarning(t('common.copyFailed'))
}
</script>

<template>
  <PageShell :title="t('invite.title')" :kicker="t('invite.kicker')" :sub="t('invite.sub')">
    <div class="invite-layout">
      <div class="invite-main">
        <section class="sec-card">
          <h2 class="sec-title">{{ t('invite.myCode') }}</h2>
          <template v-if="inviteCode">
            <div class="code-box">
              <span class="code-text">{{ inviteCode }}</span>
              <el-button type="primary" plain @click="copyCode">{{ t('invite.copyCode') }}</el-button>
            </div>
            <div class="link-box">
              <span class="link-text" :title="inviteLink">{{ inviteLink }}</span>
              <el-button link type="primary" @click="copyLink">{{ t('invite.copyLink') }}</el-button>
            </div>
            <p class="sec-meta invite-tip">{{ t('invite.codeTip') }}</p>
          </template>
          <el-empty
            v-else
            :image-size="72"
            :description="t('invite.emptyCode')"
          />
        </section>

        <section class="sec-card">
          <h2 class="sec-title">{{ t('invite.shareTitle') }}</h2>
          <p v-if="shareText" class="share-text">{{ shareText }}</p>
          <p v-else class="sec-meta share-text">{{ t('invite.shareEmpty') }}</p>
          <el-button plain :disabled="!shareText" @click="copyShareText">{{ t('invite.copyShare') }}</el-button>
        </section>
      </div>

      <aside class="invite-side">
        <section class="sec-card">
          <h2 class="sec-title">{{ t('invite.rulesTitle') }}</h2>
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
            <h2 class="sec-title">{{ t('invite.recordsTitle') }}</h2>
          </div>
          <el-empty :description="t('invite.recordsEmpty')" :image-size="72" />
          <p class="sec-meta record-tip">{{ t('invite.recordsTip') }}</p>
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
  padding: 12px 16px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--panel);
  margin-top: 16px;
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
  margin-top: 8px;
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
  margin: 12px 0 16px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.7;
}

.record-tip {
  margin: -8px 0 4px;
  text-align: center;
}
</style>
