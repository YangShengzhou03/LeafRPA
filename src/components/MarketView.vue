<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import { MARKET_APPS, MARKET_CATEGORIES, type MarketApp } from '../marketApps'
import { installedApps, installApp, uninstallApp } from '../installedApps'
import { toastSuccess } from '../notify'

const apps = MARKET_APPS
const categories = MARKET_CATEGORIES

const keyword = ref('')
const activeCat = ref('全部')
const installed = installedApps

const filtered = computed(() => {
  const k = keyword.value.trim()
  return apps.filter((a) => {
    const matchCat = activeCat.value === '全部' || a.category === activeCat.value
    const matchKw = !k || a.name.includes(k) || a.desc.includes(k)
    return matchCat && matchKw
  })
})

function install(app: MarketApp) {
  installApp(app.id)
  toastSuccess(`「${app.name}」已安装`, { title: '安装成功', duration: 2200 })
}

async function uninstall(app: MarketApp) {
  try {
    await ElMessageBox.confirm(`确定卸载「${app.name}」吗？`, '卸载确认', {
      confirmButtonText: '卸载',
      cancelButtonText: '取消',
      type: 'warning',
    })
    uninstallApp(app.id)
    toastSuccess(`「${app.name}」已卸载`, { title: '卸载成功', duration: 2200 })
  } catch {
    /* 已取消 */
  }
}

const detail = ref<MarketApp | null>(null)
const detailView = ref(false)

function openDetail(app: MarketApp) {
  detail.value = app
  detailView.value = true
}

function closeDetail() {
  detailView.value = false
  detail.value = null
}
</script>

<template>
  <section class="page">
    <template v-if="!detailView">
      <div class="page-head">
        <div class="page-head-main">
          <div class="page-kicker">应用与指令</div>
          <h1 class="page-title">市场</h1>
          <p class="page-sub">发现并安装你需要的自动化应用与指令</p>
        </div>
        <div class="page-actions">
          <el-input v-model="keyword" placeholder="搜索应用 / 指令" clearable class="mkt-search">
            <template #prefix>
              <el-icon :size="14"><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <el-radio-group v-model="activeCat" class="cat-group">
        <el-radio-button v-for="c in categories" :key="c" :value="c">{{ c }}</el-radio-button>
      </el-radio-group>

      <div class="card-grid">
        <div
          v-for="a in filtered"
          :key="a.id"
          class="mkt-card"
          role="button"
          tabindex="0"
          @click="openDetail(a)"
          @keydown.enter="openDetail(a)"
        >
          <div class="mkt-icon" :style="{ background: a.color }">
            <el-icon :size="20" color="#fff"><component :is="a.icon" /></el-icon>
          </div>
          <div class="mkt-name">{{ a.name }}</div>
          <div class="mkt-desc">{{ a.desc }}</div>
          <div class="mkt-foot">
            <div class="mkt-meta">
              <span class="mkt-cat">{{ a.category }}</span>
              <span class="mkt-installs">{{ a.installs }} 次安装</span>
            </div>
            <div class="mkt-foot-actions">
              <span v-if="installed.has(a.id)" class="mkt-state">已安装</span>
              <el-button
                type="primary"
                round
                :plain="installed.has(a.id)"
                @click.stop="installed.has(a.id) ? uninstall(a) : install(a)"
              >
                {{ installed.has(a.id) ? '卸载' : '安装' }}
              </el-button>
            </div>
          </div>
        </div>
        <el-empty
          v-if="!filtered.length"
          description="没有找到匹配的应用"
          :image-size="96"
          class="empty-block"
        />
      </div>
    </template>

    <template v-else-if="detail">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="closeDetail">返回市场</el-button>
      </div>
      <div class="detail-card sec-card">
        <div class="detail-head">
          <div class="mkt-icon" :style="{ background: detail.color }">
            <el-icon :size="22" color="#fff"><component :is="detail.icon" /></el-icon>
          </div>
          <div class="detail-name">{{ detail.name }}</div>
          <div class="detail-cat">{{ detail.category }}</div>
        </div>
        <p class="detail-desc">{{ detail.desc }}</p>
        <div class="detail-meta">
          <span>安装量 {{ detail.installs }}</span>
          <span :class="{ installed: installed.has(detail.id) }">
            {{ installed.has(detail.id) ? '已安装' : '未安装' }}
          </span>
        </div>
        <div class="detail-actions">
          <el-button
            type="primary"
            :plain="installed.has(detail.id)"
            @click="installed.has(detail.id) ? uninstall(detail) : install(detail)"
          >
            {{ installed.has(detail.id) ? '卸载' : '安装' }}
          </el-button>
        </div>
        <p class="detail-note">市场中的应用为示例数据，用于演示安装与卸载交互。</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* ---- 应用卡片 ---- */
.mkt-foot {
  margin: 12px 0 0;
}

.mkt-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mkt-foot-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.mkt-state {
  font-size: 12px;
  color: var(--text-3);
}

/* ---- 应用详情 ---- */
.detail-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-head {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  align-items: center;
}

.mkt-icon {
  grid-row: 1 / span 2;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.detail-cat {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-3);
}

.detail-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.7;
}

.detail-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-3);
}

.detail-meta .installed {
  color: var(--accent);
  font-weight: 500;
}

.detail-note {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--panel);
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.6;
}
</style>
