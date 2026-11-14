<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api, currentUser, type UserProfile } from '../api'

const profile = ref<UserProfile | null>(null)
const loading = ref(false)

onMounted(async () => {
  const name = currentUser()
  if (!name) return
  loading.value = true
  try {
    profile.value = await api<UserProfile>('get', `/users/${encodeURIComponent(name)}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载资料失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <el-card shadow="never" v-loading="loading">
    <template v-if="currentUser()">
      <template v-if="profile">
        <div class="profile-head">
          <el-avatar :size="56">{{ profile.username.slice(0, 1) }}</el-avatar>
          <div>
            <div class="profile-name">{{ profile.username }}</div>
            <div class="profile-sub">注册于 {{ new Date(profile.createdAt).toLocaleDateString() }}</div>
          </div>
        </div>
        <el-row :gutter="16" style="margin-top: 24px">
          <el-col :span="8">
            <el-statistic title="发帖" :value="profile.posts" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="回复" :value="profile.replies" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="分享流程" :value="profile.flows" />
          </el-col>
        </el-row>
      </template>
      <el-empty v-else-if="!loading" description="资料加载失败，请稍后重试" />
    </template>
    <el-empty v-else description="请先登录后查看资料" />
  </el-card>
</template>

<style scoped>
.profile-head {
  display: flex;
  align-items: center;
  gap: 16px;
}
.profile-name {
  font-size: 18px;
  font-weight: 600;
}
.profile-sub {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}
</style>
