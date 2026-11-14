<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { User, Lock, Minus, Close, ChatDotRound, Promotion, Service, Iphone } from '@element-plus/icons-vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAuthStore } from '../auth'
import { toastError, toastInfo, toastSuccess } from '../notify'
import { t, type MessageKey } from '../i18n'
import mascot from '../assets/mascot.png'
import logo from '../assets/logo.png'

const auth = useAuthStore()
const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const appWindow = hasTauri ? getCurrentWindow() : null

/* ---- 轮播名言（固定尺寸，避免布局抖动） ---- */
const quoteKeys: { text: MessageKey; author: MessageKey }[] = [
  { text: 'login.quote1.text', author: 'login.quote1.author' },
  { text: 'login.quote2.text', author: 'login.quote2.author' },
  { text: 'login.quote3.text', author: 'login.quote3.author' },
]
const quotes = computed(() =>
  quoteKeys.map((q) => ({ text: t(q.text), author: t(q.author) })),
)
const quoteIndex = ref(0)

/** 在标点符号后换行，避免从句子中间生硬断开 */
function formatQuote(text: string): string {
  return text.replace(/([，。；！？、：])/g, '$1\n').trim()
}
let quoteTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  quoteTimer = setInterval(() => {
    quoteIndex.value = (quoteIndex.value + 1) % quotes.value.length
  }, 5000)
})
onUnmounted(() => {
  if (quoteTimer) clearInterval(quoteTimer)
})

/* ---- 卡片内视图切换：登录 / 注册 / 忘记密码 ---- */
type CardView = 'login' | 'register' | 'forgot'
const view = ref<CardView>('login')
const viewMeta: Record<CardView, { title: MessageKey; hint: MessageKey; switchText: MessageKey; switchLabel: MessageKey }> = {
  login: { title: 'login.cardTitle.login', hint: 'login.cardHint.login', switchText: 'login.cardSwitch.login', switchLabel: 'login.cardSwitchLabel.login' },
  register: { title: 'login.cardTitle.register', hint: 'login.cardHint.register', switchText: 'login.cardSwitch.register', switchLabel: 'login.cardSwitchLabel.register' },
  forgot: { title: 'login.cardTitle.forgot', hint: 'login.cardHint.forgot', switchText: 'login.cardSwitch.forgot', switchLabel: 'login.cardSwitchLabel.forgot' },
}
const currentMeta = computed(() => {
  const meta = viewMeta[view.value]
  return {
    title: t(meta.title),
    hint: t(meta.hint),
    switchText: t(meta.switchText),
    switchLabel: t(meta.switchLabel),
  }
})

