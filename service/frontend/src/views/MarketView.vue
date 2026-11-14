<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { api, currentUser, type MarketApp, type PageResult } from '../api'

/** 服务端分页大小 */
const PAGE_SIZE = 20

const apps = ref<MarketApp[]>([])
const category = ref('全部')
const keyword = ref('')
const categories = ['全部', '数据采集', '办公自动化', '电商运营', '财务税务', '开发工具']
const loading = ref(false)
const page = ref(0)
const total = ref(0)

async function load() {
  loading.value = true
  try {
    const res = await api<PageResult<MarketApp>>('get',
      `/market/apps?category=${encodeURIComponent(category.value)}&keyword=${encodeURIComponent(keyword.value)}&page=${page.value}&size=${PAGE_SIZE}`)
    apps.value = res.items
    total.value = res.total
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载市场失败')
  } finally {
    loading.value = false
  }
}

/** 筛选条件变化时回到第一页 */
function reloadFromFirst() {
  page.value = 0
  load()
}

function onPageChange(p: number) {
  page.value = p - 1
  load()
}
async function install(a: MarketApp) {
  if (!currentUser()) {
    ElMessage.warning('请先登录后再安装')
    return
  }
  try {
    const r = await api<{ installs: number; alreadyInstalled: boolean }>('post', `/market/apps/${a.id}/install`)
    a.installs = r.installs
    ElMessage.success(r.alreadyInstalled ? `您已安装过 ${a.name}` : `已安装 ${a.name}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '安装失败')
  }
}
async function uninstall(a: MarketApp) {
  if (!currentUser()) {
    ElMessage.warning('请先登录后再卸载')
    return
  }
  try {
    const r = await api<{ installs: number; removed: boolean }>('post', `/market/apps/${a.id}/uninstall`)
    a.installs = r.installs
    ElMessage.success(r.removed ? `已卸载 ${a.name}` : '您尚未安装该应用')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '卸载失败')
  }
}
let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(reloadFromFirst, 350)
})
onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <el-form inline>
      <el-select v-model="category" style="width: 140px" @change="reloadFromFirst">
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <el-input v-model="keyword" placeholder="搜索应用" clearable style="width: 220px" @keyup.enter="reloadFromFirst" />
      <el-button type="primary" plain @click="reloadFromFirst">搜索</el-button>
    </el-form>
    <div v-loading="loading">
      <el-empty v-if="apps.length === 0 && !loading" description="没有匹配的应用" />
      <el-row :gutter="16">
        <el-col v-for="a in apps" :key="a.id" :span="8">
          <el-card shadow="hover" style="margin-bottom: 16px">
            <div class="app-name">{{ a.name }}</div>
            <div class="app-desc">{{ a.description }}</div>
            <div class="app-foot">
              <el-tag>{{ a.category }}</el-tag>
              <span class="installs">{{ a.installs }} 次安装</span>
              <el-button type="primary" @click="install(a)">安装</el-button>
              <el-button @click="uninstall(a)">卸载</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
      <el-pagination
        v-if="total > PAGE_SIZE"
        style="margin-top: 8px; justify-content: center"
        layout="prev, pager, next"
        :total="total"
        :page-size="PAGE_SIZE"
        :current-page="page + 1"
        background
        @current-change="onPageChange"
      />
    </div>
  </el-card>
</template>

<style scoped>
.app-name {
  font-size: 15px;
  font-weight: 600;
}
.app-desc {
  margin: 6px 0;
  color: #666;
  font-size: 13px;
  min-height: 36px;
}
.app-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.installs {
  color: #999;
  font-size: 12px;
}
</style>
