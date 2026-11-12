<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  View, ChatDotRound, Search, Star, ArrowRight, ArrowLeft, User,
  Bell, Coin, ShoppingCart, Document, Guide, DataLine, Pointer,
} from '@element-plus/icons-vue'
import { toastSuccess } from '../notify'

interface Post {
  id: string
  title: string
  excerpt: string
  body: string[]
  author: string
  category: string
  views: string
  replies: number
  likes: number
  color: string
  icon: any
}

const categories = ['全部', '经验分享', '指令开发', '行业案例', '问题求助', '版本更新']
const keyword = ref('')
const activeCat = ref('全部')

const posts: Post[] = [
  {
    id: 'p1', title: '用轻羽RPA 搭建电商自动上架流程的完整实践',
    excerpt: '从商品信息采集到批量上架，一条流程覆盖 6 个平台，每天节省 3 小时重复劳动。',
    body: [
      '做电商的朋友应该都懂：商品上架是最耗时却最重复的环节。今天要上架一个 SKU，往往要在 6 个平台分别登录、填表、传图、设置库存，一套流程走下来半小时就没了。',
      '我的思路是把整个上架拆成三段：采集、转换、发布。采集段用「网页数据抓取」把商品信息从源头页面拉下来；转换段用「数据处理」指令做字段映射和格式清洗；发布段按平台分别建立子流程，用「网页自动化」逐项填写并提交。',
      '实际跑下来，单 SKU 上架时间从 30 分钟压缩到 2 分钟，而且夜间可以挂着批量跑。需要注意的两点：一是各平台页面结构经常变，选择器要尽量用稳定的语义属性；二是发布前一定要加一步「人工确认」节点，避免错价直接上架。',
      '流程文件我放在评论区，欢迎大家直接导入改造。有问题也可以在这里留言，我会尽量回复。',
    ],
    author: '飞鸟', category: '经验分享', views: '1.2万', replies: 46, likes: 328,
    color: '#f97154', icon: ShoppingCart,
  },
  {
    id: 'p2', title: '自定义指令开发入门：封装你的第一个 HTTP 请求指令',
    excerpt: '以企业微信 Webhook 推送为例，手把手带你写出可复用的自定义指令。',
    body: [
      '很多同学在用 RPA 时都会遇到这样的场景：某个操作没有现成指令，但本质就是一个 HTTP 请求。这时候与其用一堆基础指令硬拼，不如把它封装成自己的自定义指令。',
      '自定义指令的核心是「输入参数 + 处理逻辑 + 输出结果」。以企业微信 Webhook 为例，输入参数是 Webhook 地址、消息类型、消息内容；处理逻辑是拼接 JSON 报文并发起 POST；输出结果是接口返回的 errcode 与 errmsg。',
      '开发时建议先把参数定义清楚，尤其是哪些是必填、哪些有默认值。参数校验放在指令入口，能避免流程运行到一半才报错。返回值建议统一用 JSON，方便后续节点直接引用字段。',
      '封装完成后记得在指令描述里写清楚适用场景和示例，这样团队其他成员才能复用。这也是自定义指令最大的价值：把个人经验变成团队资产。',
    ],
    author: '青梧', category: '指令开发', views: '8,932', replies: 31, likes: 214,
    color: '#3b6fe0', icon: Document,
  },
  {
    id: 'p3', title: '财务月结自动化：发票识别与台账汇总方案拆解',
    excerpt: 'OCR 识别 + 规则校验 + 汇总报表，月结时间从 2 天缩短到 2 小时。',
    body: [
      '财务月结最痛苦的不是算账，而是把发票信息一条条录进系统。我们公司每月大概有 800 张发票，人工录入不仅慢，还容易出错。',
      '方案分三步：第一步用 OCR 指令批量识别发票上的代码、号码、金额、税额；第二步用规则校验，比如「金额 + 税额 = 价税合计」「发票代码长度固定」；第三步把校验通过的数据写入台账，并生成汇总报表。',
      '识别准确率是这套方案的关键。我们实测下来，增值税专票识别准确率在 98% 左右，剩下的 2% 走人工复核。校验规则会把异常数据单独标记出来，财务只需要处理这些异常，工作量直接下降一个数量级。',
      '整套流程每月 1 号自动运行，异常数据推送到财务群。上线三个月，月结时间从 2 天变成 2 小时。',
    ],
    author: '南山客', category: '行业案例', views: '6,417', replies: 22, likes: 187,
    color: '#a05ff7', icon: Coin,
  },
  {
    id: 'p4', title: '定时触发器不执行？常见排查思路汇总',
    excerpt: '权限、休眠、时区三个高频坑点，附完整排查清单。',
    body: [
      '在社区里，「定时触发器到点不执行」是被问得最多的问题之一。我整理了一份排查清单，按照命中率从高到低排列，基本能覆盖 90% 的情况。',
      '第一，检查电脑是否休眠或关机。定时触发依赖客户端进程在后台运行，如果电脑睡眠或者客户端被关闭，触发自然不会执行。建议在系统设置里允许客户端在后台运行。',
      '第二，检查触发器的时间设置。特别注意时区问题，很多同学设置的时间是本地时间，但系统按 UTC 解析，导致实际触发时间差了 8 小时。',
      '第三，检查关联流程是否存在且可运行。如果流程被删除或者流程本身有未处理的异常，触发器会静默跳过。可以到触发器详情里查看执行记录。',
      '如果以上都排除了还是不执行，欢迎回帖描述你的环境，我会帮你一起看。',
    ],
    author: '拾光', category: '问题求助', views: '5,204', replies: 18, likes: 96,
    color: '#0ea5e9', icon: Bell,
  },
  {
    id: 'p5', title: '数据采集实战：网页表格抓取指令参数详解',
    excerpt: '翻页、去重、增量采集一次讲清楚，附可直接导入的示例流程。',
    body: [
      '网页表格抓取是数据采集里最常用的指令，但参数众多，很多同学只会用默认配置。这篇把关键参数逐个讲清楚。',
      '「选择器」决定抓什么，「翻页设置」决定抓多少页，「去重字段」决定数据是否重复。如果你要抓取一个列表页，建议先设置选择器只匹配表格行，再在字段映射里逐列配置。',
      '翻页有两种方式：点击下一页按钮，或者直接改 URL 参数。前者更通用，后者更稳定。增量采集的核心是「去重字段」，比如用文章 ID 或者链接做唯一标识，配合本地数据文件就能实现断点续采。',
      '示例流程我放在评论区了，包含翻页、去重、增量三个完整例子，导入后改下选择器就能用。',
    ],
    author: '临渊', category: '经验分享', views: '4,876', replies: 15, likes: 142,
    color: '#22c55e', icon: DataLine,
  },
  {
    id: 'p6', title: '新版本解读：设计器性能优化与画布快捷键',
    excerpt: '本次更新画布缩放流畅度提升 60%，新增 12 个高频快捷键。',
    body: [
      '本次版本主要围绕设计器的流畅度和操作效率做了两项优化。',
      '性能方面，画布渲染改成了按需重绘，缩放和平移时的帧率明显提升，大型流程（100 个节点以上）也能流畅拖动。同时优化了节点连线的计算逻辑，连线编辑的响应速度提升约 60%。',
      '效率方面，新增了 12 个高频快捷键，包括节点复制粘贴、快速连线、画布复位、属性面板聚焦等。完整的快捷键列表可以在「帮助中心」里查看。',
      '如果你在使用过程中遇到卡顿或者其他问题，欢迎在仓库 Issue 里反馈，我们会持续跟进。',
    ],
    author: '轻羽团队', category: '版本更新', views: '3,690', replies: 12, likes: 88,
    color: '#6366f1', icon: Guide,
  },
  {
    id: 'p7', title: '求助：Excel 批量处理时单元格格式丢失',
    excerpt: '合并多个工作表后日期列变成数字，有人遇到过吗？',
    body: [
      '如题，我用 Excel 处理指令合并了 20 多个工作表，结果日期列全变成了 45231 这样的数字序列，格式完全丢了。',
      '我试过在合并后加一步「设置单元格格式」，但好像不生效。有没有同学知道正确的处理方式？',
      '补充一下环境：源文件都是 .xlsx，日期列在源文件里是正常的日期格式，合并后才出问题。',
    ],
    author: '小白鼠', category: '问题求助', views: '2,113', replies: 9, likes: 27,
    color: '#ec4899', icon: User,
  },
  {
    id: 'p8', title: '年度热帖回顾：社区最受欢迎的 10 条自定义指令',
    excerpt: '从文件监控到邮件自动化，全部可直接安装使用。',
    body: [
      '年底了，我们把社区这一年里最受欢迎的自定义指令做了一个盘点，涵盖文件监控、邮件自动化、数据同步、报表生成等方向。',
      '这些指令全部由社区成员贡献，经过实际项目验证，可以直接安装使用。每条指令都附有详细的使用说明和示例流程。',
      '如果你也有好用的自定义指令，欢迎分享到社区。下一年的盘点里，也许就有你的作品。',
      '完整榜单和安装方式见评论区，感谢每一位贡献者。',
    ],
    author: '社区运营', category: '经验分享', views: '1,988', replies: 7, likes: 65,
    color: '#f59e0b', icon: Star,
  },
]

