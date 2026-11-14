import { ref } from 'vue'
import { Guide, Document, ShoppingCart, Bell, Coin } from '@element-plus/icons-vue'

export interface MarketApp {
  id: string
  name: string
  desc: string
  category: string
  installs: string
  color: string
  icon: any
}

export const MARKET_CATEGORIES = ['全部', '办公自动化', '电商运营', '财务税务', '数据采集', '开发工具']

/** 按分类推断市场应用图标（服务端不下发图标，桌面端按分类映射） */
export function iconForCategory(category: string): any {
  switch (category) {
    case '数据采集': return Guide
    case '电商运营': return ShoppingCart
    case '财务税务': return Coin
    case '办公自动化': return Bell
    default: return Document
  }
}

/** 安装量展示：万位缩写 */
export function formatInstalls(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return String(n)
}

/** 服务端下发的市场应用缓存（MarketView 加载后写入，Sidebar 等共享读取） */
export const serverApps = ref<MarketApp[]>([])

export const INSTALLED_KEY = 'leaf-rpa.market.v1'

export function loadInstalled(): Set<string> {
  try {
    const raw = localStorage.getItem(INSTALLED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function saveInstalled(installed: Set<string>) {
  localStorage.setItem(INSTALLED_KEY, JSON.stringify([...installed]))
}
