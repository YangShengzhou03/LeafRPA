/**
 * 变量模型：变量分「类型」，文本里通过 {{变量名}} 引用变量。
 * 这样普通文本与变量在同一个输入框内可混排，也能被高亮和校验。
 */

export type VarKind = 'text' | 'element' | 'number' | 'boolean' | 'list' | 'dict'

export interface VariableDecl {
  name: string
  kind: VarKind
  /** 元素变量：抓取到的元素选择器，可在选择器类参数中直接引用 */
  selector?: string
  /** 元素变量：元素描述（标签、文本片段），仅用于展示 */
  summary?: string
}

export const VAR_KINDS: { kind: VarKind; label: string; color: string }[] = [
  { kind: 'text', label: '字符串', color: '#10b981' },
  { kind: 'element', label: '元素变量', color: '#3b82f6' },
  { kind: 'number', label: '数字', color: '#f59e0b' },
  { kind: 'boolean', label: '布尔', color: '#8b5cf6' },
  { kind: 'list', label: '列表', color: '#06b6d4' },
  { kind: 'dict', label: '字典', color: '#ef4444' },
]

export function kindLabel(kind: VarKind): string {
  return VAR_KINDS.find((k) => k.kind === kind)?.label ?? '字符串'
}

export function kindColor(kind: VarKind): string {
  return VAR_KINDS.find((k) => k.kind === kind)?.color ?? '#10b981'
}

/** 参数是否用于「声明一个新变量」（而不是引用已有值） */
export function isDeclareKey(nodeType: string, key: string): boolean {
  if (key === 'variable' || key === 'output' || key === 'outKey') return true
  // 设置变量指令的「变量名」是声明；子流程的「子流程名称」只是名字
  return key === 'name' && nodeType === 'data.setVar'
}

/** 该参数声明的是元素变量（单个网页元素的获取类指令结果） */
const ELEMENT_RESULT_TYPES = new Set(['get-element-web', 'get-related-web'])

export function declaresElement(nodeType: string, key: string): boolean {
  return key === 'variable' && ELEMENT_RESULT_TYPES.has(nodeType)
}

/** 推算某个「声明类」参数应当写入的变量类型 */
export function declareKind(nodeType: string, key: string): VarKind {
  if (declaresElement(nodeType, key)) return 'element'
  if (nodeType === 'get-similar-web') return 'list'
  if (nodeType === 'flow.loop' && key === 'variable') return 'number'
  if (nodeType === 'data.json') return 'dict'
  return 'text'
}

const REF_RE = /\{\{\s*([A-Za-z_\u4e00-\u9fa5][\w.\u4e00-\u9fa5]*)\s*\}\}/g

export interface TextSegment {
  text: string
  /** 该段是变量引用时的变量名 */
  ref?: string
}

/** 把文本切成普通文本段与变量引用段，用于高亮渲染 */
export function splitRefs(text: string): TextSegment[] {
  const src = String(text ?? '')
  if (!src) return []
  const out: TextSegment[] = []
  let last = 0
  for (const m of src.matchAll(REF_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ text: src.slice(last, idx) })
    out.push({ text: m[0], ref: m[1] })
    last = idx + m[0].length
  }
  if (last < src.length) out.push({ text: src.slice(last) })
  return out
}

/** 提取文本中引用到的全部变量名 */
export function refsIn(text: string): string[] {
  const names: string[] = []
  for (const m of String(text ?? '').matchAll(REF_RE)) names.push(m[1])
  return names
}

/** 用变量表替换 {{变量名}}；未声明的引用保持原样，便于运行时报错定位 */
export function interpolate(text: string, vars: Record<string, string>): string {
  return String(text ?? '').replace(REF_RE, (whole, name: string) => {
    const v = vars[name]
    return v === undefined ? whole : v
  })
}

/** 在光标处插入变量引用；无光标信息时追加到末尾 */
export function insertRef(text: string, name: string, caret?: number | null): { text: string; caret: number } {
  const src = String(text ?? '')
  const token = `{{${name}}}`
  const at = typeof caret === 'number' && caret >= 0 && caret <= src.length ? caret : src.length
  return { text: src.slice(0, at) + token + src.slice(at), caret: at + token.length }
}