const filtered = computed(() => {
  const k = keyword.value.trim()
  return posts.filter((p) => {
    const matchCat = activeCat.value === '全部' || p.category === activeCat.value
    const matchKw = !k || p.title.includes(k) || p.excerpt.includes(k)
    return matchCat && matchKw
  })
})

const hot = computed(() => [...posts].sort((a, b) => b.likes - a.likes).slice(0, 5))

/* ---- 帖子正文 ---- */
const detailView = ref(false)
const detail = ref<Post | null>(null)
const likedIds = reactive<Set<string>>(new Set())
const likeDelta = reactive<Record<string, number>>({})

function open(post: Post) {
  detail.value = post
  detailView.value = true
}

function closeDetail() {
  detailView.value = false
  detail.value = null
}

function toggleLike(post: Post | null) {
  if (!post) return
  if (likedIds.has(post.id)) {
    likedIds.delete(post.id)
    likeDelta[post.id] = (likeDelta[post.id] ?? 0) - 1
  } else {
    likedIds.add(post.id)
    likeDelta[post.id] = (likeDelta[post.id] ?? 0) + 1
  }
}

function likeCount(post: Post | null): number {
  return post ? post.likes + (likeDelta[post.id] ?? 0) : 0
}

/* ---- 本地回复 ---- */
const replyVisible = ref(false)
const replyText = ref('')
const replyList = ref<Record<string, string[]>>({})

