/**
 * 桌面端 → 服务端 API 客户端。
 * 服务端统一入口为 nginx 80/443（/api/ 前缀反代到后端），默认 http://192.168.65.101；
 * 打包前可用构建环境变量 VITE_SERVER_BASE 覆盖默认入口；
 * 本机调试可用 localStorage（leaf-rpa.serverBase）覆盖为 http://127.0.0.1:8081。
 * 统一响应 { code, message, data }。
 * 网络不可达时抛出 ApiError（err.offline = true），调用方可据此回退本地模式。
 */

const ENV_BASE = (import.meta.env?.VITE_SERVER_BASE as string | undefined)?.trim()

export const SERVER_BASE =
  (typeof localStorage !== 'undefined' && localStorage.getItem('leaf-rpa.serverBase')) ||
  ENV_BASE ||
  'http://192.168.65.101'

export class ApiError extends Error {
  /** 服务不可达（未启动 / 网络故障） */
  offline: boolean
  /** HTTP 状态码（0 表示网络层失败） */
  status: number

  constructor(message: string, offline = false, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.offline = offline
    this.status = status
  }
}

const TOKEN_KEY = 'leaf-rpa.token.v1'

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 忽略 */
  }
}

interface ApiResponseEnvelope<T> {
  code: number
  message: string
  data: T
}

async function request<T>(
  path: string,
  options: {
    method?: string
    json?: unknown
    form?: FormData
    timeoutMs?: number
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000)
  let res: Response
  try {
    res = await fetch(`${SERVER_BASE}${path}`, {
      method,
      headers: {
        ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: options.form ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
      signal: controller.signal,
    })
  } catch {
    throw new ApiError('服务未启动或网络不可达', true)
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 401) {
    setToken('')
    // token 失效 / 未登录：广播会话过期事件，由 auth store 统一登出并回到登录页
    window.dispatchEvent(new CustomEvent('leaf-rpa:unauthorized'))
    throw new ApiError('登录已过期，请重新登录', false, 401)
  }
  let envelope: ApiResponseEnvelope<T>
  try {
    envelope = (await res.json()) as ApiResponseEnvelope<T>
  } catch {
    throw new ApiError(`服务响应异常（HTTP ${res.status}）`, res.status === 0, res.status)
  }
  if (envelope.code !== 0) {
    throw new ApiError(envelope.message || '请求失败', false, res.status)
  }
  return envelope.data
}

/* ---------- 认证 ---------- */

export interface ServerSession {
  username: string
  phone: string
  loginAt: number
  token: string
}

export const authApi = {
  register(username: string, phone: string, password: string, code: string): Promise<ServerSession> {
    return request('/api/auth/register', { method: 'POST', json: { username, phone, password, code } })
  },
  login(username: string, password: string): Promise<ServerSession> {
    return request('/api/auth/login', { method: 'POST', json: { username, password } })
  },
  resetPassword(username: string, phone: string, password: string): Promise<ServerSession> {
    return request('/api/auth/reset-password', { method: 'POST', json: { username, phone, password } })
  },
  me(): Promise<{ username: string; phone: string }> {
    return request('/api/auth/me')
  },
}

/** 通用分页结果：page 从 0 开始，total 为过滤后总条数 */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  size: number
}

/* ---------- 市场 ---------- */

export interface ServerMarketApp {
  id: number
  name: string
  description: string
  category: string
  installs: number
  color: string
}

/** 应用评论（author 为用户名） */
export interface ServerMarketComment {
  id: number
  author: string
  content: string
  createdAt: string
}

/** 评分汇总：myRating 为 null 表示当前用户未评分（或未登录） */
export interface MarketRatingSummary {
  averageRating: number
  ratingCount: number
  myRating: number | null
}

/** 应用评分 + 评论聚合视图 */
export interface MarketFeedback extends MarketRatingSummary {
  commentTotal: number
  comments: ServerMarketComment[]
}

export const marketApi = {
  list(category: string, keyword: string, page = 0, size = 20): Promise<PageResult<ServerMarketApp>> {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    if (category && category !== '全部') q.set('category', category)
    if (keyword) q.set('keyword', keyword)
    return request(`/api/market/apps?${q.toString()}`)
  },
  install(id: number): Promise<{ installs: number; alreadyInstalled: boolean }> {
    return request(`/api/market/apps/${id}/install`, { method: 'POST' })
  },
  uninstall(id: number): Promise<{ installs: number; removed: boolean }> {
    return request(`/api/market/apps/${id}/uninstall`, { method: 'POST' })
  },
  /** 评分与评论聚合视图：未登录可看（myRating 恒为 null），评论按时间倒序分页 */
  feedback(id: number, page = 0, size = 20): Promise<MarketFeedback> {
    const q = new URLSearchParams({ page: String(page), size: String(size) })
    return request(`/api/market/apps/${id}/feedback?${q.toString()}`)
  },
  /** 打分 1-5：同一用户重复打分即更新，返回最新汇总 */
  rate(id: number, stars: number): Promise<MarketRatingSummary> {
    return request(`/api/market/apps/${id}/rating`, { method: 'POST', json: { stars } })
  },
  /** 撤销自己的评分，返回最新汇总 */
  removeRating(id: number): Promise<MarketRatingSummary> {
    return request(`/api/market/apps/${id}/rating`, { method: 'DELETE' })
  },
  /** 发表评论（1-500 字），返回新评论 */
  comment(id: number, content: string): Promise<ServerMarketComment> {
    return request(`/api/market/apps/${id}/comments`, { method: 'POST', json: { content } })
  },
  /** 删除评论：仅评论作者本人可删 */
  removeComment(id: number, commentId: number): Promise<void> {
    return request(`/api/market/apps/${id}/comments/${commentId}`, { method: 'DELETE' })
  },
}

