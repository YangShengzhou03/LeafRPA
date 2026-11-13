/**
 * 元素库模型：捕获到的页面元素统一存在这里，供元素库面板与 fx 变量选择器共用。
 *
 * 一个元素 = 一条「元素变量」声明（VariableDecl.kind === 'element'）的持久化载体：
 * 元素库负责记录来源页面（用于分组）、选择器与标签等展示信息，
 * 变量表负责让流程参数通过 {{变量名}} 引用它。
 */

/** 元素来源页面分组（按 url 归一化后聚合） */
export interface ElementGroup {
  /** 归一化后的 url，作为分组 id */
  id: string
  /** 页面标题，取不到时退回 host */
  title: string
  url: string
  /** 该页面捕获到的元素数 */
  count: number
}

/** 捕获到的页面元素 */
export interface CapturedElement {
  id: string
  /** 元素变量名（同时用于 {{引用}}） */
  name: string
  /** 主选择器：优先 CSS，退化为 XPath */
  selector: string
  /** XPath，插件能给出时记录，便于元素库展示与切换 */
  xpath?: string
  /** 元素标签名，如 button */
  tagName?: string
  /** 元素文本片段 */
  text?: string
  /** 相似元素数量（可用于批量操作列表） */
  similarCount?: number
  /** 来源页面 url */
  url?: string
  /** 来源页面标题 */
  title?: string
  createdAt: number
}

const ELEMENTS_KEY = 'leaf-rpa.elements.v2'

/** 把 url 归一化成分组 id：去掉 hash 与查询串，保留路径 */
export function groupIdOf(url: string): string {
  const raw = String(url ?? '').trim()
  if (!raw) return 'unknown'
  try {
    const u = new URL(raw)
    return `${u.origin}${u.pathname}`
  } catch {
    return raw.split('#')[0].split('?')[0] || 'unknown'
  }
}

/** 分组的展示标题：页面标题优先，其次路径末段，最后 host */
export function groupTitleOf(url: string, title?: string): string {
  const t = String(title ?? '').trim()
  if (t) return t
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean).pop()
    return seg ? decodeURIComponent(seg) : u.hostname
  } catch {
    return groupIdOf(url)
  }
}

/** 按来源页面聚合元素，组内按创建时间倒序（新的在前） */
export function groupElements(list: CapturedElement[]): { group: ElementGroup; items: CapturedElement[] }[] {
  const map = new Map<string, { group: ElementGroup; items: CapturedElement[] }>()
  for (const el of list) {
    const id = groupIdOf(el.url ?? '')
    let entry = map.get(id)
    if (!entry) {
      entry = {
        group: {
          id,
          title: groupTitleOf(el.url ?? '', el.title || el.name),
          url: el.url ?? '',
          count: 0,
        },
        items: [],
      }
      map.set(id, entry)
    }
    // 组标题优先使用真正带页面标题的记录
    if (el.title && (entry.group.title === entry.group.id || !entry.group.title)) {
      entry.group.title = el.title
    }
    entry.items.push(el)
  }
  const out = [...map.values()]
  out.forEach((e) => {
    e.group.count = e.items.length
    e.items.sort((a, b) => b.createdAt - a.createdAt)
  })
  out.sort((a, b) => b.items[0].createdAt - a.items[0].createdAt)
  return out
}

/** 生成不重复的元素变量名：同名时追加 _2 / _3 */
export function uniqueName(base: string, taken: Set<string>): string {
  const trimmed = String(base ?? '').trim() || 'element'
  if (!taken.has(trimmed)) return trimmed
  let i = 2
  while (taken.has(`${trimmed}_${i}`)) i += 1
  return `${trimmed}_${i}`
}

/** 由页面元素信息推导一个可读的默认变量名 */
export function suggestName(info: {
  tagName?: string
  id?: string
  text?: string
  placeholder?: string
  name?: string
}): string {
  const clean = (s?: string) => String(s ?? '').trim().replace(/\s+/g, '').slice(0, 12)
  const byText = clean(info.text)
  if (byText) return byText
  const byPlaceholder = clean(info.placeholder)
  if (byPlaceholder) return byPlaceholder
  const byId = clean(info.id)
  if (byId) return byId
  const byName = clean(info.name)
  if (byName) return byName
  return String(info.tagName ?? 'element').trim() || 'element'
}

export function loadElements(): CapturedElement[] {
  try {
    const raw = localStorage.getItem(ELEMENTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as CapturedElement[]) : []
  } catch {
    return []
  }
}

export function saveElements(list: CapturedElement[]): void {
  try {
    localStorage.setItem(ELEMENTS_KEY, JSON.stringify(list))
  } catch {
    /* 忽略本地存储失败 */
  }
}
