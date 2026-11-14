<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  ChatDotRound, Search, Star, ArrowRight, ArrowLeft, Delete,
  Bell, Coin, ShoppingCart, Document, Guide, DataLine, Pointer, Download,
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { communityApi, flowShareApi, ApiError, type ServerPost, type SharedFlowItem } from '../api'
import { useAppStore } from '../store'
import { useAuthStore } from '../auth'
import { toastError, toastSuccess } from '../notify'
import { t, type MessageKey } from '../i18n'

interface Post {
  id: number
  title: string
  excerpt: string
  body: string[]
  author: string
  category: string
  likes: number
  liked: boolean
  replies: { id: number; author: string; content: string }[]
  color: string
  icon: any
}

const categories = ['全部', '经验分享', '指令开发', '行业案例', '问题求助', '版本更新']
const keyword = ref('')
const activeCat = ref('全部')
const appStore = useAppStore()
const auth = useAuthStore()

/** 分类值（发给服务端）→ 显示文案 */
const CAT_KEYS: Record<string, MessageKey> = {
  全部: 'community.cat.all',
  经验分享: 'community.cat.experience',
  指令开发: 'community.cat.dev',
  行业案例: 'community.cat.case',
  问题求助: 'community.cat.help',
  版本更新: 'community.cat.release',
}
const catLabel = (c: string) => t(CAT_KEYS[c] ?? 'community.cat.all')

/** 服务端分页大小 */
const PAGE_SIZE = 20

/** 按分类推断帖子图标与主色 */
function iconForCat(cat: string): { color: string; icon: any } {
  switch (cat) {
    case '经验分享': return { color: '#f97154', icon: ShoppingCart }
    case '指令开发': return { color: '#3b6fe0', icon: Document }
    case '行业案例': return { color: '#a05ff7', icon: Coin }
    case '问题求助': return { color: '#0ea5e9', icon: Bell }
    case '版本更新': return { color: '#6366f1', icon: Guide }
    default: return { color: '#22c55e', icon: DataLine }
  }
}

/** 服务端帖子 → 本地视图模型（正文按空行分段） */
function toLocal(p: ServerPost): Post {
  const paras = p.content.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  const cat = categories.includes(p.category) ? p.category : '经验分享'
  return {
    id: p.id,
    title: p.title,
    excerpt: paras[0]?.slice(0, 80) ?? '',
    body: paras.length ? paras : [t('community.noBody')],
    author: p.author,
    category: cat,
    likes: p.likes,
    liked: p.liked,
    replies: p.replies.map((r) => ({ id: r.id, author: r.author, content: r.content })),
    ...iconForCat(cat),
  }
}

const posts = ref<Post[]>([])
const offline = ref(false)
const loading = ref(false)
const page = ref(0)
const total = ref(0)

async function loadPosts() {
  loading.value = true
  try {
    const sort = activeCat.value === '全部' ? 'hot' : 'latest'
    const res = await communityApi.listPosts(sort, keyword.value.trim(), activeCat.value, page.value, PAGE_SIZE)
    posts.value = res.items.map(toLocal)
    total.value = res.total
    offline.value = false
  } catch (err) {
    offline.value = true
    posts.value = []
    total.value = 0
    if (!(err instanceof ApiError && err.offline)) {
      toastError(err instanceof Error ? err.message : t('community.loadFailed'), { title: t('community.title') })
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadPosts()
  loadSharedFlows()
})

let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(() => {
    page.value = 0
    loadPosts()
  }, 350)
})

/* 切换分类：直接按服务端分类过滤重新加载 */
watch(activeCat, () => {
  page.value = 0
  loadPosts()
})

function onPageChange(p: number) {
  page.value = p - 1
  loadPosts()
}

const filtered = computed(() => posts.value)
const hot = computed(() => [...posts.value].sort((a, b) => b.likes - a.likes).slice(0, 5))

/* ---- 流程广场：云端共享流程 ---- */
const sharedFlows = ref<SharedFlowItem[]>([])
const sharedOffline = ref(true)
const importing = ref(false)

async function loadSharedFlows() {
  try {
    sharedFlows.value = await flowShareApi.list('latest', '')
    sharedOffline.value = false
  } catch {
    sharedOffline.value = true
    sharedFlows.value = []
  }
}

