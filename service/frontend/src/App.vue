<script setup lang="ts">
import { useRouter } from 'vue-router'
import { clearSession, currentUser } from './api'

const router = useRouter()
const menus = [
  { label: '首页', to: '/' },
  { label: '登录 / 注册', to: '/login' },
  { label: '市场应用', to: '/market' },
  { label: '社区帖子', to: '/community' },
  { label: '流程分享', to: '/flows' }
]
function active(to: string): boolean {
  return router.currentRoute.value.path === to
}
function logout() {
  clearSession()
  router.push('/login')
}
</script>

<template>
  <el-container style="min-height: 100vh">
    <el-header style="border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 16px">
      <b style="font-size: 18px">轻羽 RPA 服务端</b>
      <el-menu mode="horizontal" :default-active="router.currentRoute.value.path" style="flex: 1" router>
        <el-menu-item v-for="m in menus" :key="m.to" :index="m.to">{{ m.label }}</el-menu-item>
      </el-menu>
      <template v-if="currentUser()">
        <el-button link @click="router.push('/profile')">我的资料</el-button>
        <span>{{ currentUser() }}</span>
        <el-button link @click="logout">退出</el-button>
      </template>
    </el-header>
    <el-main style="max-width: 1080px; margin: 0 auto; width: 100%">
      <router-view />
    </el-main>
  </el-container>
</template>
