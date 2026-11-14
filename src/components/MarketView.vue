<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import {
  MARKET_CATEGORIES,
  formatInstalls,
  iconForCategory,
  serverApps,
  type MarketApp,
} from '../marketApps'
import { marketApi, ApiError, type MarketRatingSummary, type ServerMarketComment } from '../api'
import { useAuthStore } from '../auth'
import { installedApps, installApp, uninstallApp } from '../installedApps'
import { toastError, toastSuccess } from '../notify'
import { t, type MessageKey } from '../i18n'

const auth = useAuthStore()

const categories = MARKET_CATEGORIES
const keyword = ref('')
const activeCat = ref('全部')
const installed = installedApps

/** 分类值（发给服务端）→ 显示文案 */
const CAT_KEYS: Record<string, MessageKey> = {
  全部: 'market.cat.all',
  办公自动化: 'market.cat.office',
  电商运营: 'market.cat.ecommerce',
  财务税务: 'market.cat.finance',
  数据采集: 'market.cat.scrape',
  开发工具: 'market.cat.dev',
}
const catLabel = (c: string) => t(CAT_KEYS[c] ?? 'market.cat.all')

/** 服务端分页大小 */
const PAGE_SIZE = 20

const apps = ref<MarketApp[]>([])
const offline = ref(false)
const loading = ref(false)
const page = ref(0)
const total = ref(0)

/** 拉取云端应用列表；服务不可达时展示空态 */
async function loadApps() {
  loading.value = true
  try {
    const res = await marketApi.list(activeCat.value, keyword.value.trim(), page.value, PAGE_SIZE)
    apps.value = res.items.map((a) => ({
      id: `${a.id}`,
      name: a.name,
      desc: a.description,
      category: a.category,
      installs: formatInstalls(a.installs),
      color: a.color,
      icon: iconForCategory(a.category),
    }))
    total.value = res.total
    serverApps.value = apps.value
    offline.value = false
  } catch (err) {
    offline.value = true
    apps.value = []
    total.value = 0
    if (!(err instanceof ApiError && err.offline)) {
      toastError(err instanceof Error ? err.message : t('market.loadFailed'), { title: t('market.toastTitle') })
    }
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => apps.value)

/** 云端应用返回真实服务端 id（数字） */
function serverId(app: MarketApp): number | null {
  return Number.isNaN(Number(app.id)) ? null : Number(app.id)
}

onMounted(loadApps)

watch(activeCat, () => {
  page.value = 0
  loadApps()
})
let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(() => {
    page.value = 0
    loadApps()
  }, 350)
})

function onPageChange(p: number) {
  page.value = p - 1
  loadApps()
}

async function install(app: MarketApp) {
  const sid = serverId(app)
  // 服务端安装计数需要登录（按用户去重）；未登录时仅本地安装
  if (sid !== null && !auth.session) {
    toastError(t('market.loginToInstall'), { title: t('common.notLoggedIn') })
    return
  }
  try {
    if (sid !== null) await marketApi.install(sid)
    installApp(app.id)
    toastSuccess(t('market.installedOk', { name: app.name }), { title: t('market.installSuccess'), duration: 2200 })
    if (sid !== null) void loadApps()
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('market.installFailed'), { title: t('market.installFailed') })
  }
}

async function uninstall(app: MarketApp) {
  try {
    await ElMessageBox.confirm(t('market.uninstallConfirm', { name: app.name }), t('market.uninstallTitle'), {
      confirmButtonText: t('market.uninstall'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })
  } catch {
    return
  }
  const sid = serverId(app)
  if (sid !== null && !auth.session) {
    toastError(t('market.loginToUninstall'), { title: t('common.notLoggedIn') })
    return
  }
  try {
    if (sid !== null) await marketApi.uninstall(sid)
    uninstallApp(app.id)
    toastSuccess(t('market.uninstalledOk', { name: app.name }), { title: t('market.uninstallSuccess'), duration: 2200 })
    if (sid !== null) void loadApps()
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('market.uninstallFailed'), { title: t('market.uninstallFailed') })
  }
}

const detail = ref<MarketApp | null>(null)
const detailView = ref(false)

/* ---- 详情页评分与评论 ---- */
const COMMENT_PAGE_SIZE = 20