async function importShared(item: SharedFlowItem) {
  importing.value = true
  try {
    const raw = await flowShareApi.download(item.id)
    await appStore.importFlow(raw)
    toastSuccess(t('community.importedOk', { name: item.name }), { title: t('community.importSuccess'), duration: 2400 })
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('community.importFailed'), { title: t('community.importFailed') })
  } finally {
    importing.value = false
  }
}

function relTime(iso: string): string {
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return t('common.justNow')
  if (diff < 3600_000) return t('common.minAgo', { n: Math.floor(diff / 60_000) })
  if (diff < 86400_000) return t('common.hourAgo', { n: Math.floor(diff / 3600_000) })
  return t('common.dayAgo', { n: Math.floor(diff / 86400_000) })
}

/* ---- 帖子正文 ---- */
const detailView = ref(false)
const detail = ref<Post | null>(null)

/** 当前登录用户是否为帖子作者（作者本人可删帖） */
function isMine(post: Post | null): boolean {
  return !!post && !!auth.session && post.author === auth.session.username && post.id > 0
}

/** 当前登录用户是否为回复作者（回复作者本人可删回复） */
function isMyReply(reply: { author: string }): boolean {
  return !!auth.session && reply.author === auth.session.username
}

/* ---- 删除帖子 ---- */
const deleting = ref(false)

async function removePost(post: Post) {
  if (!post) return
  try {
    await ElMessageBox.confirm(t('community.deletePostConfirm'), t('community.deletePost'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })
  } catch {
    return
  }
  deleting.value = true
  try {
    await communityApi.removePost(post.id)
    posts.value = posts.value.filter((p) => p.id !== post.id)
    detailView.value = false
    detail.value = null
    toastSuccess(t('community.postDeleted'), { title: t('community.deleteSuccess'), duration: 1800 })
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('community.deleteFailed'), { title: t('community.deleteFailed') })
  } finally {
    deleting.value = false
  }
}

async function open(post: Post) {
  detail.value = post
  detailView.value = true
  // 打开详情时尝试刷新服务端最新数据（回复 / 点赞）
  if (!offline.value) {
    try {
      const fresh = await communityApi.detail(post.id)
      const mapped = toLocal(fresh)
      const idx = posts.value.findIndex((p) => p.id === post.id)
      if (idx >= 0) posts.value[idx] = mapped
      detail.value = mapped
    } catch {
      /* 保留当前数据 */
    }
  }
}

function closeDetail() {
  detailView.value = false
  detail.value = null
}

async function toggleLike(post: Post | null) {
  if (!post) return
  if (!auth.session) {
    toastError(t('community.loginToLike'), { title: t('common.notLoggedIn') })
    return
  }
  if (offline.value) {
    toastError(t('community.offlineLike'), { title: t('community.offline') })
    return
  }
  try {
    // 服务端点赞切换：已点赞则取消，未点赞则 +1；liked 状态以服务端记录为准
    const res = await communityApi.like(post.id)
    post.liked = res.liked
    post.likes = res.likes
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('community.likeFailed'), { title: t('community.likeFailed') })
  }
}

/* ---- 删除回复 ---- */
const removingReplyId = ref<number | null>(null)

async function removeReply(post: Post | null, reply: { id: number; author: string; content: string }) {
  if (!post || !reply.id) return
  try {
    await ElMessageBox.confirm(t('community.deleteReplyConfirm'), t('community.deleteReply'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })
  } catch {
    return
  }
  removingReplyId.value = reply.id
  try {
    await communityApi.removeReply(post.id, reply.id)
    post.replies = post.replies.filter((r) => r.id !== reply.id)
    toastSuccess(t('community.replyDeleted'), { title: t('community.deleteSuccess'), duration: 1800 })
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('community.deleteFailed'), { title: t('community.deleteFailed') })
  } finally {
    removingReplyId.value = null
  }
}

function likeCount(post: Post | null): number {
  return post ? post.likes : 0
}

/* ---- 回复 ---- */
const replyVisible = ref(false)
const replyText = ref('')
const replySubmitting = ref(false)

