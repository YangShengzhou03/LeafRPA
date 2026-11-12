export interface FlowNode {
  id: string
  type: string
  name: string
  x: number
  y: number
  props: Record<string, unknown>
  /** 步骤列表模式下：是否注释掉该步骤（运行与调试时跳过） */
  disabled?: boolean
  /** 步骤列表模式下：是否设置断点 */
  breakpoint?: boolean
}

export interface FlowEdge {
  id: string
  from: string
  to: string
}

export interface Flow {
  id: string
  name: string
  type: 'pc' | 'mobile' | 'instruction'
  createdAt: number
  updatedAt: number
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface FlowMeta {
  id: string
  name: string
  type: string
  createdAt: number
  updatedAt: number
}

export interface LogEntry {
  time: number
  level: 'info' | 'success' | 'warn' | 'error'
  message: string
}

export interface CommandParam {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'textarea'
  value: unknown
  options?: { label: string; value: string }[]
}

export interface CommandDefinition {
  type: string
  name: string
  category: string
  color: string
  description: string
  params: CommandParam[]
}
