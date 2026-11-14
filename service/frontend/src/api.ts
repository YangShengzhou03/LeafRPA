import axios from 'axios'
import { ElMessage } from 'element-plus'

/** 统一响应结构 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

const TOKEN_KEY = 'leaf.token'
const USER_KEY = 'leaf.user'

const http = axios.create({ baseURL: '/api', timeout: 15000 })

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** 401 = token 失效 / 未登录：清除本地会话并回到登录页（与桌面端行为一致） */
http.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      ElMessage.error('登录已过期，请重新登录')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export async function api<T>(method: 'get' | 'post' | 'delete', url: string, data?: unknown): Promise<T> {
  let res
  try {
    res = await http.request<ApiResponse<T>>({ method, url, data })
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 401) throw new Error('登录已过期，请重新登录')
    if (status) throw new Error(`请求失败（HTTP ${status}）`)
    throw new Error('服务不可达，请稍后重试')
  }
  if (res.data.code !== 0) throw new Error(res.data.message || '请求失败')
  return res.data.data
}

export interface MarketApp {
  id: number
  name: string
  description: string
  category: string
  installs: number
  color: string
}

export interface ReplyDto {
  id: number
  author: string
  content: string
  createdAt: string
}

export interface PostDto {
  id: number
  author: string
  title: string
  content: string
  category: string
  likes: number
  /** 当前登录用户是否已点赞（未登录恒为 false） */
  liked: boolean
  createdAt: string
  replies: ReplyDto[]
}

export interface LikeResult {
  likes: number
  liked: boolean
}

/** 通用分页结果：page 从 0 开始，total 为过滤后总条数 */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface SharedFlow {
  id: number
  author: string
  name: string
  description: string
  nodeCount: number
  downloads: number
  createdAt: string
}

export interface UserProfile {
  username: string
  createdAt: number
  posts: number
  replies: number
  flows: number
}

/** 帖子分类（与服务端约定保持一致） */
export const POST_CATEGORIES = ['经验分享', '指令开发', '行业案例', '问题求助', '版本更新']

export interface Session {
  username: string
  phone: string
  loginAt: number
  token: string
}

/** 当前登录用户名（null 表示未登录） */
export function currentUser(): string | null {
  return localStorage.getItem(USER_KEY)
}

export function saveSession(username: string, token: string): void {
  localStorage.setItem(USER_KEY, username)
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearSession(): void {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
}
