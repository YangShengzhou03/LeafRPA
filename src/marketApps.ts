import { Guide, Document, ShoppingCart, Bell, Coin, User, Checked } from '@element-plus/icons-vue'

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

export const MARKET_APPS: MarketApp[] = [
  { id: '1', name: '网页数据抓取', desc: '批量采集网页表格、列表与详情页数据', category: '数据采集', installs: '12.6万', color: '#3b6fe0', icon: Guide },
  { id: '2', name: 'Excel 批量处理', desc: '多表合并、清洗、汇总与格式转换', category: '办公自动化', installs: '9.8万', color: '#22c55e', icon: Document },
  { id: '3', name: '电商订单同步', desc: '订单自动下载、发货与库存回写', category: '电商运营', installs: '7.2万', color: '#f97154', icon: ShoppingCart },
  { id: '4', name: '发票识别录入', desc: 'OCR 识别发票信息并自动写入财务系统', category: '财务税务', installs: '5.4万', color: '#a05ff7', icon: Document },
  { id: '5', name: '企业微信消息推送', desc: '定时向群聊或客户发送通知与报表', category: '办公自动化', installs: '4.9万', color: '#0ea5e9', icon: Bell },
  { id: '6', name: '数据库定时备份', desc: '按计划备份 MySQL / SQL Server 数据库', category: '开发工具', installs: '3.1万', color: '#6366f1', icon: Coin },
  { id: '7', name: '招聘网站简历收集', desc: '自动筛选并下载符合条件的候选人简历', category: '数据采集', installs: '2.8万', color: '#ec4899', icon: User },
  { id: '8', name: '报销单自动审核', desc: '校验发票真伪与报销规则并生成台账', category: '财务税务', installs: '2.3万', color: '#f59e0b', icon: Checked },
]

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
