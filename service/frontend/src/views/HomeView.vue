<script setup lang="ts">
import { useRouter } from 'vue-router'
import { api } from '../api'
import { currentUser } from '../api'

const router = useRouter()
const cards = [
  { title: '市场应用', desc: '浏览与安装社区贡献的 RPA 应用', to: '/market' },
  { title: '社区帖子', desc: '交流自动化技巧与问题反馈', to: '/community' },
  { title: '流程分享', desc: '上传 / 下载 .leafrpa 流程文件', to: '/flows' }
]
const go = (to: string) => router.push(to)
const loggedIn = !!currentUser()
</script>

<template>
  <el-row :gutter="16">
    <el-col v-for="c in cards" :key="c.to" :span="8">
      <el-card shadow="hover" class="home-card" @click="go(c.to)">
        <h3>{{ c.title }}</h3>
        <p>{{ c.desc }}</p>
      </el-card>
    </el-col>
  </el-row>
  <el-alert
    v-if="!loggedIn"
    title="尚未登录，请先登录后再使用需要鉴权的功能"
    type="info"
    show-icon
    style="margin-top: 24px"
  />
</template>
