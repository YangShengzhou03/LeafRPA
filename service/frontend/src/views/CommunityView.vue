<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  api, currentUser, POST_CATEGORIES,
  type PostDto, type ReplyDto, type LikeResult, type PageResult,
} from '../api'

/** 服务端分页大小 */
const PAGE_SIZE = 20

const posts = ref<PostDto[]>([])
const hot = ref(false)
const category = ref('全部')
const keyword = ref('')
const loading = ref(false)
const dialog = ref(false)
const draft = reactive({ title: '', content: '', category: '经验分享' })
const page = ref(0)
const total = ref(0)

function isMine(p: PostDto): boolean {
  return currentUser() === p.author
}

/** 当前登录用户是否为回复作者（回复作者本人可删） */
function isMyReply(r: ReplyDto): boolean {
  return currentUser() === r.author
}

async function load() {
  loading.value = true
  try {
    const q = new URLSearchParams({ sort: hot.value ? 'hot' : 'latest', page: String(page.value), size: String(PAGE_SIZE) })
    if (category.value !== '全部') q.set('category', category.value)
    if (keyword.value.trim()) q.set('keyword', keyword.value.trim())
    const res = await api<PageResult<PostDto>>('get', `/community/posts?${q.toString()}`)
    posts.value = res.items
    total.value = res.total
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载帖子失败')
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

function openDialog() {
  draft.title = ''
  draft.content = ''
  draft.category = '经验分享'
  dialog.value = true
}

async function create() {
  if (!draft.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!draft.content.trim()) {
    ElMessage.warning('请输入正文')
    return
  }
  try {
    await api<PostDto>('post', '/community/posts', { ...draft })
    dialog.value = false
    ElMessage.success('发布成功')
    // 重新加载以套用当前排序 / 筛选 / 分页
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '发布失败')
  }
}

async function like(p: PostDto) {
  if (!currentUser()) {
    ElMessage.warning('请先登录后再点赞')
    return
  }
  try {
    const r = await api<LikeResult>('post', `/community/posts/${p.id}/like`)
    p.likes = r.likes
    p.liked = r.liked
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '点赞失败')
  }
}

async function removeReply(p: PostDto, r: ReplyDto) {
  try {
    await ElMessageBox.confirm('删除后该回复无法恢复。', '删除回复', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await api('delete', `/community/posts/${p.id}/replies/${r.id}`)
    p.replies = p.replies.filter((x) => x.id !== r.id)
    ElMessage.success('回复已删除')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  }
}

async function reply(p: PostDto) {
  if (!currentUser()) {
    ElMessage.warning('请先登录后再回复')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('输入回复内容', '回复', { inputType: 'textarea' })
    if (!value?.trim()) return
    const r = await api<ReplyDto>('post', `/community/posts/${p.id}/replies`, { content: value })
    p.replies.push(r)
  } catch (err) {
    if (err instanceof Error && err.message) {
      ElMessage.error(err.message)
    }
    /* 其余视为用户取消 */
  }
}

async function remove(p: PostDto) {
  try {
    await ElMessageBox.confirm('删除后帖子与全部回复将一并移除，且无法恢复。', '删除帖子', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await api('delete', `/community/posts/${p.id}`)
    posts.value = posts.value.filter((x) => x.id !== p.id)
    ElMessage.success('帖子已删除')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
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
      <el-radio-group v-model="hot" @change="reloadFromFirst">
        <el-radio-button :value="false">最新</el-radio-button>
        <el-radio-button :value="true">热门</el-radio-button>
      </el-radio-group>
      <el-radio-group v-model="category" style="margin-left: 16px" @change="reloadFromFirst">
        <el-radio-button value="全部">全部</el-radio-button>
        <el-radio-button v-for="c in POST_CATEGORIES" :key="c" :value="c">{{ c }}</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="keyword"
        placeholder="搜索帖子"
        clearable
        style="width: 200px; margin-left: 16px"
      />
      <el-button type="primary" :disabled="!currentUser()" @click="openDialog">发帖</el-button>
    </el-form>

    <div v-loading="loading">
      <el-empty v-if="posts.length === 0 && !loading" description="还没有帖子" />
      <el-card v-for="p in posts" :key="p.id" shadow="hover" style="margin-bottom: 12px">
        <div class="post-title">
          {{ p.title }}
          <el-tag size="small" type="info">{{ p.category }}</el-tag>
        </div>
        <div class="post-content">{{ p.content }}</div>
        <div class="post-foot">
          <span>{{ p.author }} · {{ new Date(p.createdAt).toLocaleString() }}</span>
          <el-button
            size="small"
            :type="p.liked ? 'primary' : 'default'"
            :plain="!p.liked"
            @click="like(p)"
          >
            {{ p.liked ? '已赞' : '点赞' }} {{ p.likes }}
          </el-button>
          <el-button size="small" @click="reply(p)">回复 {{ p.replies.length }}</el-button>
          <el-button v-if="isMine(p)" size="small" type="danger" plain @click="remove(p)">删除</el-button>
        </div>
        <el-divider v-if="p.replies.length" style="margin: 8px 0" />
        <div v-for="r in p.replies" :key="r.id" class="reply">
          <b>{{ r.author }}</b>：{{ r.content }}
          <el-button v-if="isMyReply(r)" link type="danger" size="small" @click="removeReply(p, r)">删除</el-button>
        </div>
      </el-card>

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

    <el-dialog v-model="dialog" title="发布帖子" width="520">
      <el-form label-width="48">
        <el-form-item label="标题"><el-input v-model="draft.title" maxlength="120" /></el-form-item>
        <el-form-item label="分类">
          <el-radio-group v-model="draft.category">
            <el-radio-button v-for="c in POST_CATEGORIES" :key="c" :value="c">{{ c }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="正文">
          <el-input v-model="draft.content" type="textarea" :rows="6" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="create">发布</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.post-title {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.post-content {
  margin: 8px 0;
  white-space: pre-wrap;
  color: #555;
}
.post-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #999;
  font-size: 12px;
}
.reply {
  font-size: 13px;
  color: #555;
  padding: 2px 0;
}
</style>
