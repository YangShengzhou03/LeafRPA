import { defineStore } from 'pinia'

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

export const useAuthStore = defineStore('auth', {
  state: () => loadPersist(),
  getters: {
    isLoggedIn(state): boolean {
      return state.session !== null
    },
    maskedPhone(state): string {
      return state.session ? maskPhone(state.session.phone) : ''
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
      if (!this.autoLogin) this.session = null
      this.persist()
    },
    register(username: string, phone: string, password: string): string | null {
      const name = username.trim()
      if (!name) return '请输入用户名'
      if (!/^1\d{10}$/.test(phone)) return '请输入正确的 11 位手机号'
      if (password.length < 6) return '密码至少 6 位'
      if (this.accounts.some((a) => a.username === name)) return '该用户名已注册'
      this.accounts.push({ username: name, phone, password })
      this.lastUsername = name
      this.persist()
      return null
    },
    login(username: string, password: string, autoLogin: boolean, rememberPassword: boolean): string | null {
      const name = username.trim()
      const account = this.accounts.find((a) => a.username === name)
      if (!account) return '账号不存在，请先注册'
      if (account.password !== password) return '密码错误，请重试'
      this.session = { username: account.username, phone: account.phone, loginAt: Date.now() }
      this.lastUsername = account.username
      this.autoLogin = autoLogin
      this.rememberPassword = rememberPassword
      this.savedPassword = rememberPassword ? password : ''
      this.persist()
      return null
    },
    resetPassword(username: string, phone: string, password: string): string | null {
      const account = this.accounts.find((a) => a.username === username.trim())
      if (!account) return '账号不存在'
      if (account.phone !== phone) return '手机号与账号不匹配'
      if (password.length < 6) return '密码至少 6 位'
      account.password = password
      this.lastUsername = account.username
      this.persist()
      return null
    },
    logout() {
      this.session = null
      this.autoLogin = false
      this.persist()
    },
  },
})