/* ---- 登录表单 ---- */
const form = reactive({
  username: auth.lastUsername,
  password: auth.rememberPassword ? auth.savedPassword : '',
})
const autoLogin = ref(false)
const rememberPassword = ref(auth.rememberPassword)
const logging = ref(false)
const loginFormRef = ref<FormInstance>()
const loginRules = computed<FormRules>(() => ({
  username: [{ required: true, message: t('login.usernamePlaceholder'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }],
}))

const accountMatches = computed(() => auth.accounts.map((a) => a.username))

async function handleLogin() {
  const valid = await loginFormRef.value?.validate().catch(() => false)
  if (!valid) return
  logging.value = true
  try {
    const err = await auth.login(form.username, form.password, autoLogin.value, rememberPassword.value)
    if (err) {
      toastError(err, { title: t('login.loginFailed'), offset: 80 })
      return
    }
    toastSuccess(t('login.welcomeBack', { name: auth.session?.username ?? '' }), { title: t('login.loginSuccess'), duration: 2200 })
  } finally {
    logging.value = false
  }
}

/* ---- 注册表单（卡片内切换，不再弹窗） ---- */
const regFormRef = ref<FormInstance>()
const regForm = reactive({ username: '', phone: '', code: '', password: '', confirm: '' })
const regRules = computed<FormRules>(() => ({
  username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
  phone: [
    { required: true, message: t('login.phoneRequired'), trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: t('login.phoneInvalid'), trigger: 'blur' },
  ],
  code: [
    { required: true, message: t('login.codeRequired'), trigger: 'blur' },
    { pattern: /^\d{6}$/, message: t('login.codeInvalid'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('login.passwordRequired'), trigger: 'blur' },
    { min: 6, message: t('login.passwordMin'), trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: t('login.confirmRequired'), trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== regForm.password) callback(new Error(t('login.confirmMismatch')))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}))

async function handleRegister() {
  const valid = await regFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const err = await auth.register(regForm.username, regForm.phone, regForm.password, regForm.code)
  if (err) {
    toastError(err, { title: t('login.registerFailed'), position: 'top-left' })
    return
  }
  form.username = auth.lastUsername
  form.password = ''
  regForm.username = ''
  regForm.phone = ''
  regForm.code = ''
  regForm.password = ''
  regForm.confirm = ''
  if (auth.session) {
    // 云端注册成功即建立会话，直接进入主界面
    toastSuccess(t('login.welcomeJoin', { name: auth.session.username }), { title: t('login.registerSuccess'), duration: 2400 })
  } else {
    view.value = 'login'
    toastSuccess(t('login.registerOkPleaseLogin'), { title: t('login.registerDone'), duration: 2400 })
  }
}

/* ---- 忘记密码 ---- */
const forgotFormRef = ref<FormInstance>()
const forgotForm = reactive({ username: '', phone: '', password: '' })
const forgotRules = computed<FormRules>(() => ({
  username: [{ required: true, message: t('login.usernamePlaceholder'), trigger: 'blur' }],
  phone: [
    { required: true, message: t('login.regPhoneRequired'), trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: t('login.phoneInvalid'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('login.newPasswordRequired'), trigger: 'blur' },
    { min: 6, message: t('login.passwordMin'), trigger: 'blur' },
  ],
}))

function openForgot() {
  forgotForm.username = form.username
  forgotForm.phone = ''
  forgotForm.password = ''
  view.value = 'forgot'
}

async function handleReset() {
  const valid = await forgotFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const err = await auth.resetPassword(forgotForm.username, forgotForm.phone, forgotForm.password)
  if (err) {
    toastError(err, { title: t('login.resetFailed'), position: 'bottom-right' })
    return
  }
  form.username = forgotForm.username
  form.password = ''
  view.value = 'login'
  toastSuccess(t('login.resetOk'), { title: t('login.resetDone'), duration: 3000 })
}

/* ---- 管理员登录（后端管理员账号） ---- */
const ADMIN = { username: 'admin', phone: '13800000000', password: 'admin123' }

async function adminLogin() {
  let err = await auth.login(ADMIN.username, ADMIN.password, true, false)
  if (err) {
    // 管理员账号不存在时先通过后端注册（验证码 123456），再登录
    const regErr = await auth.register(ADMIN.username, ADMIN.phone, ADMIN.password, '123456')
    if (regErr) {
      toastError(regErr, { title: t('login.adminFailed') })
      return
    }
    err = await auth.login(ADMIN.username, ADMIN.password, true, false)
    if (err) {
      toastError(err, { title: t('login.adminFailed') })
      return
    }
  }
  toastSuccess(t('login.adminOk', { name: auth.session?.username ?? '' }), { title: t('login.loginSuccess'), duration: 2200 })
}

/* ---- 三方登录 ---- */
function thirdParty(name: string) {
  toastInfo(t('login.thirdOnly', { name }), { title: t('login.thirdTitle'), offset: 64 })
}

function handleMinimize() {
  void appWindow?.minimize()
}

function handleClose() {
  void appWindow?.close()
}
</script>

<template>
  <div class="login-page">
    <div class="login-bg" aria-hidden="true">
      <span class="bg-blob b1"></span>
      <span class="bg-blob b2"></span>
      <span class="bg-blob b3"></span>
    </div>
    <header class="login-top" data-tauri-drag-region>
      <div class="login-brand" data-tauri-drag-region>
        <img class="brand-logo" :src="logo" :alt="t('app.name')" />
        <span class="brand-name">{{ t('app.name') }}</span>
        <span class="brand-version">v0.1.0</span>
      </div>
      <div v-if="hasTauri" class="win-controls">
        <el-tooltip :content="t('win.minimize')" placement="bottom" :show-after="300">
          <button class="win-btn" @click="handleMinimize">
            <el-icon :size="15"><Minus /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip :content="t('win.close')" placement="bottom" :show-after="300">
          <button class="win-btn close" @click="handleClose">
            <el-icon :size="15"><Close /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </header>

    <div class="login-body">
      <section class="login-hero">
        <img class="hero-img" :src="mascot" :alt="t('app.name')" />
        <div class="hero-quote">
          <transition name="quote-fade" mode="out-in">
            <div :key="quoteIndex" class="quote-slide">
              <p class="quote-text">{{ formatQuote(quotes[quoteIndex].text) }}</p>
              <p class="quote-author">{{ quotes[quoteIndex].author }}</p>
            </div>
          </transition>
        </div>
        <div class="hero-dots">
          <span
            v-for="(q, i) in quotes"
            :key="i"
            class="dot"
            :class="{ active: i === quoteIndex }"
            role="button"
            tabindex="0"
            :title="q.text"
            @click="quoteIndex = i"
            @keydown.enter="quoteIndex = i"
          ></span>
        </div>
      </section>

      <section class="login-card">
        <div class="card-head">
          <h1 class="card-title">{{ currentMeta.title }}</h1>
          <span class="to-register">
            {{ currentMeta.hint }}
            <a class="link strong" :title="currentMeta.switchLabel" @click="view = view === 'login' ? 'register' : 'login'">
              {{ currentMeta.switchText }}
            </a>
          </span>
        </div>

        <div class="card-view">
          <transition name="view-fade" mode="out-in">
            <!-- 登录 -->
            <div v-if="view === 'login'" key="login" class="view-pane">
              <el-form ref="loginFormRef" :model="form" :rules="loginRules" @submit.prevent>
                <el-form-item prop="username">
                  <el-autocomplete
                    v-model="form.username"
                    class="login-field"
                    :fetch-suggestions="(_q: string, cb: (list: { value: string }[]) => void) => cb(accountMatches.map((v) => ({ value: v })))"
                    :placeholder="t('login.usernamePlaceholder')"
                    clearable
                    @keyup.enter="handleLogin"
                  >
                    <template #prefix>
                      <el-icon :size="15"><User /></el-icon>
                    </template>
                  </el-autocomplete>
                </el-form-item>
                <el-form-item prop="password">
                  <el-input
                    v-model="form.password"
                    class="login-field"
                    type="password"
                    :placeholder="t('login.passwordPlaceholder')"
                    show-password
                    @keyup.enter="handleLogin"
                  >
                    <template #prefix>
                      <el-icon :size="15"><Lock /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
              </el-form>

              <div class="options">
                <el-checkbox v-model="autoLogin">{{ t('login.autoLogin') }}</el-checkbox>
                <el-checkbox v-model="rememberPassword">{{ t('login.rememberPassword') }}</el-checkbox>
              </div>

              <el-button class="login-btn" type="primary" size="large" :loading="logging" @click="handleLogin">
                {{ t('login.submit') }}
              </el-button>

              <div class="forgot">
                <a class="link" @click="openForgot">{{ t('login.forgot') }}</a>
              </div>

              <el-divider class="third-divider">{{ t('login.thirdDivider') }}</el-divider>

              <div class="third-list">
                <el-tooltip :content="t('login.wechatTip')" placement="top" :show-after="300">
                  <el-button class="third-btn" circle @click="thirdParty(t('login.name.wechat'))">
                    <el-icon :size="18" color="#2aae67"><ChatDotRound /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="t('login.dingtalkTip')" placement="top" :show-after="300">
                  <el-button class="third-btn" circle @click="thirdParty(t('login.name.dingtalk'))">
                    <el-icon :size="18" color="#2f81f7"><Promotion /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="t('login.feishuTip')" placement="top" :show-after="300">
                  <el-button class="third-btn" circle @click="thirdParty(t('login.name.feishu'))">
                    <el-icon :size="18" color="#3370ff"><Service /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="t('login.adminTip')" placement="top" :show-after="300">
                  <el-button class="third-btn" circle @click="adminLogin">
                    <el-icon :size="18" color="#9333ea"><User /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
            </div>

            <!-- 注册 -->
            <div v-else-if="view === 'register'" key="register" class="view-pane">
              <el-form ref="regFormRef" :model="regForm" :rules="regRules" @submit.prevent>
                <el-form-item prop="username">
                  <el-input v-model="regForm.username" class="login-field" :placeholder="t('login.usernameField')" clearable>
                    <template #prefix>
                      <el-icon :size="15"><User /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item prop="phone">
                  <el-input v-model="regForm.phone" class="login-field" :placeholder="t('login.phonePlaceholder')" maxlength="11" clearable>
                    <template #prefix>
                      <el-icon :size="15"><Iphone /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item prop="code">
                  <el-input v-model="regForm.code" class="login-field" :placeholder="t('login.codePlaceholder')" maxlength="6" clearable>
                    <template #prefix>
                      <el-icon :size="15"><ChatDotRound /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item prop="password">
                  <el-input v-model="regForm.password" class="login-field" type="password" :placeholder="t('login.passwordMinPlaceholder')" show-password>
                    <template #prefix>
                      <el-icon :size="15"><Lock /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item prop="confirm">
                  <el-input v-model="regForm.confirm" class="login-field" type="password" :placeholder="t('login.confirmPlaceholder')" show-password @keyup.enter="handleRegister">
                    <template #prefix>
                      <el-icon :size="15"><Lock /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
              </el-form>

              <el-button class="login-btn" type="primary" size="large" @click="handleRegister">{{ t('login.registerBtn') }}</el-button>
            </div>

            <!-- 忘记密码 -->
            <div v-else key="forgot" class="view-pane">
              <p class="forgot-tip">{{ t('login.forgotTip') }}</p>
              <el-form ref="forgotFormRef" :model="forgotForm" :rules="forgotRules" @submit.prevent>
                <el-form-item prop="username">
                  <el-input v-model="forgotForm.username" class="login-field" :placeholder="t('login.accountPlaceholder')" clearable>
                    <template #prefix>
                      <el-icon :size="15"><User /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item prop="phone">
                  <el-input v-model="forgotForm.phone" class="login-field" :placeholder="t('login.regPhonePlaceholder')" maxlength="11" clearable>
                    <template #prefix>
                      <el-icon :size="15"><Iphone /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item prop="password">
                  <el-input v-model="forgotForm.password" class="login-field" type="password" :placeholder="t('login.newPasswordPlaceholder')" show-password @keyup.enter="handleReset">
                    <template #prefix>
                      <el-icon :size="15"><Lock /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
              </el-form>

              <el-button class="login-btn" type="primary" size="large" @click="handleReset">{{ t('login.resetBtn') }}</el-button>
            </div>
          </transition>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(160deg, #fdf3f1 0%, var(--bg) 46%, #f6f1f4 100%);
}

/* ---- 动态渐变背景：柔光色斑缓慢漂移 ---- */
.login-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  will-change: transform;
}

.bg-blob.b1 {
  width: 540px;
  height: 540px;
  left: -150px;
  top: -170px;
  background: radial-gradient(circle, rgba(245, 63, 63, 0.26), transparent 70%);
  animation: blob-drift-1 9s ease-in-out infinite alternate;
}

.bg-blob.b2 {
  width: 460px;
  height: 460px;
  right: -130px;
  top: 22%;
  background: radial-gradient(circle, rgba(247, 107, 107, 0.2), transparent 70%);
  animation: blob-drift-2 12s ease-in-out infinite alternate;
}

.bg-blob.b3 {
  width: 420px;
  height: 420px;
  left: 30%;
  bottom: -200px;
  background: radial-gradient(circle, rgba(250, 140, 80, 0.14), transparent 70%);
  animation: blob-drift-3 15s ease-in-out infinite alternate;
}

@keyframes blob-drift-1 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(130px, 90px) scale(1.18); }
}

@keyframes blob-drift-2 {
  from { transform: translate(0, 0) scale(1.1); }
  to { transform: translate(-110px, 70px) scale(0.94); }
}

@keyframes blob-drift-3 {
  from { transform: translate(0, 0) scale(0.95); }
  to { transform: translate(90px, -80px) scale(1.12); }
}

@media (prefers-reduced-motion: reduce) {
  .bg-blob {
    animation: none;
  }
}

.login-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  flex-shrink: 0;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 8px;
}