function toggleReply() {
  replyVisible.value = !replyVisible.value
}

function submitReply(post: Post | null) {
  if (!post) return
  const text = replyText.value.trim()
  if (!text) return
  if (!replyList.value[post.id]) replyList.value[post.id] = []
  replyList.value[post.id].push(text)
  replyText.value = ''
  replyVisible.value = false
  toastSuccess('回复已发表', { title: '回复成功', duration: 1800 })
}

function catTag(cat: string) {
  return cat === '问题求助' ? 'warning' : cat === '版本更新' ? 'primary' : 'success'
}
</script>

<template>
  <section class="page">
    <template v-if="!detailView">
      <div class="page-head">
        <div class="page-head-main">
          <div class="page-kicker">创作者社区</div>
          <h1 class="page-title">社区</h1>
          <p class="page-sub">与自动化创作者交流经验、分享指令与案例</p>
        </div>
        <div class="page-actions">
          <el-input v-model="keyword" placeholder="搜索帖子" clearable class="mkt-search">
            <template #prefix>
              <el-icon :size="14"><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <el-radio-group v-model="activeCat" class="cat-group">
        <el-radio-button v-for="c in categories" :key="c" :value="c">{{ c }}</el-radio-button>
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
                <el-tag :type="catTag(p.category)" effect="light" round>{{ p.category }}</el-tag>
              </div>
              <div class="post-excerpt">{{ p.excerpt }}</div>
              <div class="post-meta">
                <span class="post-author">{{ p.author }}</span>
                <span><el-icon :size="12"><View /></el-icon>{{ p.views }}</span>
                <span><el-icon :size="12"><ChatDotRound /></el-icon>{{ p.replies }}</span>
                <span><el-icon :size="12"><Star /></el-icon>{{ p.likes }}</span>
              </div>
            </div>
            <el-icon :size="14" class="post-arrow"><ArrowRight /></el-icon>
          </div>
          <el-empty
            v-if="!filtered.length"
            description="没有找到匹配的帖子"
            :image-size="96"
            class="empty-block"
          />
        </div>

        <aside class="comm-side">
          <div class="side-card sec-card">
            <div class="side-card-title">热门帖子</div>
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
            <div class="side-card-title">发帖规则</div>
            <ul class="rule-list">
              <li>友善交流，尊重每一位创作者</li>
              <li>禁止发布广告与无关内容</li>
              <li>分享流程请标注使用环境与版本</li>
            </ul>
          </div>
        </aside>
      </div>
    </template>

    <template v-else-if="detail">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="closeDetail">返回社区</el-button>
      </div>
      <div class="detail-page sec-card">
        <div class="detail-head">
          <div class="post-icon" :style="{ background: detail.color }">
            <el-icon :size="18" color="#fff"><component :is="detail.icon" /></el-icon>
          </div>
          <div class="detail-head-main">
            <div class="detail-author">{{ detail.author }}</div>
            <div class="detail-meta">
              <el-tag :type="catTag(detail.category)" effect="light" round>{{ detail.category }}</el-tag>
              <span><el-icon :size="12"><View /></el-icon>{{ detail.views }}</span>
              <span><el-icon :size="12"><ChatDotRound /></el-icon>{{ detail.replies }}</span>
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
            :type="likedIds.has(detail.id) ? 'primary' : 'default'"
            :plain="!likedIds.has(detail.id)"
            :icon="Pointer"
            @click="toggleLike(detail)"
          >
            点赞 {{ likeCount(detail) }}
          </el-button>
          <el-button round :icon="ChatDotRound" @click="toggleReply">回复</el-button>
        </div>

        <div v-if="replyList[detail.id]?.length" class="reply-list">
          <div class="reply-title">本地回复 {{ replyList[detail.id].length }}</div>
          <div v-for="(r, i) in replyList[detail.id]" :key="i" class="reply-item">
            <span class="reply-author">我</span>
            <span class="reply-text">{{ r }}</span>
          </div>
        </div>

        <div v-if="replyVisible" class="reply-editor">
          <el-input
            v-model="replyText"
            type="textarea"
            :rows="3"
            placeholder="写下你的回复…"
            @keydown.enter.prevent="submitReply(detail)"
          />
          <div class="reply-editor-foot">
            <el-button @click="toggleReply">取消</el-button>
            <el-button type="primary" @click="submitReply(detail)">发表回复</el-button>
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
  gap: 14px;
  align-items: flex-start;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
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
  gap: 3px;
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
  margin-bottom: 10px;
}

.hot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 6px;
  cursor: pointer;
}

.hot-item:hover {
  background: var(--panel);
}

.hot-rank {
  width: 18px;
  height: 18px;
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
  gap: 3px;
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
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.reply-list {
  padding-top: 14px;
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
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.reply-editor-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .comm-side {
    display: none;
  }
}
</style>
