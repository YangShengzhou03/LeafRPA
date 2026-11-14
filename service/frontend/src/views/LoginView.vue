<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, saveSession, type Session } from '../api'

const router = useRouter()
const tab = ref<'login' | 'register'>('login')
const loginForm = ref({ username: '', password: '' })
const regForm = ref({ username: '', phone: '', code: '', password: '' })
const submitting = ref(false)

/** 登录 / 注册成功后统一跳回首页（顶栏会显示当前用户） */
function enter(s: Session, tip: string) {
  saveSession(s.username, s.token)
  ElMessage.success(tip)
  router.push('/')
}

async function doLogin() {
  if (!loginForm.value.username.trim() || !loginForm.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  submitting.value = true
  try {
    const s = await api<Session>('post', '/auth/login', {
      username: loginForm.value.username.trim(),
      password: loginForm.value.password,
    })
    enter(s, '登录成功')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '登录失败')
  } finally {
    submitting.value = false
  }
}

async function doRegister() {
  const f = regForm.value
  if (!f.username.trim() || !f.phone || !f.code || !f.password) {
    ElMessage.warning('请填写完整的注册信息')
    return
  }
  if (!/^1\d{10}$/.test(f.phone)) {
    ElMessage.warning('请输入正确的 11 位手机号')
    return
  }
  if (f.password.length < 6) {
    ElMessage.warning('密码至少 6 位')
    return
  }
  submitting.value = true
  try {
    const s = await api<Session>('post', '/auth/register', {
      username: f.username.trim(),
      phone: f.phone,
      code: f.code,
      password: f.password,
    })
    enter(s, '注册并登录成功')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '注册失败')
  } finally {
    submitting.value = false
  }
}

async function doReset() {
  const username = loginForm.value.username.trim()
  const phone = regForm.value.phone
  const password = regForm.value.password
  if (!username) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (!/^1\d{10}$/.test(phone)) {
    ElMessage.warning('请输入注册时使用的 11 位手机号')
    return
  }
  if (password.length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  submitting.value = true
  try {
    await api<Session>('post', '/auth/reset-password', { username, phone, password })
    ElMessage.success('密码已重置，请用新密码登录')
    tab.value = 'login'
    loginForm.value.password = ''
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '重置失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-card style="max-width: 460px; margin: 48px auto">
    <el-tabs v-model="tab">
      <el-tab-pane label="登录" name="login">
        <el-form label-width="64">
          <el-form-item label="用户名"><el-input v-model="loginForm.username" /></el-form-item>
          <el-form-item label="密码"><el-input v-model="loginForm.password" type="password" show-password /></el-form-item>
          <el-button type="primary" style="width: 100%" :loading="submitting" @click="doLogin">登录</el-button>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="注册" name="register">
        <el-form label-width="64">
          <el-form-item label="用户名"><el-input v-model="regForm.username" /></el-form-item>
          <el-form-item label="手机号"><el-input v-model="regForm.phone" maxlength="11" /></el-form-item>
          <el-form-item label="验证码"><el-input v-model="regForm.code" maxlength="6" placeholder="123456" /></el-form-item>
          <el-form-item label="密码"><el-input v-model="regForm.password" type="password" show-password /></el-form-item>
          <el-button type="primary" style="width: 100%" :loading="submitting" @click="doRegister">注册并登录</el-button>
        </el-form>
      </el-tab-pane>
    </el-tabs>
    <el-divider>找回密码（用注册手机号）</el-divider>
    <el-form inline>
      <el-input v-model="loginForm.username" placeholder="用户名" style="width: 130px" />
      <el-input v-model="regForm.phone" placeholder="手机号" style="width: 130px" />
      <el-input v-model="regForm.password" placeholder="新密码" style="width: 130px" />
      <el-button :loading="submitting" @click="doReset">重置</el-button>
    </el-form>
  </el-card>
</template>