.brand-logo {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.brand-name {
  font-size: 13px;
  color: var(--text);
}

.brand-version {
  font-size: 11px;
  color: var(--text-3);
}

.win-controls {
  display: flex;
  gap: 4px;
  margin: 0 8px;
  -webkit-app-region: no-drag;
}

.win-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-2);
  border-radius: 8px;
}

.win-btn:hover {
  background: var(--hover);
}

.win-btn.close:hover {
  background: #e81123;
  color: #fff;
}

.login-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 56px;
  padding: 0 48px 24px;
  min-height: 0;
}

/* ---- 左侧轮播：固定尺寸容器，文字长短变化不影响布局 ---- */
.login-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 420px;
}

.hero-img {
  width: 220px;
  height: 220px;
  object-fit: contain;
  margin-bottom: 16px;
  user-select: none;
  flex-shrink: 0;
  border-radius: 24px;
}

.hero-quote {
  width: 100%;
  height: 100px;
  overflow: hidden;
  padding: 0 12px;
}

.quote-slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.quote-text {
  margin: 0;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.7;
  color: var(--text);
  white-space: pre-line;
}

.quote-author {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--text-3);
}

.quote-fade-enter-active,
.quote-fade-leave-active {
  transition: opacity 0.35s ease;
}

.quote-fade-enter-from,
.quote-fade-leave-to {
  opacity: 0;
}

