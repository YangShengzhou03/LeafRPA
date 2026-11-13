import { invoke } from '@tauri-apps/api/core'
import type { Flow, FlowMeta } from './types'

const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const LS_KEY = 'leaf-rpa.flows.v1'

function lsLoad(): Flow[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Flow[]) : []
  } catch {
    return []
  }
}

function lsSave(flows: Flow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(flows))
}

export function toMeta(flow: Flow): FlowMeta {
  return {
    id: flow.id,
    name: flow.name,
    type: flow.type,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  }
}

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export async function listFlows(): Promise<FlowMeta[]> {
  if (hasTauri) return invoke<FlowMeta[]>('list_flows')
  return lsLoad().map(toMeta).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function readFlow(id: string): Promise<Flow> {
  if (hasTauri) return invoke<Flow>('read_flow', { id })
  const flow = lsLoad().find((f) => f.id === id)
  if (!flow) throw new Error(`流程不存在: ${id}`)
  return flow
}

export async function writeFlow(flow: Flow): Promise<FlowMeta> {
  if (hasTauri) return invoke<FlowMeta>('write_flow', { flow })
  const flows = lsLoad()
  const index = flows.findIndex((f) => f.id === flow.id)
  if (index >= 0) flows[index] = flow
  else flows.push(flow)
  lsSave(flows)
  return toMeta(flow)
}

export async function createFlow(name: string, type: Flow['type']): Promise<FlowMeta> {
  if (hasTauri) return invoke<FlowMeta>('create_flow', { name, flowType: type })
  const now = Date.now()
  const flow: Flow = {
    id: newId('flow_'),
    name,
    type,
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
  }
  const flows = lsLoad()
  flows.push(flow)
  lsSave(flows)
  return toMeta(flow)
}

export async function deleteFlow(id: string): Promise<void> {
  if (hasTauri) return invoke<void>('delete_flow', { id })
  lsSave(lsLoad().filter((f) => f.id !== id))
}

export function createNodeId(): string {
  return newId('node_')
}

export function createEdgeId(): string {
  return newId('edge_')
}

/** 使用系统默认浏览器打开网址（Tauri 环境走 Rust 命令，浏览器环境退回 window.open） */
export async function openInBrowser(url: string): Promise<void> {
  if (hasTauri) return invoke<void>('open_in_browser', { url })
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** 启动 Chrome（Tauri 环境走 Rust 命令；浏览器环境打开 Chrome 下载页提示） */
export async function launchChrome(): Promise<void> {
  if (hasTauri) return invoke<void>('launch_chrome')
  window.open('https://www.google.com/chrome/', '_blank', 'noopener,noreferrer')
}

/** 返回流程数据的保存位置描述 */
export async function getDataDir(): Promise<string> {
  if (hasTauri) return invoke<string>('data_dir')
  return '浏览器 localStorage（仅当前环境有效）'
}

/* ---------- 应用设置（数据位置 / 关闭行为） ---------- */

export type CloseAction = 'exit' | 'minimize' | 'tray'

export interface AppSettings {
  dataRoot: string
  closeAction: CloseAction
}

/** 读取应用设置（浏览器环境返回默认值） */
export async function getAppSettings(): Promise<AppSettings> {
  if (hasTauri) return invoke<AppSettings>('get_settings')
  return { dataRoot: '', closeAction: 'exit' }
}

/** 设置关闭按钮行为 */
export async function setCloseAction(action: CloseAction): Promise<void> {
  if (hasTauri) return invoke<void>('set_close_action', { action })
}

/** 更改数据根目录并迁移流程文件；传空字符串恢复默认位置 */
export async function setDataRoot(path: string): Promise<string> {
  if (hasTauri) return invoke<string>('set_data_root', { path })
  return '浏览器 localStorage（仅当前环境有效）'
}

/** 弹出系统目录选择对话框，取消时返回 null */
export async function pickFolder(): Promise<string | null> {
  if (hasTauri) return invoke<string | null>('pick_folder')
  return null
}

export interface PythonResult {
  ok: boolean
  result: unknown
  vars: Record<string, unknown>
  logs: string
  error: string | null
}

/** 运行一段 Python 代码（Tauri 环境走 Rust 命令，浏览器环境为模拟执行） */
export async function runPythonCode(
  code: string,
  vars: Record<string, unknown>,
  timeoutSecs = 120,
): Promise<PythonResult> {
  if (hasTauri) return invoke<PythonResult>('run_python_code', { code, vars, timeoutSecs })
  return { ok: true, result: null, vars, logs: '', error: null }
}

/** 清空本地持久化的全部数据（浏览器环境） */
export function clearLocalData(): void {
  if (typeof localStorage === 'undefined') return
  Object.keys(localStorage)
    .filter((key) => key.startsWith('leaf-rpa.'))
    .forEach((key) => localStorage.removeItem(key))
}
