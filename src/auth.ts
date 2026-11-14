import { defineStore } from 'pinia'
import { authApi, userApi, ApiError, getToken, setToken, type ServerSession } from './api'
import { toastWarning } from './notify'

const AUTH_KEY = 'leaf-rpa.auth.v1'

export interface AuthAccount {
  username: string
  phone: string
  password: string
}

export interface AuthSession {
  username: string
  phone: string
  loginAt: number
}

interface AuthPersist {
  accounts: AuthAccount[]
  session: AuthSession | null
  lastUsername: string
  autoLogin: boolean
  rememberPassword: boolean
  savedPassword: string
}

/** 顶栏 / 菜单同步展示所需的最小资料（来自 /api/users/me） */
export interface AuthProfile {
  nickname: string | null
  avatarUrl: string | null
}

const DEFAULT_PERSIST: AuthPersist = {
  accounts: [],
  session: null,
  lastUsername: '',
  autoLogin: false,
  rememberPassword: false,
  savedPassword: '',
}

function loadPersist(): AuthPersist {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return { ...DEFAULT_PERSIST }
    return { ...DEFAULT_PERSIST, ...(JSON.parse(raw) as Partial<AuthPersist>) }
  } catch {
    return { ...DEFAULT_PERSIST }
  }
}

export function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone
}

/** 把 ApiError 转成用户可读文案；未知错误给通用提示 */
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : '服务异常，请稍后重试'
}

function toSession(s: ServerSession): AuthSession {
  return { username: s.username, phone: s.phone, loginAt: s.loginAt || Date.now() }
}

/**
 * 会话过期统一处理：任何已登录接口返回 401（未登录 / token 失效 / 登录超时）时，
 * api.ts 会广播 leaf-rpa:unauthorized 事件；这里监听后清除本地会话，
 * App.vue 检测到无会话即自动切换到登录页。
 */
let expiryWatcherBound = false
export function setupAuthExpiryWatcher(): void {
  if (expiryWatcherBound) return
  expiryWatcherBound = true
  window.addEventListener('leaf-rpa:unauthorized', () => {
    const auth = useAuthStore()
    if (auth.session) {
      auth.logout()
      toastWarning('登录已过期，请重新登录')
    }
  })
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    ...loadPersist(),
    /** 当前用户资料（昵称 / 头像），登录后从服务端加载，未登录为 null */
    profile: null as AuthProfile | null,
  }),
  getters: {
    isLoggedIn(state): boolean {
      return state.session !== null
    },
    maskedPhone(state): string {
      return state.session ? maskPhone(state.session.phone) : ''
    },
    /** 展示名：昵称优先，无昵称回退用户名 */
    displayName(state): string {
      const nickname = state.profile?.nickname?.trim()
      return nickname || state.session?.username || ''
    },
  },
  actions: {
    persist() {
      const data: AuthPersist = {
        accounts: this.accounts,
        session: this.session,
        lastUsername: this.lastUsername,
        autoLogin: this.autoLogin,
        rememberPassword: this.rememberPassword,
        savedPassword: this.savedPassword,
      }
      localStorage.setItem(AUTH_KEY, JSON.stringify(data))
    },
    /** 应用启动时调用：未开启自动登录则丢弃上次会话，但保留预填信息 */
    restoreSession() {
      if (!this.autoLogin) {
        this.session = null
        setToken('')
      }
      this.persist()
    },
    /** 拉取当前用户资料（昵称 / 头像）同步到顶栏；离线或未登录时静默保留旧值 */
    async refreshProfile(): Promise<void> {
      if (!this.session || !getToken()) return
      try {
        const me = await userApi.me()
        this.profile = { nickname: me.nickname, avatarUrl: me.avatarUrl }
      } catch {
        /* 服务不可达时保留已有资料 */
      }
    },
    /** 设置页保存资料后同步顶栏展示 */
    syncProfile(nickname: string | null, avatarUrl: string | null) {
      this.profile = { nickname, avatarUrl }
    },
    async register(username: string, phone: string, password: string, code: string): Promise<string | null> {
      const name = username.trim()
      if (!name) return '请输入用户名'
      if (!/^1\d{10}$/.test(phone)) return '请输入正确的 11 位手机号'
      if (password.length < 6) return '密码至少 6 位'
      if (code !== '123456') return '验证码错误'
      try {
        const session = await authApi.register(name, phone, password, code)
        setToken(session.token)
        this.session = toSession(session)
        this.lastUsername = name
        if (!this.accounts.some((a) => a.username === name)) {
          this.accounts.push({ username: name, phone, password: '' })
        }
        this.persist()
        void this.refreshProfile()
        return null
      } catch (err) {
        return errMsg(err)
      }
    },
    async login(username: string, password: string, autoLogin: boolean, rememberPassword: boolean): Promise<string | null> {
      const name = username.trim()
      try {
        const session = await authApi.login(name, password)
        setToken(session.token)
        this.session = toSession(session)
        this.lastUsername = name
        this.autoLogin = autoLogin
        this.rememberPassword = rememberPassword
        this.savedPassword = rememberPassword ? password : ''
        if (!this.accounts.some((a) => a.username === name)) {
          this.accounts.push({ username: name, phone: session.phone, password: '' })
        }
        this.persist()
        void this.refreshProfile()
        return null
      } catch (err) {
        return err instanceof ApiError && err.status === 401 ? '账号或密码错误' : errMsg(err)
      }
    },
    async resetPassword(username: string, phone: string, password: string): Promise<string | null> {
      const name = username.trim()
      if (password.length < 6) return '密码至少 6 位'
      try {
        const session = await authApi.resetPassword(name, phone, password)
        setToken(session.token)
        this.session = toSession(session)
        this.lastUsername = name
        this.persist()
        void this.refreshProfile()
        return null
      } catch (err) {
        return errMsg(err)
      }
    },
    /** 校验已有 token 是否仍有效（启动自动登录时调用）；失效则清除会话 */
    async verifySession(): Promise<boolean> {
      if (!this.session || !getToken()) return this.session !== null
      try {
        const me = await authApi.me()
        if (me.username !== this.session.username) {
          this.logout()
          return false
        }
        void this.refreshProfile()
        return true
      } catch {
        // 服务不可达时保留本地会话（离线可用），401 时已由 api.ts 清 token
        if (!getToken()) {
          this.logout()
          return false
        }
        return true
      }
    },
    logout() {
      this.session = null
      this.autoLogin = false
      this.profile = null
      setToken('')
      this.persist()
    },
  },
})