.hero-dots {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

/* 视觉保持 16×4，命中区通过 padding + background-clip 扩大到 24×24 */
.dot {
  width: 16px;
  height: 4px;
  padding: 10px 4px;
  border-radius: 999px;
  background: rgba(31, 35, 41, 0.14);
  background-clip: content-box;
  cursor: pointer;
  transition: background 0.2s;
}

.dot.active {
  background: var(--text);
  background-clip: content-box;
}

.dot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ---- 右侧卡片：固定宽度与最小高度，视图切换不跳动 ---- */
.login-card {
  width: 372px;
  /* 取三种视图（登录/注册/重置密码）中最高者，切换时卡片大小保持不变 */
  min-height: 368px;
  background: var(--panel);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  padding: 24px 28px 24px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-shrink: 0;
  min-height: 32px;
  white-space: nowrap;
}

.card-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
}

.to-register {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}

.link {
  color: var(--text-2);
  text-decoration: none;
  cursor: pointer;
}

.link:hover {
  color: var(--accent);
}

.link.strong {
  color: var(--text);
  font-weight: 400;
}

.link.strong:hover {
  color: var(--accent);
}

.card-view {
  flex: 1;
}

.view-fade-enter-active,
.view-fade-leave-active {
  transition: opacity 0.2s ease;
}