const feedbackLoading = ref(false)
const ratingSummary = ref<MarketRatingSummary>({ averageRating: 0, ratingCount: 0, myRating: null })
const myRatingDraft = ref(0)
const ratingBusy = ref(false)
const comments = ref<ServerMarketComment[]>([])
const commentTotal = ref(0)
const commentPage = ref(0)
const commentDraft = ref('')
const commentPosting = ref(false)

function resetFeedback() {
  ratingSummary.value = { averageRating: 0, ratingCount: 0, myRating: null }
  myRatingDraft.value = 0
  comments.value = []
  commentTotal.value = 0
  commentPage.value = 0
  commentDraft.value = ''
}

/** 加载评分与评论；nextPage > 0 时为「查看更多」追加模式 */
async function loadFeedback(app: MarketApp, nextPage = 0) {
  const sid = serverId(app)
  if (sid === null) return
  feedbackLoading.value = true
  try {
    const fb = await marketApi.feedback(sid, nextPage, COMMENT_PAGE_SIZE)
    comments.value = nextPage === 0 ? fb.comments : [...comments.value, ...fb.comments]
    commentTotal.value = fb.commentTotal
    commentPage.value = nextPage
    ratingSummary.value = { averageRating: fb.averageRating, ratingCount: fb.ratingCount, myRating: fb.myRating }
    myRatingDraft.value = fb.myRating ?? 0
  } catch (err) {
    if (!(err instanceof ApiError && err.offline)) {
      toastError(err instanceof Error ? err.message : t('market.feedback.loadFailed'), { title: t('market.toastTitle') })
    }
  } finally {
    feedbackLoading.value = false
  }
}

function loadMoreComments() {
  const app = detail.value
  if (app) void loadFeedback(app, commentPage.value + 1)
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前（与社区口径一致） */
function relTime(iso: string): string {
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return t('common.justNow')
  if (diff < 3600_000) return t('common.minAgo', { n: Math.floor(diff / 60_000) })
  if (diff < 86400_000) return t('common.hourAgo', { n: Math.floor(diff / 3600_000) })
  return t('common.dayAgo', { n: Math.floor(diff / 86400_000) })
}

/** 是否本人评论（author 即用户名，与社区口径一致） */
function isMyComment(c: ServerMarketComment): boolean {
  return !!auth.session && c.author === auth.session.username
}

/** 打分/撤销的本地乐观推演，服务端响应后以权威汇总覆盖 */
function summaryAfter(prev: MarketRatingSummary, stars: number | null): MarketRatingSummary {
  const oldSum = prev.averageRating * prev.ratingCount
  const newCount = stars === null
    ? Math.max(0, prev.ratingCount - 1)
    : prev.myRating == null ? prev.ratingCount + 1 : prev.ratingCount
  const newSum = oldSum - (prev.myRating ?? 0) + (stars ?? 0)
  return {
    ratingCount: newCount,
    averageRating: newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0,
    myRating: stars,
  }
}

async function onRateChange(stars: number) {
  if (!stars || stars < 1) return
  if (!auth.session) {
    myRatingDraft.value = ratingSummary.value.myRating ?? 0
    toastError(t('market.feedback.loginToRate'), { title: t('common.notLoggedIn') })
    return
  }
  const app = detail.value
  const sid = app ? serverId(app) : null
  if (sid === null) return
  const prev = ratingSummary.value
  ratingSummary.value = summaryAfter(prev, stars) // 乐观更新，立即回显
  myRatingDraft.value = stars
  ratingBusy.value = true
  try {
    const result = await marketApi.rate(sid, stars)
    ratingSummary.value = result
    myRatingDraft.value = result.myRating ?? stars
  } catch (err) {
    ratingSummary.value = prev
    myRatingDraft.value = prev.myRating ?? 0
    toastError(err instanceof Error ? err.message : t('market.feedback.rateFailed'), { title: t('market.feedback.rateFailed') })
  } finally {
    ratingBusy.value = false
  }
}

async function revokeRating() {
  const app = detail.value
  const sid = app ? serverId(app) : null
  if (sid === null) return
  const prev = ratingSummary.value
  ratingSummary.value = summaryAfter(prev, null) // 乐观更新
  myRatingDraft.value = 0
  ratingBusy.value = true
  try {
    ratingSummary.value = await marketApi.removeRating(sid)
    myRatingDraft.value = 0
  } catch (err) {
    ratingSummary.value = prev
    myRatingDraft.value = prev.myRating ?? 0
    toastError(err instanceof Error ? err.message : t('market.feedback.rateFailed'), { title: t('market.feedback.rateFailed') })
  } finally {
    ratingBusy.value = false
  }
}

async function submitComment() {
  const app = detail.value
  const sid = app ? serverId(app) : null
  if (sid === null) return
  if (!auth.session) {
    toastError(t('market.feedback.loginToComment'), { title: t('common.notLoggedIn') })
    return
  }
  const content = commentDraft.value.trim()
  if (!content) {
    toastError(t('market.feedback.commentEmpty'), { title: t('market.feedback.commentFailed') })
    return
  }
  if (content.length > 500) {
    toastError(t('market.feedback.commentTooLong'), { title: t('market.feedback.commentFailed') })
    return
  }
  commentPosting.value = true
  try {
    const c = await marketApi.comment(sid, content)
    comments.value = [c, ...comments.value]
    commentTotal.value += 1
    commentDraft.value = ''
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('market.feedback.commentFailed'), { title: t('market.feedback.commentFailed') })
  } finally {
    commentPosting.value = false
  }
}