/* ---------- 社区 ---------- */

export interface ServerReply {
  id: number
  author: string
  content: string
  createdAt: string
}

export interface ServerPost {
  id: number
  author: string
  title: string
  content: string
  category: string
  likes: number
  /** 当前登录用户是否已点赞（未登录恒为 false） */
  liked: boolean
  createdAt: string
  replies: ServerReply[]
}

export const communityApi = {
  listPosts(sort: 'latest' | 'hot', keyword: string, category = '全部', page = 0, size = 20): Promise<PageResult<ServerPost>> {
    const q = new URLSearchParams({ sort, page: String(page), size: String(size) })
    if (keyword) q.set('keyword', keyword)
    if (category && category !== '全部') q.set('category', category)
    return request(`/api/community/posts?${q.toString()}`)
  },
  detail(id: number): Promise<ServerPost> {
    return request(`/api/community/posts/${id}`)
  },
  createPost(title: string, content: string, category = '经验分享'): Promise<ServerPost> {
    return request('/api/community/posts', { method: 'POST', json: { title, content, category } })
  },
  removePost(id: number): Promise<void> {
    return request(`/api/community/posts/${id}`, { method: 'DELETE' })
  },
  reply(postId: number, content: string): Promise<ServerReply> {
    return request(`/api/community/posts/${postId}/replies`, {
      method: 'POST',
      json: { content },
    })
  },
  /** 删除回复：仅回复作者本人可删 */
  removeReply(postId: number, replyId: number): Promise<void> {
    return request(`/api/community/posts/${postId}/replies/${replyId}`, { method: 'DELETE' })
  },
  /** 点赞切换：返回最新点赞数与当前用户点赞状态 */
  like(postId: number): Promise<{ likes: number; liked: boolean }> {
    return request(`/api/community/posts/${postId}/like`, { method: 'POST' })
  },
}

/* ---------- 用户资料 ---------- */

/** 当前登录用户完整资料（/api/users/me） */
export interface UserProfileFull {
  username: string
  createdAt: number
  posts: number
  replies: number
  flows: number
  phoneMasked: string
  nickname: string | null
  email: string | null
  gender: 'unknown' | 'male' | 'female'
  signature: string | null
  avatarUrl: string | null
}

/** 可编辑的资料字段（null 表示清空该字段，缺省表示保持不变） */
export type UserProfilePatch = Partial<{
  nickname: string | null
  email: string | null
  gender: UserProfileFull['gender']
  signature: string | null
  avatarUrl: string | null
}>

export const userApi = {
  me(): Promise<UserProfileFull> {
    return request('/api/users/me')
  },
  updateMe(patch: UserProfilePatch): Promise<UserProfileFull> {
    return request('/api/users/me', { method: 'PUT', json: patch })
  },
}

/* ---------- 流程分享 ---------- */

export interface SharedFlowItem {
  id: number
  author: string
  name: string
  description: string
  nodeCount: number
  downloads: number
  createdAt: string
}

export const flowShareApi = {
  list(sort: 'latest' | 'hot', keyword: string): Promise<SharedFlowItem[]> {
    const q = new URLSearchParams({ sort })
    if (keyword) q.set('keyword', keyword)
    return request(`/api/flows?${q.toString()}`)
  },
  upload(name: string, description: string, nodeCount: number, fileName: string, content: string): Promise<SharedFlowItem> {
    const form = new FormData()
    form.set('name', name)
    form.set('description', description)
    form.set('nodeCount', String(nodeCount))
    form.set('file', new Blob([content], { type: 'application/octet-stream' }), fileName)
    return request('/api/flows', { method: 'POST', form, timeoutMs: 30_000 })
  },
  /** 下载流程文件原文（.leafrpa 信封 JSON 文本） */
  async download(id: number): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    let res: Response
    try {
      res = await fetch(`${SERVER_BASE}/api/flows/${id}/download`, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
        signal: controller.signal,
      })
    } catch {
      throw new ApiError('服务未启动或网络不可达', true)
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) throw new ApiError(`下载失败（HTTP ${res.status}）`, false, res.status)
    return res.text()
  },
  remove(id: number): Promise<void> {
    return request(`/api/flows/${id}`, { method: 'DELETE' })
  },
}