.view-fade-enter-from,
.view-fade-leave-to {
  opacity: 0;
}

.view-pane {
  display: flex;
  flex-direction: column;
}

.login-field {
  width: 100%;
}

/* ---- 表单：统一控件尺寸与间距，避免挤压 ---- */
.view-pane :deep(.el-form-item) {
  margin-bottom: 16px;
}

.view-pane :deep(.el-form-item__content) {
  display: block;
}

/* 所有输入框统一为 40px 高、8px 圆角、12px 内边距 */
.view-pane :deep(.el-input .el-input__wrapper),
.view-pane :deep(.el-autocomplete .el-input__wrapper) {
  padding: 8px 12px;
  border-radius: 8px;
}

.view-pane :deep(.el-input__inner) {
  height: 24px;
  line-height: 24px;
}

.view-pane :deep(.el-input__prefix),
.view-pane :deep(.el-input__suffix) {
  align-items: center;
}

.view-pane :deep(.el-form-item__error) {
  padding-top: 4px;
}

.options {
  display: flex;
  gap: 20px;
  margin: 4px 0 16px;
  height: 24px;
  align-items: center;
}

.options :deep(.el-checkbox__label) {
  font-size: 12px;
  color: var(--text-2);
}

.login-btn {
  width: 100%;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  letter-spacing: 6px;
  text-indent: 6px;
  margin-top: 4px;
}

.forgot {
  text-align: center;
  margin-top: 12px;
  font-size: 12px;
  line-height: 16px;
}

.forgot-tip {
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 20px;
  color: var(--text-2);
}

.third-divider {
  margin: 16px 0 0;
}

.third-divider :deep(.el-divider__text) {
  font-size: 11px;
  color: var(--text-3);
  background: var(--panel);
  white-space: nowrap;
}

.third-list {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  padding-bottom: 0;
}

.third-btn {
  width: 40px;
  height: 40px;
  border-color: var(--border);
}
</style>