async function deleteComment(c: ServerMarketComment) {
  const app = detail.value
  const sid = app ? serverId(app) : null
  if (sid === null) return
  try {
    await ElMessageBox.confirm(t('market.feedback.deleteCommentConfirm'), t('market.feedback.deleteCommentTitle'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await marketApi.removeComment(sid, c.id)
    comments.value = comments.value.filter((x) => x.id !== c.id)
    commentTotal.value = Math.max(0, commentTotal.value - 1)
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('market.feedback.deleteFailed'), { title: t('market.feedback.deleteFailed') })
  }
}

function openDetail(app: MarketApp) {
  detail.value = app
  detailView.value = true
  resetFeedback()
  void loadFeedback(app, 0)
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
          <div class="page-kicker">{{ t('market.kicker') }}</div>
          <h1 class="page-title">{{ t('market.title') }}</h1>
          <p class="page-sub">
            {{ t('market.sub') }}
            <el-tag v-if="offline" type="info" effect="plain">{{ t('market.offline') }}</el-tag>
          </p>
        </div>
        <div class="page-actions">
          <el-input v-model="keyword" :placeholder="t('market.searchPlaceholder')" clearable class="mkt-search">
            <template #prefix>
              <el-icon :size="14"><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <el-radio-group v-model="activeCat" class="cat-group">
        <el-radio-button v-for="c in categories" :key="c" :value="c">{{ catLabel(c) }}</el-radio-button>
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
              <span class="mkt-cat">{{ catLabel(a.category) }}</span>
              <span class="mkt-installs">{{ t('market.installs', { n: a.installs }) }}</span>
            </div>
            <div class="mkt-foot-actions">
              <span v-if="installed.has(a.id)" class="mkt-state">{{ t('market.installed') }}</span>
              <el-button
                type="primary"
                round
                :plain="installed.has(a.id)"
                @click.stop="installed.has(a.id) ? uninstall(a) : install(a)"
              >
                {{ installed.has(a.id) ? t('market.uninstall') : t('market.install') }}
              </el-button>
            </div>
          </div>
        </div>
        <el-empty
          v-if="!filtered.length"
          :description="offline ? t('market.emptyOffline') : t('market.emptyNoMatch')"
          :image-size="96"
          class="empty-block"
        />
        <el-pagination
          v-if="total > PAGE_SIZE"
          class="mkt-pagination"
          layout="prev, pager, next"
          :total="total"
          :page-size="PAGE_SIZE"
          :current-page="page + 1"
          background
          @current-change="onPageChange"
        />
      </div>
    </template>

    <template v-else-if="detail">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="closeDetail">{{ t('market.back') }}</el-button>
      </div>
      <div class="detail-card sec-card">
        <div class="detail-head">
          <div class="mkt-icon" :style="{ background: detail.color }">
            <el-icon :size="22" color="#fff"><component :is="detail.icon" /></el-icon>
          </div>
          <div class="detail-name">{{ detail.name }}</div>
          <div class="detail-cat">{{ catLabel(detail.category) }}</div>
        </div>
        <p class="detail-desc">{{ detail.desc }}</p>
        <div class="detail-meta">
          <span>{{ t('market.installCount', { n: detail.installs }) }}</span>
          <span :class="{ installed: installed.has(detail.id) }">
            {{ installed.has(detail.id) ? t('market.installed') : t('market.notInstalled') }}
          </span>
        </div>
        <div class="detail-actions">
          <el-button
            type="primary"
            :plain="installed.has(detail.id)"
            @click="installed.has(detail.id) ? uninstall(detail) : install(detail)"
          >
            {{ installed.has(detail.id) ? t('market.uninstall') : t('market.install') }}
          </el-button>
        </div>

        <div class="detail-feedback">
          <div class="fb-section">
            <div class="fb-head">
              <span class="fb-title">{{ t('market.feedback.title') }}</span>
              <span v-if="ratingSummary.ratingCount > 0" class="fb-summary">
                {{ ratingSummary.averageRating.toFixed(1) }} · {{ t('market.feedback.ratingCount', { n: ratingSummary.ratingCount }) }}
              </span>
              <span v-else class="fb-summary">{{ t('market.feedback.noRating') }}</span>
            </div>
            <div class="fb-rate-row">
              <el-rate :model-value="myRatingDraft" :disabled="ratingBusy" @change="onRateChange" />
              <span v-if="myRatingDraft > 0" class="fb-my">{{ t('market.feedback.myRating') }}</span>
              <el-button
                v-if="ratingSummary.myRating != null"
                text
                size="small"
                :disabled="ratingBusy"
                class="fb-revoke"
                @click="revokeRating"
              >
                {{ t('market.feedback.revoke') }}
              </el-button>
            </div>
          </div>

          <div class="fb-section">
            <div class="fb-head">
              <span class="fb-title">{{ t('market.feedback.comments') }}</span>
              <span v-if="commentTotal > 0" class="fb-summary">{{ t('market.feedback.commentCount', { n: commentTotal }) }}</span>
            </div>
            <div v-loading="feedbackLoading" class="fb-list">
              <template v-if="comments.length">
                <div v-for="c in comments" :key="c.id" class="fb-item">
                  <div class="fb-item-head">
                    <span class="fb-item-author">{{ c.author }}</span>
                    <span class="fb-item-time">{{ relTime(c.createdAt) }}</span>
                    <el-button v-if="isMyComment(c)" text size="small" class="fb-item-del" @click="deleteComment(c)">
                      {{ t('common.delete') }}
                    </el-button>
                  </div>
                  <p class="fb-item-content">{{ c.content }}</p>
                </div>
                <el-button
                  v-if="comments.length < commentTotal"
                  text
                  size="small"
                  :loading="feedbackLoading"
                  class="fb-more"
                  @click="loadMoreComments"
                >
                  {{ t('market.feedback.loadMore') }}
                </el-button>
              </template>
              <el-empty v-else-if="!feedbackLoading" :description="t('market.feedback.empty')" :image-size="64" class="fb-empty" />
            </div>
            <div class="fb-editor">
              <el-input
                v-model="commentDraft"
                type="textarea"
                :rows="2"
                :maxlength="500"
                show-word-limit
                resize="none"
                :placeholder="t('market.feedback.commentPlaceholder')"
              />
              <el-button type="primary" :loading="commentPosting" @click="submitComment">
                {{ t('market.feedback.publish') }}
              </el-button>
            </div>
          </div>
        </div>
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
  gap: 16px;
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
  margin-top: 4px;
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

/* ---- 详情页评分与评论 ---- */
.detail-feedback {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.fb-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.fb-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.fb-summary {
  font-size: 12px;
  color: var(--text-3);
}

.fb-rate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.fb-my {
  font-size: 12px;
  color: var(--text-2);
}

.fb-revoke {
  padding: 0;
}

.fb-list {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fb-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--panel);
  border-radius: 8px;
}

.fb-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fb-item-author {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}

.fb-item-time {
  font-size: 12px;
  color: var(--text-3);
}

.fb-item-del {
  margin-left: auto;
  padding: 0;
  color: var(--text-3);
}

.fb-item-del:hover {
  color: var(--accent);
}

.fb-item-content {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
  word-break: break-word;
}

.fb-more {
  align-self: center;
  padding: 0;
}

.fb-editor {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 4px;
}

.fb-editor .el-textarea {
  flex: 1;
}
</style>
