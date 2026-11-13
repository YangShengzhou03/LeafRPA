import { reactive } from 'vue'

/* 轻量 i18n：字典 + 响应式 locale，t() 可直接在模板中使用并随切换刷新 */

export type Locale = 'zh-CN' | 'en-US'

const zh = {
  /* 窗口控制 */
  'win.minimize': '最小化',
  'win.maximize': '最大化',
  'win.restore': '还原',
  'win.close': '关闭',
  /* 设置页 */
  'settings.title': '设置',
  'settings.kicker': '应用偏好',
  'settings.sub': '管理语言、外观、数据存储与账号信息',
  'settings.nav.general': '通用',
  'settings.nav.appearance': '外观模式',
  'settings.nav.data': '数据与存储',
  'settings.nav.about': '关于',
  'settings.nav.danger': '危险操作',
  'settings.general.language': '语言 / Language',
  'settings.general.languageHint': '切换后立即生效，下次启动保持所选语言。',
  'settings.general.closeAction': '关闭按钮行为',
  'settings.general.closeActionHint': '设置点击窗口关闭按钮后的行为，包含系统托盘支持。',
  'settings.closeAction.exit': '退出程序',
  'settings.closeAction.minimize': '最小化窗口',
  'settings.closeAction.tray': '最小化到系统托盘',
  'settings.appearance.title': '外观模式',
  'settings.theme.light': '浅色',
  'settings.theme.dark': '深色',
  'settings.theme.system': '跟随系统',
  'settings.appearance.hint': '选择「跟随系统」后，应用会随操作系统外观自动切换。',
  'settings.data.title': '数据与存储',
  'settings.data.location': '数据位置',
  'settings.data.notLoaded': '未加载',
  'settings.data.customTag': '自定义',
  'settings.data.defaultTag': '系统默认',
  'settings.data.change': '更改位置',
  'settings.data.reset': '恢复默认',
  'settings.data.flows': '已保存流程',
  'settings.data.flowsUnit': '个',
  'settings.data.triggers': '触发器',
  'settings.data.apps': '已安装应用',
  'settings.data.migrateConfirmTitle': '更改数据位置',
  'settings.data.migrateConfirm': '将把已有流程数据迁移到新位置：{path}。确定继续吗？',
  'settings.data.changeOk': '数据位置已更新',
  'settings.data.resetOk': '已恢复默认数据位置',
  'settings.about.version': '版本',
  'settings.about.repo': '开源仓库',
  'settings.about.repoCopy': '复制地址',
  'settings.about.repoCopied': '仓库地址已复制',
  'settings.about.copyFailed': '复制失败，请手动复制',
  'settings.about.feedback': '反馈方式',
  'settings.about.feedbackDesc': '通过开源仓库 Issues 提交问题与建议',
  'settings.danger.desc': '删除本机保存的全部流程、触发器与偏好，操作后无法恢复。',
  'settings.danger.clear': '清空全部数据',
  'settings.danger.confirmTitle': '清空全部数据',
  'settings.danger.confirmText': '将删除本机保存的全部流程、触发器、市场应用与教程进度，且无法恢复。确定继续吗？',
  'settings.danger.confirmBtn': '全部删除',
  'settings.danger.cleared': '已清空全部数据',
  'settings.danger.clearFailed': '清空失败：{err}',
  'settings.data.resetConfirm': '将把流程数据从当前位置迁回系统默认位置。确定继续吗？',
  /* 通用 */
  'common.cancel': '取消',
  'common.confirm': '确定',
}

export type MessageKey = keyof typeof zh

const en: Record<MessageKey, string> = {
  'win.minimize': 'Minimize',
  'win.maximize': 'Maximize',
  'win.restore': 'Restore',
  'win.close': 'Close',
  'settings.title': 'Settings',
  'settings.kicker': 'Preferences',
  'settings.sub': 'Manage language, appearance, data storage and account info',
  'settings.nav.general': 'General',
  'settings.nav.appearance': 'Appearance',
  'settings.nav.data': 'Data & Storage',
  'settings.nav.about': 'About',
  'settings.nav.danger': 'Danger Zone',
  'settings.general.language': 'Language / 语言',
  'settings.general.languageHint': 'Applies immediately and persists across restarts.',
  'settings.general.closeAction': 'Close button behavior',
  'settings.general.closeActionHint': 'Choose what happens when the window close button is clicked. Tray support included.',
  'settings.closeAction.exit': 'Exit app',
  'settings.closeAction.minimize': 'Minimize window',
  'settings.closeAction.tray': 'Minimize to system tray',
  'settings.appearance.title': 'Appearance',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'System',
  'settings.appearance.hint': 'With "System", the app follows the OS appearance automatically.',
  'settings.data.title': 'Data & Storage',
  'settings.data.location': 'Data location',
  'settings.data.notLoaded': 'Not loaded',
  'settings.data.customTag': 'Custom',
  'settings.data.defaultTag': 'System default',
  'settings.data.change': 'Change location',
  'settings.data.reset': 'Reset to default',
  'settings.data.flows': 'Saved flows',
  'settings.data.flowsUnit': '',
  'settings.data.triggers': 'Triggers',
  'settings.data.apps': 'Installed apps',
  'settings.data.migrateConfirmTitle': 'Change data location',
  'settings.data.migrateConfirm': 'Existing flow data will be moved to: {path}. Continue?',
  'settings.data.changeOk': 'Data location updated',
  'settings.data.resetOk': 'Data location reset to default',
  'settings.about.version': 'Version',
  'settings.about.repo': 'Repository',
  'settings.about.repoCopy': 'Copy',
  'settings.about.repoCopied': 'Repository URL copied',
  'settings.about.copyFailed': 'Copy failed, please copy manually',
  'settings.about.feedback': 'Feedback',
  'settings.about.feedbackDesc': 'Open an issue in the repository',
  'settings.danger.desc': 'Delete all local flows, triggers and preferences. This cannot be undone.',
  'settings.danger.clear': 'Erase all data',
  'settings.danger.confirmTitle': 'Erase all data',
  'settings.danger.confirmText': 'All flows, triggers, marketplace apps and tutorial progress on this machine will be deleted and cannot be recovered. Continue?',
  'settings.danger.confirmBtn': 'Delete all',
  'settings.danger.cleared': 'All data erased',
  'settings.danger.clearFailed': 'Erase failed: {err}',
  'settings.data.resetConfirm': 'Flow data will be moved back to the system default location. Continue?',
  'common.cancel': 'Cancel',
  'common.confirm': 'OK',
}

const messages: Record<Locale, Record<MessageKey, string>> = {
  'zh-CN': zh,
  'en-US': en,
}

const LOCALE_KEY = 'leaf-rpa.locale'
const LOCALES: Locale[] = ['zh-CN', 'en-US']

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY) as Locale | null
    if (saved && LOCALES.includes(saved)) return saved
  } catch {
    /* 非浏览器环境忽略 */
  }
  return 'zh-CN'
}

export const i18n = reactive({ locale: initialLocale() })

export function setLocale(locale: Locale) {
  i18n.locale = locale
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* 忽略 */
  }
}

/** 占位符替换：t 之外用于带参数的文案 */
function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

/** 取当前语言文案，缺失键回退到中文 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return format(messages[i18n.locale][key] ?? zh[key], params)
}
