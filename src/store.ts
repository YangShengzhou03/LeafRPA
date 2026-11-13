import { defineStore } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { commandByType } from './commands'
import * as bridge from './bridge'
import type { CloseAction } from './bridge'
import { ensurePlugin, runWebCommand, WEB_COMMAND_MAP } from './web-executor'
import { toastError, toastWarning } from './notify'
import { interpolate, declaresElement, declareKind, isDeclareKey, refsIn, type VariableDecl, type VarKind } from './vars'
import type { CommandDefinition, Flow, FlowEdge, FlowMeta, FlowNode, LogEntry } from './types'

export type TabKey = 'app' | 'trigger' | 'market' | 'tutorial' | 'community'

export interface FlowIssue {
  level: 'error' | 'warn'
  message: string
}

interface AppState {
  view: 'home' | 'apps' | 'designer'
  tab: TabKey
  flows: FlowMeta[]
  current: Flow | null
  selectedNodeId: string | null
  linkingFrom: string | null
  /** 步骤剪贴板（Ctrl+C / Ctrl+V 用，仅内存态） */
  clipboard: FlowNode | null
  logs: LogEntry[]
  running: boolean
  /** 运行中请求停止（在当前节点结束后终止） */
  stopRequested: boolean
  /** 单步调试状态 */
  debugging: boolean
  debugIds: string[]
  debugPos: number
  /** 流程运行期间的变量表（模拟执行器真实计算 data.* / net.* 指令的结果） */
  vars: Record<string, string>
  /** 全局变量表（应用级，内存态） */
  globalVars: VariableDecl[]
  /** 撤销 / 重做历史（流程快照） */
  history: string[]
  historyIndex: number
  /** 是否有未保存的修改 */
  dirty: boolean
  savedAt: number | null
  /** 流程数据保存位置描述 */
  dataDir: string
  /** 数据位置是否为用户自定义 */
  dataRootCustom: boolean
  /** 关闭按钮行为：exit / minimize / tray */
  closeAction: CloseAction
  /** 当前打开的独立页面（路由），home 表示主界面 */
  page: PageKey
  /** 外观模式：light / dark / system */
  themeMode: ThemeMode
}

export type PageKey =
  | 'home'
  | 'settings'
  | 'service'
  | 'help'
  | 'invite'
  | 'notice'
  | 'vip'
  | 'achievement'
  | 'tools'

export type ThemeMode = 'light' | 'dark' | 'system'

const HISTORY_LIMIT = 80
/** 子流程嵌套执行深度上限，防止循环引用导致栈溢出 */
const MAX_SUBFLOW_DEPTH = 8
let nodeRunDepth = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastPropHistoryAt = 0

function topoSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const indegree = new Map<string, number>()
  nodes.forEach((n) => indegree.set(n.id, 0))
  edges.forEach((e) => {
    if (indegree.has(e.to)) indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
  })
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0)
  const result: FlowNode[] = []
  while (queue.length) {
    const node = queue.shift() as FlowNode
    result.push(node)
    edges
      .filter((e) => e.from === node.id)
      .forEach((e) => {
        const next = (indegree.get(e.to) ?? 0) - 1
        indegree.set(e.to, next)
        if (next === 0) {
          const target = nodes.find((n) => n.id === e.to)
          if (target) queue.push(target)
        }
      })
  }
  const seen = new Set(result.map((n) => n.id))
  nodes.forEach((n) => {
    if (!seen.has(n.id)) result.push(n)
  })
  return result
}