function toggleReply() {
  if (!auth.session) {
    toastError(t('community.loginToReply'), { title: t('common.notLoggedIn') })
    return
  }
  replyVisible.value = !replyVisible.value
}

async function submitReply(post: Post | null) {
  if (!post) return
  const text = replyText.value.trim()
  if (!text) return
  if (offline.value) {
    toastError(t('community.offlineReply'), { title: t('community.offline') })
    return
  }
  replySubmitting.value = true
  try {
    const r = await communityApi.reply(post.id, text)
    post.replies.push({ id: r.id, author: r.author, content: r.content })
    replyText.value = ''
    replyVisible.value = false
    toastSuccess(t('community.replyOk'), { title: t('community.replySuccess'), duration: 1800 })
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('community.replyFailed'), { title: t('community.replyFailed') })
  } finally {
    replySubmitting.value = false
  }
}

/* ---- 发帖（独立页面视图） ---- */
const composeView = ref(false)
const postForm = reactive({ title: '', content: '', category: '经验分享' })
const postSubmitting = ref(false)
const composerCats = categories.filter((c) => c !== '全部')

function openComposer() {
  if (!auth.session) {
    toastError(t('community.loginToPost'), { title: t('common.notLoggedIn') })
    return
  }
  postForm.title = ''
  postForm.content = ''
  postForm.category = '经验分享'
  detailView.value = false
  composeView.value = true
}

function closeComposer() {
  composeView.value = false
}

async function submitPost() {
  const title = postForm.title.trim()
  const content = postForm.content.trim()
  if (!title) {
    toastError(t('community.titleRequired'), { title: t('community.newPost') })
    return
  }
  if (!content) {
    toastError(t('community.contentRequired'), { title: t('community.newPost') })
    return
  }
  postSubmitting.value = true
  try {
    const created = await communityApi.createPost(title, content, postForm.category)
    posts.value.unshift(toLocal(created))
    composeView.value = false
    toastSuccess(t('community.postCreated'), { title: t('community.postSuccess'), duration: 2000 })
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('community.postFailed'), { title: t('community.postFailed') })
  } finally {
    postSubmitting.value = false
  }
}

function catTag(cat: string) {
  return cat === '问题求助' ? 'warning' : cat === '版本更新' ? 'primary' : 'success'
}
</script>

