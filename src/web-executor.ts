/**
 * 网页自动化指令执行通道：
 * 前端 fetch → native-host HTTP 服务(127.0.0.1:19836)
 *           → Chrome native messaging → 插件 service-worker → content.js → 页面
 */

export const PLUGIN_HTTP = 'http://127.0.0.1:19836'

import { launchChrome } from './bridge'

/** 应用指令 type → 插件 payload.type 映射表（命中即走插件真实执行） */
export const WEB_COMMAND_MAP: Record<string, string> = {
  'open-web': 'leaf:page-open',
  'close-web': 'leaf:page-close',
  'list-web-pages': 'leaf:page-list',
  'activate-browser': 'leaf:page-activate',
  'hover-web': 'leaf:hover',
  'drag-web': 'leaf:drag',
  'wait-web': 'leaf:wait-element',
  'input-password-web': 'leaf:input-password',
  'select-web': 'leaf:select',
  'set-checkbox-web': 'leaf:set-checkbox',
  'set-value-web': 'leaf:set-value',
  'set-attr-web': 'leaf:set-attribute',
  'get-element-web': 'leaf:get-element',
  'get-related-web': 'leaf:get-related',
  'get-similar-web': 'leaf:get-similar',
  // 既有网页指令同样切换到插件执行通道
  'web.click': 'leaf:click',
  'web.input': 'leaf:input',
  'web.getText': 'leaf:get-text',
  // 智能录制：连续元素采集
  'plugin.record-start': 'leaf:record-start',
  'plugin.record-stop': 'leaf:record-stop',
}

interface WebExecResponse {
  ok: boolean
  data?: unknown
  error?: string
}

function abortError(): Error {
  return new Error('网页指令执行超时（30s），页面脚本执行时间较长时请重试或缩短等待超时')
}

/** 连接不可用（宿主未运行 / 网络层错误） */
function notConnectedError(): Error {
  return new Error('未连接浏览器宿主：请确认 Chrome 已打开并启用轻羽RPA 插件')
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    return null
  }
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

export interface PluginStatus {
  ok: boolean
  connected: boolean
  mode?: string
  queued?: number
}

/** 查询宿主连接状态；宿主不可达时返回 null */
export async function getPluginStatus(): Promise<PluginStatus | null> {
  const body = await fetchJson(`${PLUGIN_HTTP}/status`)
  return body as PluginStatus | null
}

/**
 * 确保浏览器插件通道可用：宿主不可达时拉起 Chrome 并等待其连接。
 * @param opts.launch 是否允许自动启动 Chrome（默认 true）
 * @param opts.timeoutMs 等待连接的最长时间（默认 15s）
 */
export async function ensurePlugin(opts?: { launch?: boolean; timeoutMs?: number }): Promise<PluginStatus> {
  const timeoutMs = opts?.timeoutMs ?? 15_000
  const allowLaunch = opts?.launch !== false
  const first = await getPluginStatus()
  if (first) return first
  if (!allowLaunch) throw notConnectedError()
  // 宿主不可达：启动 Chrome，扩展 SW 会自动连接 native 宿主
  await launchChrome().catch(() => {})
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800))
    const st = await getPluginStatus()
    if (st) return st
  }
  throw notConnectedError()
}

/**
 * 通过插件执行一条网页指令。
 * @param type 应用指令 type（如 open-web），内部映射为插件 payload.type
 * @param params 节点参数（node.props）
 * @returns 插件返回的 data
 */
export async function runWebCommand(type: string, params: Record<string, unknown>): Promise<unknown> {
  const payloadType = WEB_COMMAND_MAP[type] ?? type
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch(`${PLUGIN_HTTP}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: payloadType, payload: params, timeout: 30 }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw abortError()
    throw notConnectedError()
  } finally {
    clearTimeout(timer)
  }
  let parsed: WebExecResponse | null = null
  try {
    parsed = (await res.json()) as WebExecResponse
  } catch {
    parsed = null
  }
  if (!parsed) throw new Error(`插件宿主返回异常（HTTP ${res.status}）`)
  if (!parsed.ok) throw new Error(String(parsed.error ?? '网页指令执行失败'))
  // 兼容：插件层可能把错误包在 data 里返回（ok:true 但 data.error 存在）
  if (parsed.data && typeof parsed.data === 'object' && (parsed.data as Record<string, unknown>).error) {
    throw new Error(String((parsed.data as Record<string, unknown>).error))
  }
  return parsed.data
}

/* ---------------- 元素抓取器 ---------------- */

export interface PickedElement {
  tagName: string
  id: string
  classes: string
  text: string
  cssSelector: string
  xpath: string
  similarCount?: number
  url?: string
  [key: string]: unknown
}

interface PickState {
  cancelled: boolean
}

/**
 * 启动插件 PICK 模式并等待用户在页面上点选元素。
 * @returns 所选元素的最佳选择器（优先含 id 的 CSS 路径，其次 XPath）
 * 调用方可通过 cancelToken.cancelled = true 取消等待。
 */
export async function pickElement(cancelToken?: PickState): Promise<{ selector: string; element: PickedElement }> {
  const startedAt = Date.now() / 1000
  await runWebCommand('leaf:pick-start', {})
  try {
    const deadline = Date.now() + 120_000 // 最长等待 2 分钟
    let lastError = ''
    while (Date.now() < deadline) {
      if (cancelToken?.cancelled) throw new Error('已取消抓取')
      await new Promise((r) => setTimeout(r, 500))
      let res: Response
      try {
        res = await fetch(`${PLUGIN_HTTP}/picked?since=${startedAt}`)
      } catch {
        // 宿主不可达：短暂等待重试，而不是立刻失败（Chrome 可能正在启动）
        lastError = '浏览器宿主连接中…'
        continue
      }
      if (res.status === 404) {
        throw new Error('插件宿主版本过旧（缺少 /picked 端点）：请重启 Chrome 以加载新版宿主')
      }
      const body = (await res.json()) as { ok: boolean; element: PickedElement | null }
      if (body.ok && body.element) {
        const el = body.element
        const selector = el.cssSelector || el.xpath || ''
        if (!selector) throw new Error('抓取到的元素没有可用选择器')
        return { selector, element: el }
      }
      if (lastError) lastError = ''
    }
    throw new Error(lastError || '抓取超时（2 分钟）：未在页面上点选元素')
  } finally {
    // 无论成功/取消/超时都停止页面上的 PICK 模式
    fetch(`${PLUGIN_HTTP}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'leaf:pick-stop', payload: {}, timeout: 5 }),
    }).catch(() => {})
  }
}

/** 插件主动上报的事件（智能录制采集到的元素） */
export interface PluginEvent {
  seq: number
  payload: unknown
  tab?: number
  frame?: number
  t: number
}

interface PluginEventsResponse {
  ok: boolean
  events?: PluginEvent[]
  seq?: number
  error?: string
}

/** 轮询插件上报的事件（增量拉取，返回 seq 供下次续拉） */
export async function pollPluginEvents(since: number): Promise<{ events: PluginEvent[]; seq: number }> {
  const res = await fetch(`${PLUGIN_HTTP}/events?since=${since}`)
  let body: PluginEventsResponse | null = null
  try {
    body = (await res.json()) as PluginEventsResponse
  } catch {
    body = null
  }
  if (!body) throw new Error(`插件宿主返回异常（HTTP ${res.status}）`)
  if (!body.ok) throw new Error(String(body.error ?? '读取录制事件失败'))
  return { events: body.events ?? [], seq: body.seq ?? since }
}
