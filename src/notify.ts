import { ElNotification } from 'element-plus'
import { t } from './i18n'

export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

export interface ToastOptions {
  /** 通知标题 */
  title?: string
  /** 自动关闭延时（毫秒），0 表示不自动关闭 */
  duration?: number
  /** 弹出位置 */
  position?: ToastPosition
  /** 距离窗口顶部的偏移量 */
  offset?: number
  /** 是否显示关闭按钮 */
  showClose?: boolean
  /** message 是否支持 HTML */
  dangerouslyUseHTMLString?: boolean
}

/** 第二参数既兼容旧的字符串标题，也支持富选项 */
export type ToastInput = string | ToastOptions

function build(message: string, input: ToastInput | undefined, fallbackTitleKey: Parameters<typeof t>[0]) {
  const opts: ToastOptions = typeof input === 'string' ? { title: input } : { title: t(fallbackTitleKey), ...input }
  const params: Record<string, unknown> = { title: opts.title ?? t(fallbackTitleKey), message }
  if (opts.duration != null) params.duration = opts.duration
  if (opts.position) params.position = opts.position
  if (opts.offset != null) params.offset = opts.offset
  if (opts.showClose != null) params.showClose = opts.showClose
  if (opts.dangerouslyUseHTMLString != null) params.dangerouslyUseHTMLString = opts.dangerouslyUseHTMLString
  return params
}

/** 成功通知（默认 2.6s 自动关闭） */
export function toastSuccess(message: string, input?: ToastInput) {
  ElNotification.success(build(message, input, 'notify.success'))
}

/** 信息通知（默认 2.6s 自动关闭） */
export function toastInfo(message: string, input?: ToastInput) {
  ElNotification.info(build(message, input, 'notify.info'))
}

/** 警告通知（默认 2.6s 自动关闭） */
export function toastWarning(message: string, input?: ToastInput) {
  ElNotification.warning(build(message, input, 'notify.warning'))
}

/** 错误通知（默认 4s 自动关闭，停留更久便于阅读） */
export function toastError(message: string, input?: ToastInput) {
  const params = build(message, input, 'notify.error')
  params.duration = (typeof input === 'object' && input?.duration != null) ? input.duration : 4000
  ElNotification.error(params)
}
