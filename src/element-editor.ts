/**
 * 元素编辑器窗口的通信层。
 *
 * 主窗口：把待编辑元素交给 Rust 侧共享状态，再打开独立子窗口。
 * 子窗口：启动时从共享状态取一次数据；「完成」通过事件把结果回传主窗口。
 *
 * 选择器里可能含 `#`、`&`、引号等字符，不适合走窗口 URL，
 * 因此数据一律经 Tauri invoke / event 传递。
 */

import { invoke } from '@tauri-apps/api/core'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { CapturedElement } from './elements'

/** Tauri 环境（子窗口只可能在 Tauri 中存在） */
export const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** 当前页面是否为元素编辑器子窗口 */
export function isElementEditorWindow(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('elementEditor')
}

/** 主窗口 → 子窗口：待编辑元素的初始数据 */
export interface ElementEditorPayload {
  /** 编辑已有元素时带上 id；新建时为空 */
  id?: string
  name: string
  selector: string
  xpath?: string
  url?: string
  title?: string
  /** 相似元素列表（「捕获相似元素」用） */
  similar?: { selector: string; text?: string }[]
}

/** 子窗口 → 主窗口：用户点「完成」回传的结果 */
export interface ElementEditorResult {
  id?: string
  name: string
  selector: string
  xpath?: string
  /** 选择器类型：默认选择器(css) / XPath */
  selectorType: 'css' | 'xpath'
  cancel?: boolean
}

/** 事件名：主窗口监听这个事件接收编辑结果 */
export const ELEMENT_EDITOR_DONE = 'leaf://element-editor-done'

/** 主窗口：打开元素编辑器 */
export async function openElementEditor(payload: ElementEditorPayload): Promise<void> {
  if (!hasTauri) throw new Error('元素编辑器需要在桌面应用中使用')
  await invoke('set_element_editor_data', { payload: JSON.stringify(payload) })
  await invoke('open_element_editor')
}

/** 子窗口：取出待编辑数据（取一次即清空） */
export async function takeElementEditorPayload(): Promise<ElementEditorPayload | null> {
  if (!hasTauri) return null
  const raw = await invoke<string | null>('take_element_editor_data')
  if (!raw) return null
  try {
    return JSON.parse(raw) as ElementEditorPayload
  } catch {
    return null
  }
}

/** 子窗口：「完成」时把结果发给主窗口并关闭自己 */
export async function finishElementEditor(result: ElementEditorResult): Promise<void> {
  if (!hasTauri) return
  await emit(ELEMENT_EDITOR_DONE, result)
  await invoke('close_element_editor')
}

/** 主窗口：监听子窗口回传的编辑结果 */
export async function listenElementEditorDone(
  handler: (result: ElementEditorResult) => void,
): Promise<UnlistenFn> {
  return listen<ElementEditorResult>(ELEMENT_EDITOR_DONE, (e) => handler(e.payload))
}

/** 由元素生成编辑器初始数据 */
export function payloadOfElement(el: CapturedElement): ElementEditorPayload {
  return {
    id: el.id,
    name: el.name,
    selector: el.selector,
    xpath: el.xpath,
    url: el.url,
    title: el.title,
  }
}