/** 把网页指令返回结果序列化为变量字符串（单字段 text 时直接取文本） */
function toVarString(data: unknown): string {
  if (data == null) return ''
  if (typeof data === 'string') return data
  if (typeof data === 'number' || typeof data === 'boolean') return String(data)
  if (typeof data === 'object') {
    const keys = Object.keys(data as Record<string, unknown>)
    const rec = data as Record<string, unknown>
    if (keys.length === 1 && keys[0] === 'text' && (typeof rec.text === 'string' || rec.text == null)) {
      return String(rec.text ?? '')
    }
  }
  return JSON.stringify(data)
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    view: 'home',
    tab: 'app',
    flows: [],
    current: null,
    selectedNodeId: null,
    linkingFrom: null,
    clipboard: null,
    logs: [],
    running: false,
    stopRequested: false,
    debugging: false,
    debugIds: [],
    debugPos: 0,
    vars: {},
    globalVars: [],
    history: [],
    historyIndex: -1,
    dirty: false,
    savedAt: null,
    dataDir: '',
    dataRootCustom: false,
    closeAction: 'exit',
    page: 'home',
    themeMode: 'light',
  }),
  getters: {
    selectedNode(state): FlowNode | null {
      if (!state.current || !state.selectedNodeId) return null
      return state.current.nodes.find((n) => n.id === state.selectedNodeId) ?? null
    },
    selectedCommand(state): CommandDefinition | null {
      const node = state.current?.nodes.find((n) => n.id === state.selectedNodeId)
      return node ? commandByType(node.type) ?? null : null
    },
  },
  actions: {
    setTab(tab: TabKey) {
      this.tab = tab
      if (tab !== 'app' && this.view === 'designer') {
        this.view = 'apps'
        this.selectedNodeId = null
        this.linkingFrom = null
      }
    },
    /** 跳转到独立页面（路由），同时收起主界面标签态 */
    navigate(page: PageKey) {
      this.page = page
      if (page !== 'home' && this.view === 'designer') {
        this.selectedNodeId = null
      }
    },
    goHome() {
      this.page = 'home'
      this.tab = 'app'
      this.view = 'home'
    },
    setThemeMode(mode: ThemeMode) {
      this.themeMode = mode
    },
    showApps() {
      this.view = 'apps'
    },
    log(level: LogEntry['level'], message: string) {
      this.logs.push({ time: Date.now(), level, message })
      if (this.logs.length > 500) this.logs.splice(0, this.logs.length - 500)
    },
    clearLogs() {
      this.logs = []
    },
    async refreshFlows() {
      this.flows = await bridge.listFlows()
    },
    async loadDataDir() {
      this.dataDir = await bridge.getDataDir()
      try {
        const settings = await bridge.getAppSettings()
        this.dataRootCustom = settings.dataRoot.trim() !== ''
        this.closeAction = settings.closeAction
      } catch {
        /* 设置读取失败时保持默认 */
      }
    },
    /** 修改关闭按钮行为并持久化 */
    async setCloseAction(action: CloseAction) {
      this.closeAction = action
      try {
        await bridge.setCloseAction(action)
      } catch (err) {
        toastError(`保存设置失败：${err instanceof Error ? err.message : String(err)}`)
      }
    },
    /** 选择新的数据位置并迁移数据；返回是否成功 */
    async changeDataRoot(): Promise<boolean> {
      const picked = await bridge.pickFolder()
      if (!picked) return false
      try {
        await bridge.setDataRoot(picked)
        this.dataRootCustom = true
        await this.loadDataDir()
        await this.refreshFlows()
        return true
      } catch (err) {
        toastError(`迁移数据失败：${err instanceof Error ? err.message : String(err)}`)
        return false
      }
    },
    /** 恢复默认数据位置并迁回数据；返回是否成功 */
    async resetDataRoot(): Promise<boolean> {
      try {
        await bridge.setDataRoot('')
        this.dataRootCustom = false
        await this.loadDataDir()
        await this.refreshFlows()
        return true
      } catch (err) {
        toastError(`恢复默认位置失败：${err instanceof Error ? err.message : String(err)}`)
        return false
      }
    },
    async createAndOpen(name: string, type: Flow['type']) {
      try {
        const meta = await bridge.createFlow(name, type)
        await this.refreshFlows()
        await this.openFlow(meta.id)
      } catch (err) {
        toastError(`新建应用失败：${err instanceof Error ? err.message : String(err)}`)
        this.log('error', `新建应用失败：${String(err)}`)
      }
    },
    async openFlow(id: string) {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      this.current = await bridge.readFlow(id)
      this.selectedNodeId = null
      this.linkingFrom = null
      this.logs = []
      this.vars = {}
      this.history = []
      this.historyIndex = -1
      this.dirty = false
      this.savedAt = null
      this.view = 'designer'
      this.tab = 'app'
      // 打开流程时把节点里声明的结果变量登记到变量表，供 fx 选择
      this.syncVarsFromFlow()
    },
    async backHome() {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      await this.flushSave()
      this.view = 'apps'
      this.current = null
      this.selectedNodeId = null
      this.linkingFrom = null
      await this.refreshFlows()
    },
    async saveCurrent() {
      if (!this.current) return
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      this.pushHistory()
      this.current.updatedAt = Date.now()
      await bridge.writeFlow(this.current)
      this.dirty = false
      this.savedAt = Date.now()
      await this.refreshFlows()
      this.log('success', '已保存')
    },
    async removeFlow(id: string) {
      await bridge.deleteFlow(id)
      await this.refreshFlows()
    },
    selectNode(id: string | null) {
      /* 再次点击已选中的节点 = 取消选中（属性面板随之彻底折叠） */
      this.selectedNodeId = this.selectedNodeId === id ? null : id
    },
    /* ---------- 历史 / 自动保存 ---------- */
    snapshot(): string {
      return JSON.stringify(this.current)
    },
    pushHistory() {
      if (!this.current) return
      const snap = this.snapshot()
      if (this.history[this.historyIndex] === snap) return
      this.history = this.history.slice(0, this.historyIndex + 1)
      this.history.push(snap)
      if (this.history.length > HISTORY_LIMIT) this.history.shift()
      this.historyIndex = this.history.length - 1
    },
    restoreSnapshot(snap: string) {
      this.current = JSON.parse(snap) as Flow
      this.selectedNodeId = null
      this.linkingFrom = null
    },
    undo() {
      if (this.historyIndex <= 0) return
      this.historyIndex -= 1
      this.restoreSnapshot(this.history[this.historyIndex])
      this.markDirty()
    },
    redo() {
      if (this.historyIndex >= this.history.length - 1) return
      this.historyIndex += 1
      this.restoreSnapshot(this.history[this.historyIndex])
      this.markDirty()
    },
    /** 标记修改并安排一次防抖自动保存 */
    markDirty() {
      this.dirty = true
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveTimer = null
        this.pushHistory()
        void this.flushSave().catch((e: unknown) =>
          this.log('error', `自动保存失败：${e instanceof Error ? e.message : String(e)}`),
        )
      }, 900)
    },
    async flushSave() {
      if (!this.current || !this.dirty) return
      this.current.updatedAt = Date.now()
      await bridge.writeFlow(this.current)
      this.dirty = false
      this.savedAt = Date.now()
      await this.refreshFlows()
    },
    /* ---------- 节点编辑 ---------- */
    addNode(type: string, x: number, y: number) {
      if (!this.current) return
      const def = commandByType(type)
      if (!def) return
      const props: Record<string, unknown> = {}
      def.params.forEach((p) => {
        props[p.key] = p.value
      })
      const node: FlowNode = {
        id: bridge.createNodeId(),
        type,
        name: def.name,
        x,
        y,
        props,
      }
      this.pushHistory()
      this.current.nodes.push(node)
      this.selectedNodeId = node.id
      this.markDirty()
    },
    /** 节点拖动开始前记录一次历史，避免拖动过程产生大量历史条目 */
    beginNodeDrag() {
      if (!this.current) return
      this.pushHistory()
      this.markDirty()
    },
    duplicateNode(node: FlowNode) {
      if (!this.current) return
      const copy: FlowNode = {
        id: bridge.createNodeId(),
        type: node.type,
        name: `${node.name} 副本`,
        x: node.x + 24,
        y: node.y + 24,
        props: JSON.parse(JSON.stringify(node.props)) as Record<string, unknown>,
      }
      this.pushHistory()
      this.current.nodes.push(copy)
      this.selectedNodeId = copy.id
      this.markDirty()
    },
    moveNode(id: string, x: number, y: number) {
      const node = this.current?.nodes.find((n) => n.id === id)
      if (!node) return
      node.x = Math.round(x)
      node.y = Math.round(y)
    },
    /**
     * 步骤列表拖拽排序：把 fromId 节点移动到 toId 节点的前面或后面。
     * after 用于区分「拖到目标上方」还是「拖到目标下方」，避免向下拖动时总是插到目标之前。
     */
    reorderNode(fromId: string, toId: string, after = false) {
      if (!this.current || fromId === toId) return
      const nodes = this.current.nodes
      const from = nodes.findIndex((n) => n.id === fromId)
      if (from < 0 || !nodes.some((n) => n.id === toId)) return
      this.pushHistory()
      const [moved] = nodes.splice(from, 1)
      // 移出元素后目标下标可能前移，必须重新定位
      const target = nodes.findIndex((n) => n.id === toId)
      nodes.splice(after ? target + 1 : target, 0, moved)
      this.relinkChain()
      this.markDirty()
    },
    /**
     * 按当前节点数组顺序重建「顺序连线」。
     * 执行顺序由 topoSort(nodes, edges) 决定，只调数组顺序在存在连线时不会生效，
     * 因此重排之后需要同步连线。
     * 仅当流程本来就是完整线性链（边数 = 节点数-1 且无分支/汇聚）时重建；
     * 无连线 / 部分连线 / 分支结构保持原样，避免破坏流程图语义。
     */
    relinkChain() {
      const flow = this.current
      if (!flow) return
      const { nodes, edges } = flow
      if (edges.length === 0 || nodes.length < 2) return
      if (edges.length !== nodes.length - 1) return
      const outCount = new Map<string, number>()
      const inCount = new Map<string, number>()
      for (const e of edges) {
        outCount.set(e.from, (outCount.get(e.from) ?? 0) + 1)
        inCount.set(e.to, (inCount.get(e.to) ?? 0) + 1)
      }
      if ([...outCount.values()].some((c) => c > 1)) return
      if ([...inCount.values()].some((c) => c > 1)) return
      // 复用原连线 id，避免每次拖拽都产生新的边 id
      const keepId = new Map(edges.map((e) => [`${e.from}\u0000${e.to}`, e.id]))
      flow.edges = nodes.slice(0, -1).map((n, i) => {
        const to = nodes[i + 1].id
        return { id: keepId.get(`${n.id}\u0000${to}`) ?? bridge.createEdgeId(), from: n.id, to }
      })
    },
    /**
     * 把新节点插入到前驱 fromId 与后继之间，保持线性链的顺序执行。
     * fromId 没有后继时直接串联；有多个后继（分支）时不动原有连线。
     * 返回是否改写了连线。
     */
    linkAfter(fromId: string, newId: string): boolean {
      const flow = this.current
      if (!flow) return false
      const outs = flow.edges.filter((e) => e.from === fromId)
      if (outs.length > 1) return false
      if (outs.length === 0) {
        flow.edges.push({ id: bridge.createEdgeId(), from: fromId, to: newId })
        return true
      }
      const old = outs[0]
      const successor = old.to
      old.to = newId
      flow.edges.push({ id: bridge.createEdgeId(), from: newId, to: successor })
      return true
    },
    /**
     * 复制选中的步骤到内部剪贴板。
     * 返回是否复制成功，便于调用方决定是否提示。
     */
    copyNode(id: string): boolean {
      const node = this.current?.nodes.find((n) => n.id === id)
      if (!node) return false
      // 深拷贝，避免粘贴结果与原节点共享 props 引用
      this.clipboard = JSON.parse(JSON.stringify(node)) as FlowNode
      return true
    },
    /**
     * 粘贴剪贴板内容：插到选中步骤之后，没有选中时追加到末尾。
     * 返回新节点。
     */
    pasteNode(): FlowNode | null {
      const flow = this.current
      const src = this.clipboard
      if (!flow || !src) return null
      const nodes = flow.nodes
      const anchor = this.selectedNodeId
        ? nodes.find((n) => n.id === this.selectedNodeId) ?? null
        : nodes[nodes.length - 1] ?? null
      const node: FlowNode = {
        id: bridge.createNodeId(),
        type: src.type,
        name: src.name,
        x: src.x,
        y: src.y + 96,
        props: JSON.parse(JSON.stringify(src.props)) as Record<string, unknown>,
      }
      // 禁用 / 断点属于「这一行」的状态，复制步骤时不带过去
      this.pushHistory()
      if (anchor) {
        nodes.splice(nodes.indexOf(anchor) + 1, 0, node)
        this.linkAfter(anchor.id, node.id)
      } else {
        nodes.push(node)
      }
      this.selectedNodeId = node.id
      this.markDirty()
      return node
    },
    /** 删除节点后把它前后的链接上，保持顺序执行 */
    linkAround(removedId: string) {
      const flow = this.current
      if (!flow) return
      const ins = flow.edges.filter((e) => e.to === removedId)
      const outs = flow.edges.filter((e) => e.from === removedId)
      // 只有 1 进 1 出的简单链才自动接回，分支 / 汇聚交给用户手动连线
      if (ins.length !== 1 || outs.length !== 1) return
      if (ins[0].from === outs[0].to) return
      const exists = flow.edges.some((e) => e.from === ins[0].from && e.to === outs[0].to)
      if (exists) return
      flow.edges.push({ id: bridge.createEdgeId(), from: ins[0].from, to: outs[0].to })
    },
    /** 切换步骤注释状态（注释后运行与调试都会跳过） */
    toggleNodeDisabled(id: string) {
      const node = this.current?.nodes.find((n) => n.id === id)
      if (!node) return
      this.pushHistory()
      node.disabled = !node.disabled
      this.markDirty()
    },
    /** 切换步骤断点 */
    toggleNodeBreakpoint(id: string) {
      const node = this.current?.nodes.find((n) => n.id === id)
      if (!node) return
      this.pushHistory()
      node.breakpoint = !node.breakpoint
      this.markDirty()
    },
    /** 在指定节点之后插入一个新节点；目标无后继时自动连线，保持顺序执行 */
    insertNodeAfter(targetId: string, type: string) {
      if (!this.current) return
      const nodes = this.current.nodes
      const idx = nodes.findIndex((n) => n.id === targetId)
      if (idx < 0) return
      const def = commandByType(type)
      if (!def) return
      const props: Record<string, unknown> = {}
      def.params.forEach((p) => {
        props[p.key] = p.value
      })
      const node: FlowNode = {
        id: bridge.createNodeId(),
        type,
        name: def.name,
        x: nodes[idx].x,
        y: nodes[idx].y + 96,
        props,
      }
      this.pushHistory()
      nodes.splice(idx + 1, 0, node)
      // 接到前驱之后、原后继之前，保持顺序执行
      this.linkAfter(targetId, node.id)
      this.selectedNodeId = node.id
      this.markDirty()
    },
    /** 在流程末尾追加一个节点（智能录制采集结果等外部来源），返回新节点 */
    appendNode(type: string, name: string, props: Record<string, unknown>): FlowNode | null {
      if (!this.current) return null
      const nodes = this.current.nodes
      const last = nodes[nodes.length - 1]
      const node: FlowNode = {
        id: bridge.createNodeId(),
        type,
        name,
        x: last ? last.x : 80,
        y: last ? last.y + 96 : 80,
        props,
      }
      this.pushHistory()
      nodes.push(node)
      this.selectedNodeId = node.id
      this.markDirty()
      return node
    },
    /** 新建子流程：创建 instruction 流程并在当前流程末尾插入引用节点 */
    async createSubflow(name: string): Promise<void> {
      const meta = await bridge.createFlow(name, 'instruction')
      await this.refreshFlows()
      if (!this.current) return
      this.appendNode('instruction', `子流程 ${name}`, { name: meta.name, outKey: `${name}p` })
    },
    /** 新增一个全局变量；不传名称时弹窗输入 */
    async addGlobalVar(name?: string, kind: VarKind = 'text') {
      let value = name?.trim() ?? ''
      if (!value) {
        try {
          const res = await ElMessageBox.prompt('请输入变量名称', '新增变量', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputPattern: /^[A-Za-z_\u4e00-\u9fa5][\w.\u4e00-\u9fa5]*$/,
            inputErrorMessage: '变量名以字母、下划线或中文开头，可含数字、点号',
          })
          value = String(res.value ?? '').trim()
        } catch {
          return
        }
      }
      if (!value) return
      if (this.globalVars.some((v) => v.name === value)) {
        toastWarning('变量「' + value + '」已存在', { title: '名称重复' })
        return
      }
      this.globalVars.push({ name: value, kind })
    },
    removeGlobalVar(name: string) {
      this.globalVars = this.globalVars.filter((v) => v.name !== name)
    },
    /** 声明或更新变量；已存在时仅更新类型 */
    upsertVar(name: string, kind: VarKind, extra?: { selector?: string; summary?: string }) {
      const trimmed = name.trim()
      if (!trimmed) return
      const exist = this.globalVars.find((v) => v.name === trimmed)
      if (exist) {
        exist.kind = kind
        if (extra?.selector) exist.selector = extra.selector
        if (extra?.summary) exist.summary = extra.summary
        return
      }
      this.globalVars.push({ name: trimmed, kind, ...extra })
    },
    /**
     * 变量解析表：运行值优先；选择器语境下元素变量替换为其选择器。
     * 只读视图，不写回 state。
     */
    varsFor(selectorMode = false): Record<string, string> {
      if (!selectorMode) return this.vars
      const table: Record<string, string> = { ...this.vars }
      this.globalVars.forEach((v) => {
        if (v.kind === 'element' && v.selector) table[v.name] = v.selector
      })
      return table
    },
    /**
     * 从流程节点同步变量声明：扫描所有「声明类」参数，
     * 自动把新出现的变量登记到变量表（元素结果变量标为 element）。
     */
    syncVarsFromFlow() {
      const flow = this.current
      if (!flow) return
      const declared: VariableDecl[] = []
      for (const node of flow.nodes) {
        const def = commandByType(node.type)
        if (!def) continue
        for (const p of def.params) {
          if (!isDeclareKey(node.type, p.key)) continue
          const raw = String(node.props?.[p.key] ?? '').trim()
          if (!raw || refsIn(raw).length > 0) continue
          declared.push({ name: raw, kind: declareKind(node.type, p.key) })
        }
      }
      for (const d of declared) {
        const exist = this.globalVars.find((v) => v.name === d.name)
        if (!exist) this.globalVars.push(d)
        else if (d.kind === 'element') exist.kind = 'element'
      }
    },
    /** 修改节点参数；传 nodeId 时指定目标节点，否则作用于当前选中节点 */
    updateNodeProp(key: string, value: unknown, nodeId?: string) {
      const targetId = nodeId ?? this.selectedNodeId
      const node = this.current?.nodes.find((n) => n.id === targetId)
      if (!node) return
      node.props[key] = value
      this.markDirty()
      // 连续输入时合并历史条目，停止输入后的自动保存会再记录一次
      const now = Date.now()
      if (now - lastPropHistoryAt > 600) {
        this.pushHistory()
        lastPropHistoryAt = now
      }
    },
    /** 重命名当前打开的流程；传入 id 时可重命名列表中任意流程 */
    async renameFlow(name: string, id?: string) {
      const trimmed = name.trim()
      if (!trimmed) return
      if (id && (!this.current || this.current.id !== id)) {
        const flow = await bridge.readFlow(id)
        if (flow.name === trimmed) return
        flow.name = trimmed
        flow.updatedAt = Date.now()
        await bridge.writeFlow(flow)
        await this.refreshFlows()
        return
      }
      if (!this.current || trimmed === this.current.name) return
      this.pushHistory()
      this.current.name = trimmed
      this.markDirty()
    },
    removeNode(id: string) {
      if (!this.current) return
      this.pushHistory()
      this.current.nodes = this.current.nodes.filter((n) => n.id !== id)
      // 先把前后接上，再删掉该节点相关的连线
      this.linkAround(id)
      this.current.edges = this.current.edges.filter((e) => e.from !== id && e.to !== id)
      if (this.selectedNodeId === id) this.selectedNodeId = null
      if (this.linkingFrom === id) this.linkingFrom = null
      this.markDirty()
    },
    startLink(id: string) {
      this.linkingFrom = id
    },
    tryConnect(targetId: string) {
      if (!this.linkingFrom || !this.current) return
      if (this.linkingFrom === targetId) {
        this.linkingFrom = null
        return
      }
      const exists = this.current.edges.some((e) => e.from === this.linkingFrom && e.to === targetId)
      if (!exists) {
        this.pushHistory()
        this.current.edges.push({ id: bridge.createEdgeId(), from: this.linkingFrom, to: targetId })
        this.markDirty()
      }
      this.linkingFrom = null
    },
    /* ---------- 校验 / 导入导出 ---------- */
    validateFlow(): FlowIssue[] {
      const issues: FlowIssue[] = []
      const flow = this.current
      if (!flow) return issues
      if (flow.nodes.length === 0) {
        issues.push({ level: 'error', message: '流程为空，请先添加指令节点' })
        return issues
      }
      // 环检测（Kahn）
      const indegree = new Map<string, number>()
      flow.nodes.forEach((n) => indegree.set(n.id, 0))
      flow.edges.forEach((e) => {
        if (indegree.has(e.to)) indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
      })
      const queue = flow.nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id)
      let visited = 0
      while (queue.length) {
        const id = queue.shift() as string
        visited += 1
        flow.edges
          .filter((e) => e.from === id)
          .forEach((e) => {
            const next = (indegree.get(e.to) ?? 0) - 1
            indegree.set(e.to, next)
            if (next === 0) queue.push(e.to)
          })
      }
      if (visited < flow.nodes.length) {
        issues.push({ level: 'error', message: '流程存在循环依赖，请检查节点连线' })
      }
      // 参数校验 + 变量引用校验
      // 已注释的步骤不会执行，其参数问题不应阻断整个流程，因此只对启用中的步骤校验
      const declared = new Set(this.globalVars.map((v) => v.name))
      flow.nodes.forEach((n) => {
        if (n.disabled) return
        const def = commandByType(n.type)
        if (!def) {
          issues.push({ level: 'error', message: `节点「${n.name}」使用了未知指令类型 ${n.type}` })
          return
        }
        def.params.forEach((p) => {
          const value = n.props?.[p.key]
          const text = String(value ?? '').trim()
          if (p.type === 'string' && text === '') {
            issues.push({ level: 'error', message: `节点「${n.name}」的参数「${p.label}」未填写` })
          }
          if (p.type === 'number' && text !== '' && Number.isNaN(Number(text))) {
            issues.push({ level: 'error', message: `节点「${n.name}」的参数「${p.label}」不是有效数字` })
          }
          refsIn(text).forEach((ref) => {
            if (declared.has(ref)) return
            issues.push({
              level: 'error',
              message: `节点「${n.name}」的参数「${p.label}」引用了未定义的变量 {{${ref}}}`,
            })
          })
        })
      })
      // 连线情况
      if (flow.nodes.length > 1) {
        if (flow.edges.length === 0) {
          issues.push({ level: 'warn', message: '流程包含多个节点但没有任何连线，节点将按添加顺序执行' })
        }
        flow.nodes.forEach((n) => {
          const linked = flow.edges.some((e) => e.from === n.id || e.to === n.id)
          if (!linked) issues.push({ level: 'warn', message: `节点「${n.name}」没有连接任何连线` })
        })
      }
      return issues
    },
    exportCurrent(): string {
      if (!this.current) return ''
      // 轻羽RPA专有流程格式：.leafrpa 文件即此信封结构
      return JSON.stringify(
        {
          format: 'leafrpa',
          version: 1,
          exportedAt: new Date().toISOString(),
          flow: this.current,
        },
        null,
        2,
      )
    },
    async importFlow(raw: string): Promise<void> {
      let data: unknown
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error('文件已损坏或不是轻羽RPA流程文件')
      }
      const envelope = data as { format?: string; flow?: Partial<Flow> }
      if (!envelope || envelope.format !== 'leafrpa' || !envelope.flow || typeof envelope.flow !== 'object') {
        throw new Error('不是轻羽RPA流程文件，无法导入')
      }
      const obj = envelope.flow
      if (typeof obj.name !== 'string' || obj.name.trim() === '') throw new Error('缺少流程名称')
      if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) throw new Error('缺少 nodes / edges 字段')
      const type: Flow['type'] = obj.type === 'mobile' || obj.type === 'instruction' ? obj.type : 'pc'
      const meta = await bridge.createFlow(obj.name.trim(), type)
      const idMap = new Map<string, string>()
      const nodes: FlowNode[] = obj.nodes.map((rawNode) => {
        const node = rawNode as Partial<FlowNode>
        const original = typeof node.id === 'string' ? node.id : ''
        const id = bridge.createNodeId()
        if (original) idMap.set(original, id)
        return {
          id,
          type: String(node.type ?? ''),
          name: String(node.name ?? ''),
          x: Number(node.x) || 0,
          y: Number(node.y) || 0,
          props: (node.props ?? {}) as Record<string, unknown>,
        }
      })
      const edges: FlowEdge[] = obj.edges
        .map((rawEdge) => {
          const edge = rawEdge as Partial<FlowEdge>
          return { from: String(edge.from ?? ''), to: String(edge.to ?? '') }
        })
        .filter((e) => idMap.has(e.from) && idMap.has(e.to))
        .map((e) => ({ id: bridge.createEdgeId(), from: idMap.get(e.from) as string, to: idMap.get(e.to) as string }))
      const flow: Flow = {
        id: meta.id,
        name: meta.name,
        type,
        createdAt: meta.createdAt,
        updatedAt: Date.now(),
        nodes,
        edges,
      }
      await bridge.writeFlow(flow)
      await this.refreshFlows()
      await this.openFlow(meta.id)
      this.log('success', `已导入流程「${meta.name}」`)
    },
    async clearAllData() {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      for (const meta of this.flows) {
        await bridge.deleteFlow(meta.id)
      }
      bridge.clearLocalData()
      this.current = null
      this.selectedNodeId = null
      this.linkingFrom = null
      this.logs = []
      this.vars = {}
      this.history = []
      this.historyIndex = -1
      this.dirty = false
      this.savedAt = null
      await this.refreshFlows()
    },
    /* ---------- 运行 ---------- */
    async run() {
      if (!this.current || this.running) return
      const issues = this.validateFlow()
      const errors = issues.filter((i) => i.level === 'error')
      if (errors.length > 0) {
        this.logs = []
        errors.forEach((i) => this.log('error', `运行前检查：${i.message}`))
        return
      }
      this.running = true
      this.stopRequested = false
      this.logs = []
      this.log('info', `开始运行「${this.current.name}」`)
      issues
        .filter((i) => i.level === 'warn')
        .forEach((i) => this.log('warn', `运行前检查：${i.message}`))
      try {
        const order = topoSort(this.current.nodes, this.current.edges)
        if (order.length === 0) this.log('warn', '流程为空，未执行任何指令')
        for (const node of order) {
          // 已注释的步骤只跳过自身，不影响其它步骤继续执行
          if (node.disabled) {
            this.log('info', `跳过已注释步骤：${node.name}`)
            continue
          }
          this.selectedNodeId = node.id
          const ok = await this.runNode(node)
          if (!ok) {
            this.log('error', `「${node.name}」执行失败，流程已终止`)
            return
          }
          if (node.type === 'flow.break') {
            this.log('warn', '遇到「中断流程」，流程已终止')
            return
          }
          if (this.stopRequested) {
            this.log('warn', '已手动停止运行')
            return
          }
        }
        this.log('success', '流程运行结束')
      } finally {
        this.running = false
      }
    },
    /* ---------- 单步调试 ---------- */
    async startDebug() {
      if (!this.current || this.running) return
      const issues = this.validateFlow()
      const errors = issues.filter((i) => i.level === 'error')
      if (errors.length > 0) {
        this.logs = []
        errors.forEach((i) => this.log('error', `运行前检查：${i.message}`))
        return
      }
      const order = topoSort(this.current.nodes, this.current.edges)
      this.debugIds = order.map((n) => n.id)
      this.debugPos = 0
      this.debugging = true
      this.logs = []
      this.log('info', `开始单步调试，共 ${order.length} 个节点`)
      if (this.debugIds.length > 0) await this.debugStep()
      else this.finishDebug()
    },
    /** 执行调试队列中的下一个节点 */
    async debugStep() {
      if (!this.debugging || !this.current) return
      if (this.debugPos >= this.debugIds.length) {
        this.finishDebug()
        return
      }
      const node = this.current.nodes.find((n) => n.id === this.debugIds[this.debugPos])
      if (!node || node.disabled) {
        this.debugPos += 1
        await this.debugStep()
        return
      }
      if (node.breakpoint) this.log('warn', `命中断点：${node.name}`)
      this.selectedNodeId = node.id
      const ok = await this.runNode(node)
      if (!ok) {
        this.finishDebug()
        return
      }
      this.debugPos += 1
      if (this.debugPos >= this.debugIds.length) this.finishDebug()
    },
    finishDebug() {
      if (!this.debugging) return
      this.debugging = false
      this.log('info', '调试结束')
    },
    /** 执行单个节点：先校验参数，再对可在前端真实执行的指令给出真实结果 */
    async runNode(node: FlowNode): Promise<boolean> {
      const def = commandByType(node.type)
      this.log('info', `执行：${node.name}`)
      if (!def) {
        this.log('error', `未知指令类型：${node.type}`)
        return false
      }
      const props = node.props ?? {}
      /** 读取参数原值（保留 {{变量}} 引用） */
      const rawStr = (key: string) => String(props[key] ?? '').trim()
      /**
       * 解析参数：替换 {{变量}} 引用。
       * 选择器类参数把元素变量解析为它的选择器，其余参数取变量的运行值。
       */
      const str = (key: string) => {
        const selectorMode = key.toLowerCase().includes('selector')
        return interpolate(rawStr(key), this.varsFor(selectorMode)).trim()
      }
      // 变量引用校验：引用了未声明的变量时给出明确提示，而不是把 {{x}} 当成文本传下去
      for (const p of def.params) {
        for (const ref of refsIn(rawStr(p.key))) {
          if (this.vars[ref] !== undefined) continue
          if (this.globalVars.some((v) => v.name === ref)) continue
          this.log('error', `「${node.name}」的参数「${p.label}」引用了未定义的变量 {{${ref}}}`)
          return false
        }
      }
      // 必填参数校验：字符串 / 数字参数不允许为空
      for (const p of def.params) {
        const value = str(p.key)
        if (p.type === 'string' && !value) {
          this.log('error', `「${node.name}」参数「${p.label}」不能为空，请在指令编辑窗口中填写`)
          return false
        }
        if (p.type === 'number') {
          const n = Number(value === '' ? NaN : value)
          if (Number.isNaN(n)) {
            this.log('error', `「${node.name}」参数「${p.label}」不是有效数字`)
            return false
          }
        }
      }
      // 网页自动化指令：走浏览器插件通道真实执行
      if (WEB_COMMAND_MAP[node.type]) {
        let data: unknown
        const resolved: Record<string, unknown> = { ...props }
        for (const p of def.params) {
          if (typeof props[p.key] === 'string') resolved[p.key] = str(p.key)
        }
        try {
          data = await runWebCommand(node.type, resolved)
        } catch (e) {
          this.log('error', `${node.name} 执行失败：${e instanceof Error ? e.message : String(e)}`)
          return false
        }
        this.log('success', `${node.name} ✓`)
        const variable = str('variable')
        if (variable) this.vars[variable] = toVarString(data)
        if (declaresElement(node.type, 'variable') && variable) {
          // 页面元素存为元素变量：记录其选择器，后续指令可引用 {{变量}} 定位元素
          const selector = str('selector')
          this.upsertVar(variable, 'element', selector ? { selector } : undefined)
        }
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, 220))
      switch (node.type) {
        case 'web.open': {
          const url = str('url')
          const browser = str('browser') || 'chrome'
          if (browser === 'chrome') {
            // Chrome：先确保插件通道可用（宿主不可达时自动拉起 Chrome），再走插件通道开标签页
            try {
              await ensurePlugin()
              await runWebCommand('open-web', { url, active: true })
              this.log('success', `已在 Chrome 打开 ${url}`)
              break
            } catch (e) {
              const reason = e instanceof Error ? e.message : String(e)
              this.log('error', `Chrome 插件通道失败：${reason}，回退系统浏览器`)
              // 继续走系统浏览器兜底
            }
          }
          try {
            await bridge.openInBrowser(url)
            this.log('success', `已在系统浏览器打开 ${url}`)
          } catch (e) {
            this.log('error', `打开网页失败：${e instanceof Error ? e.message : String(e)}`)
            return false
          }
          break
        }
        case 'util.log': {
          this.log('info', `[流程日志] ${str('message')}`)
          break
        }
        case 'util.wait': {
          const sec = Math.min(5, Math.max(0, Number(props.seconds) || 0))
          this.log('info', `等待 ${sec} 秒…`)
          await new Promise((resolve) => setTimeout(resolve, sec * 1000))
          break
        }
        case 'data.setVar': {
          const value = interpolate(String(props.value ?? ''), this.vars)
          this.vars[str('name')] = value
          this.log('success', `变量 ${str('name')} = "${value}"`)
          break
        }
        case 'data.text': {
          const input = interpolate(String(props.input ?? ''), this.vars)
          const op = String(props.operation ?? 'trim')
          let out = input
          if (op === 'trim') out = input.trim()
          else if (op === 'upper') out = input.toUpperCase()
          else if (op === 'replace') out = input.replace(/\s+/g, ' ')
          else if (op === 'substring') out = input.slice(0, 10)
          const name = str('variable') || 'out'
          this.vars[name] = out
          this.log('success', `文本处理结果 ${name} = "${out}"`)
          break
        }
        case 'data.json': {
          const input = interpolate(String(props.input ?? ''), this.vars)
          const path = str('path')
          const out = str('variable') || 'jsonOut'
          try {
            let data: unknown = JSON.parse(input)
            if (path) {
              for (const seg of path.split('.')) {
                data = (data as Record<string, unknown>)?.[seg]
              }
            }
            const result = typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data ?? '')
            this.vars[out] = result
            this.log('success', `JSON 解析结果 ${out} = "${result.slice(0, 100)}"`)
          } catch (e) {
            this.log('error', `JSON 解析失败：${e instanceof Error ? e.message : String(e)}`)
            return false
          }
          break
        }
        case 'net.http': {
          const url = str('url')
          const method = String(props.method ?? 'GET').toUpperCase()
          const headers: Record<string, string> = {}
          String(interpolate(String(props.headers ?? ''), this.vars))
            .split('\n')
            .forEach((line) => {
              const idx = line.indexOf(':')
              if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
            })
          const output = str('output') || 'httpResult'
          const timeoutSec = Math.min(60, Math.max(1, Number(props.timeout) || 15))
          try {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), timeoutSec * 1000)
            const res = await fetch(url, {
              method,
              headers,
              body:
                method === 'GET' || method === 'HEAD'
                  ? undefined
                  : interpolate(String(props.body ?? ''), this.vars),
              signal: controller.signal,
            })
            clearTimeout(timer)
            const body = await res.text()
            this.vars[`${output}.status`] = String(res.status)
            this.vars[`${output}.body`] = body.slice(0, 4000)
            this.log('success', `HTTP ${method} ${url} → ${res.status}（响应 ${body.length} 字符）`)
          } catch (e) {
            this.log('error', `HTTP 请求失败：${url}（${e instanceof Error ? e.message : String(e)}）`)
            return false
          }
          break
        }
        case 'python.code': {
          const code = String(props.code ?? '')
          const output = str('output') || 'pyResult'
          try {
            const res = await bridge.runPythonCode(code, this.vars)
            if (!res.ok) {
              const last = (res.error ?? '').trim().split('\n').pop() ?? '未知错误'
              this.log('error', `Python 执行失败：${last}`)
              return false
            }
            const varsOut = res.vars ?? {}
            Object.entries(varsOut).forEach(([k, v]) => {
              this.vars[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')
            })
            if (res.logs) {
              res.logs
                .split('\n')
                .filter((line) => line.trim())
                .forEach((line) => this.log('info', line))
            }
            const result = res.result
            this.vars[output] =
              result == null ? '' : typeof result === 'object' ? JSON.stringify(result) : String(result)
            this.log('success', `Python 执行完成，结果已保存到变量 ${output}`)
          } catch (e) {
            this.log('error', `Python 执行异常：${e instanceof Error ? e.message : String(e)}`)
            return false
          }
          break
        }
        case 'instruction': {
          const name = str('name')
          if (nodeRunDepth >= MAX_SUBFLOW_DEPTH) {
            this.log('error', `子流程「${name}」嵌套层数超过 ${MAX_SUBFLOW_DEPTH} 层，已停止执行`)
            return false
          }
          const metas = await bridge.listFlows()
          const meta = metas.find((m) => m.type === 'instruction' && m.name === name)
          if (!meta) {
            this.log('error', `未找到子流程「${name}」，请先在「应用」列表中创建`)
            return false
          }
          let sub: Flow
          try {
            sub = await bridge.readFlow(meta.id)
          } catch (e) {
            this.log('error', `读取子流程「${name}」失败：${e instanceof Error ? e.message : String(e)}`)
            return false
          }
          const order = topoSort(sub.nodes, sub.edges)
          this.log('info', `进入子流程「${name}」（共 ${order.length} 步）`)
          nodeRunDepth += 1
          try {
            for (const subNode of order) {
              if (subNode.disabled) {
                this.log('info', `跳过已注释步骤：${subNode.name}`)
                continue
              }
              const ok = await this.runNode(subNode)
              if (!ok) return false
            }
          } finally {
            nodeRunDepth -= 1
          }
          const outKey = str('outKey')
          if (outKey) this.vars[outKey] = '子流程执行完成'
          this.log('success', `子流程「${name}」执行完成`)
          break
        }
        default:
          this.log('success', `${node.name} 完成（模拟执行）`)
      }
      return true
    },
  },
})