<template>
  <section class="page">
    <template v-if="composeView">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="closeComposer">{{ t('community.back') }}</el-button>
      </div>
      <div class="compose-page sec-card">
        <h2 class="compose-title">{{ t('community.composeTitle') }}</h2>
        <el-form label-position="top" class="compose-form">
          <el-form-item :label="t('community.labelTitle')">
            <el-input v-model="postForm.title" maxlength="120" show-word-limit :placeholder="t('community.titlePlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('community.labelCategory')">
            <el-radio-group v-model="postForm.category">
              <el-radio-button v-for="c in composerCats" :key="c" :value="c">{{ catLabel(c) }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="t('community.labelContent')">
            <el-input
              v-model="postForm.content"
              type="textarea"
              :rows="12"
              maxlength="20000"
              show-word-limit
              :placeholder="t('community.contentPlaceholder')"
            />
          </el-form-item>
        </el-form>
        <div class="compose-actions">
          <el-button @click="closeComposer">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="postSubmitting" @click="submitPost">{{ t('community.publish') }}</el-button>
        </div>
      </div>
    </template>

    <template v-else-if="!detailView">
      <div class="page-head">
        <div class="page-head-main">
          <div class="page-kicker">{{ t('community.kicker') }}</div>
          <h1 class="page-title">{{ t('community.title') }}</h1>
          <p class="page-sub">{{ t('community.sub') }}</p>
        </div>
        <div class="page-actions">
          <el-button round :icon="Pointer" @click="openComposer">{{ t('community.newPost') }}</el-button>
          <el-input v-model="keyword" :placeholder="t('community.searchPlaceholder')" clearable class="mkt-search">
            <template #prefix>
              <el-icon :size="14"><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <el-radio-group v-model="activeCat" class="cat-group">
        <el-radio-button v-for="c in categories" :key="c" :value="c">{{ catLabel(c) }}</el-radio-button>
      </el-radio-group>

      <div class="comm-layout">
        <div class="comm-main">
          <div
            v-for="p in filtered"
            :key="p.id"
            class="comm-post"
            role="button"
            tabindex="0"
            @click="open(p)"
            @keydown.enter="open(p)"
          >
            <div class="post-icon" :style="{ background: p.color }">
              <el-icon :size="18" color="#fff"><component :is="p.icon" /></el-icon>
            </div>
            <div class="post-main">
              <div class="post-title">
                {{ p.title }}
                <el-tag :type="catTag(p.category)" effect="light" round>{{ catLabel(p.category) }}</el-tag>
              </div>
              <div class="post-excerpt">{{ p.excerpt }}</div>
              <div class="post-meta">
                <span class="post-author">{{ p.author }}</span>
                <span><el-icon :size="12"><ChatDotRound /></el-icon>{{ p.replies.length }}</span>
                <span><el-icon :size="12"><Star /></el-icon>{{ p.likes }}</span>
              </div>
            </div>
            <el-icon :size="14" class="post-arrow"><ArrowRight /></el-icon>
          </div>
          <el-pagination
            v-if="total > PAGE_SIZE"
            class="comm-pagination"
            layout="prev, pager, next"
            :total="total"
            :page-size="PAGE_SIZE"
            :current-page="page + 1"
            background
            @current-change="onPageChange"
          />
          <el-empty
            v-if="!filtered.length"
            :description="offline ? t('community.emptyOffline') : t('community.emptyNoMatch')"
            :image-size="96"
            class="empty-block"
          />
        </div>

        <aside class="comm-side">
          <div class="side-card sec-card">
            <div class="side-card-title">{{ t('community.hot') }}</div>
            <div
              v-for="(h, i) in hot"
              :key="h.id"
              class="hot-item"
              role="button"
              tabindex="0"
              @click="open(h)"
              @keydown.enter="open(h)"
            >
              <span class="hot-rank" :class="{ top: i < 3 }">{{ i + 1 }}</span>
              <span class="hot-title">{{ h.title }}</span>
            </div>
          </div>
          <div class="side-card sec-card">
            <div class="side-card-title">{{ t('community.flowPlaza') }}</div>
            <div v-if="sharedFlows.length === 0" class="flow-empty">
              {{ sharedOffline ? t('community.plazaOffline') : t('community.plazaEmpty') }}
            </div>
            <div
              v-for="f in sharedFlows.slice(0, 8)"
              :key="f.id"
              class="flow-item"
            >
              <div class="flow-item-main">
                <div class="flow-item-name" :title="f.name">{{ f.name }}</div>
                <div class="flow-item-meta">{{ f.author }} · {{ t('community.nodeCount', { n: f.nodeCount }) }} · {{ relTime(f.createdAt) }}</div>
              </div>
              <el-button
                type="primary"
                plain
                round
                :icon="Download"
                :loading="importing"
                @click="importShared(f)"
              >
                {{ t('community.import') }}
              </el-button>
            </div>
          </div>
          <div class="side-card sec-card">
            <div class="side-card-title">{{ t('community.rules') }}</div>
            <ul class="rule-list">
              <li>{{ t('community.rule1') }}</li>
              <li>{{ t('community.rule2') }}</li>
              <li>{{ t('community.rule3') }}</li>
            </ul>
          </div>
        </aside>
      </div>
    </template>

    <template v-else-if="detail">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="closeDetail">{{ t('community.back') }}</el-button>
      </div>
      <div class="detail-page sec-card">
        <div class="detail-head">
          <div class="post-icon" :style="{ background: detail.color }">
            <el-icon :size="18" color="#fff"><component :is="detail.icon" /></el-icon>
          </div>
          <div class="detail-head-main">
            <div class="detail-author">{{ detail.author }}</div>
            <div class="detail-meta">
              <el-tag :type="catTag(detail.category)" effect="light" round>{{ catLabel(detail.category) }}</el-tag>
              <span><el-icon :size="12"><ChatDotRound /></el-icon>{{ detail.replies.length }}</span>
              <span><el-icon :size="12"><Star /></el-icon>{{ detail.likes }}</span>
            </div>
          </div>
        </div>

        <h2 class="detail-page-title">{{ detail.title }}</h2>

        <div class="detail-body">
          <p v-for="(para, i) in detail.body" :key="i">{{ para }}</p>
        </div>

        <div class="detail-actions">
          <el-button
            round
            :type="detail.liked ? 'primary' : 'default'"
            :plain="!detail.liked"
            :icon="Pointer"
            @click="toggleLike(detail)"
          >
            {{ detail.liked ? t('community.liked') : t('community.like') }} {{ likeCount(detail) }}
          </el-button>
          <el-button round :icon="ChatDotRound" @click="toggleReply">{{ t('community.reply') }}</el-button>
          <el-button
            v-if="isMine(detail)"
            round
            type="danger"
            plain
            :icon="Delete"
            :loading="deleting"
            @click="removePost(detail)"
          >
            {{ t('community.deletePost') }}
          </el-button>
        </div>

        <div v-if="detail.replies.length" class="reply-list">
          <div class="reply-title">{{ t('community.replies', { n: detail.replies.length }) }}</div>
          <div v-for="r in detail.replies" :key="r.id" class="reply-item">
            <span class="reply-author">{{ r.author }}</span>
            <span class="reply-text">{{ r.content }}</span>
            <el-button
              v-if="isMyReply(r)"
              class="reply-del"
              link
              type="danger"
              size="small"
              :loading="removingReplyId === r.id"
              @click="removeReply(detail, r)"
            >
              {{ t('common.delete') }}
            </el-button>
          </div>
        </div>

        <div v-if="replyVisible" class="reply-editor">
          <el-input
            v-model="replyText"
            type="textarea"
            :rows="3"
            :placeholder="t('community.replyPlaceholder')"
            @keydown.enter.prevent="submitReply(detail)"
          />
          <div class="reply-editor-foot">
            <el-button @click="toggleReply">{{ t('common.cancel') }}</el-button>
            <el-button type="primary" :loading="replySubmitting" @click="submitReply(detail)">{{ t('community.replySubmit') }}</el-button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* ---- 帖子列表 ---- */
.comm-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.comm-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comm-post {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

[data-theme='dark'] .comm-post {
  background: var(--panel);
}

.comm-post:hover {
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.comm-post:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.post-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.post-main {
  flex: 1;
  min-width: 0;
}

.post-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 8px;
}

.post-excerpt {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.post-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--text-3);
}

.post-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.post-author {
  color: var(--text-2);
}

.post-arrow {
  color: var(--text-3);
  margin-top: 12px;
  flex-shrink: 0;
}

.comm-side {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 0;
}

.side-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 8px;
}

.hot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 8px;
  cursor: pointer;
}

.hot-item:hover {
  background: var(--panel);
}

.hot-rank {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--panel);
  color: var(--text-3);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hot-rank.top {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}

.hot-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.9;
}

/* ---- 流程广场 ---- */
.flow-empty {
  font-size: 12px;
  color: var(--text-3);
  padding: 8px 0;
}

.flow-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border-radius: 8px;
}

.flow-item:hover {
  background: var(--panel);
}

.flow-item-main {
  flex: 1;
  min-width: 0;
}

.flow-item-name {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-item-meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-3);
}

/* ---- 发帖页 ---- */
.compose-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.compose-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.compose-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.compose-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.compose-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* ---- 帖子详情页 ---- */
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.5;
}

.post-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-head {
  display: flex;
  gap: 12px;
  align-items: center;
}

.detail-head-main {
  flex: 1;
  min-width: 0;
}

.detail-author {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.detail-meta {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-3);
}

.detail-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.detail-body {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.9;
}

.detail-body p {
  margin: 0 0 12px;
}

.detail-body p:last-child {
  margin-bottom: 0;
}

.detail-actions {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.reply-list {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.reply-title {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}

.reply-item {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  line-height: 1.6;
}

.reply-author {
  flex-shrink: 0;
  font-weight: 500;
  color: var(--accent);
}

.reply-text {
  color: var(--text-2);
}

.reply-editor {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.reply-editor-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* ---- 分页 ---- */
.comm-pagination {
  margin-top: 4px;
  justify-content: center;
}

/* 回复行的删除入口 */
.reply-item .reply-del {
  margin-left: auto;
  flex-shrink: 0;
}

@media (max-width: 1100px) {
  .comm-side {
    display: none;
  }
}
</style>
