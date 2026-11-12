import { defineStore } from 'pinia'
import type { useAppStore } from './store'
import type { FlowMeta } from './types'

export type TriggerKind = '定时触发' | '循环触发' | '手动触发'

export interface Trigger {
  id: string
  name: string
  kind: TriggerKind
  /** 关联流程名（兼容旧数据） */
  flow: string
  /** 关联流程 ID（优先使用） */
  flowId: string
  enabled: boolean
  /** 定时触发的执行时间 HH:mm */
  time: string
  /** 循环触发的间隔秒数 */
  interval: number
  lastRun: string
  lastRunAt: number
}

export interface TriggerRun {
  id: string
  triggerId: string
  triggerName: string
  flowName: string
  time: number
  ok: boolean
  message: string
}

const TRIGGERS_KEY = 'leaf-rpa.triggers.v1'
const HISTORY_KEY = 'leaf-rpa.triggerHistory.v1'
const RUNS_KEY = 'leaf-rpa.runs.v1'
const HISTORY_LIMIT = 100

type AppStore = ReturnType<typeof useAppStore>
type TriggerStore = ReturnType<typeof useTriggerStore>

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function createTriggerId(): string {
  return newId('trig_')
}

export function loadTriggers(): Trigger[] {
  try {
    const raw = localStorage.getItem(TRIGGERS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as Trigger[]
    return list.map((t) => ({
      ...t,
      kind: t.kind === '循环触发' || t.kind === '手动触发' ? t.kind : '定时触发',
      time: typeof t.time === 'string' && t.time ? t.time : '09:00',
      interval: Number(t.interval) > 0 ? Number(t.interval) : 60,
      lastRunAt: Number(t.lastRunAt) || 0,
      flowId: typeof t.flowId === 'string' ? t.flowId : '',
      lastRun: typeof t.lastRun === 'string' ? t.lastRun : '从未',
      enabled: t.enabled !== false,
    }))
  } catch {
    return []
  }
}

export function saveTriggers(list: Trigger[]): void {
  localStorage.setItem(TRIGGERS_KEY, JSON.stringify(list))
}

export function loadHistory(): TriggerRun[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TriggerRun[]
  } catch {
    return []
  }
}

export function saveHistory(list: TriggerRun[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
}

export function loadTodayRuns(): number {
  try {
    const raw = localStorage.getItem(RUNS_KEY)
    if (!raw) return 0
    const data = JSON.parse(raw) as { date: string; count: number }
    return data.date === todayKey() ? Number(data.count) || 0 : 0
  } catch {
    return 0
  }
}

export function saveTodayRuns(count: number): void {
  localStorage.setItem(RUNS_KEY, JSON.stringify({ date: todayKey(), count }))
}

/** 计算“下次执行”的展示文案 */
export function nextRunLabel(t: Trigger, now = Date.now()): string {
  if (!t.enabled) return '已停用'
  if (t.kind === '手动触发') return '手动'
  if (t.kind === '定时触发') {
    const [h, m] = t.time.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return t.time
    const current = new Date(now)
    const next = new Date(current)
    next.setHours(h, m, 0, 0)
    if (next.getTime() <= current.getTime()) next.setDate(next.getDate() + 1)
    const prefix = next.toDateString() === current.toDateString() ? '今天' : '明天'
    return `${prefix} ${t.time}`
  }
  const base = t.lastRunAt > 0 ? t.lastRunAt : now
  return new Date(base + t.interval * 1000).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export const useTriggerStore = defineStore('trigger', {
  state: () => ({
    triggers: [] as Trigger[],
    history: [] as TriggerRun[],
    todayRuns: 0,
  }),
  getters: {
    enabledCount: (state) => state.triggers.filter((t) => t.enabled).length,
  },
  actions: {
    load() {
      this.triggers = loadTriggers()
      this.history = loadHistory()
      this.todayRuns = loadTodayRuns()
    },
    persist() {
      saveTriggers(this.triggers)
    },
    persistHistory() {
      saveHistory(this.history)
    },
    /** 旧数据只有流程名，这里补上流程 ID */
    migrateFlowIds(flows: FlowMeta[]) {
      let changed = false
      this.triggers.forEach((t) => {
        if (t.flowId) return
        t.flowId = flows.find((f) => f.name === t.flow)?.id ?? ''
        changed = true
      })
      if (changed) this.persist()
    },
    add(t: Trigger) {
      this.triggers.push(t)
      this.persist()
    },
    update(id: string, patch: Partial<Trigger>) {
      const target = this.triggers.find((t) => t.id === id)
      if (!target) return
      Object.assign(target, patch)
      this.persist()
    },
    remove(id: string) {
      this.triggers = this.triggers.filter((t) => t.id !== id)
      this.persist()
    },
    record(run: TriggerRun) {
      this.history.unshift(run)
      if (this.history.length > HISTORY_LIMIT) this.history.length = HISTORY_LIMIT
      this.persistHistory()
      this.todayRuns += 1
      saveTodayRuns(this.todayRuns)
    },
    clearHistory() {
      this.history = []
      this.persistHistory()
    },
  },
})

/** 立即执行某个触发器关联的流程，并写入执行记录 */
export async function runTriggerNow(app: AppStore, t: Trigger): Promise<TriggerRun> {
  const meta = app.flows.find((f) => f.id === t.flowId) ?? app.flows.find((f) => f.name === t.flow)
  const time = Date.now()
  if (!meta) {
    app.log('error', `触发器「${t.name}」关联的流程不存在，已跳过`)
    return {
      id: newId('run_'),
      triggerId: t.id,
      triggerName: t.name,
      flowName: t.flow,
      time,
      ok: false,
      message: '关联流程不存在',
    }
  }
  await app.openFlow(meta.id)
  app.log('info', `触发器「${t.name}」已触发`)
  await app.run()
  const failed = app.logs.some((l) => l.level === 'error')
  return {
    id: newId('run_'),
    triggerId: t.id,
    triggerName: t.name,
    flowName: t.flow,
    time,
    ok: !failed,
    message: failed ? '执行失败，详见运行日志' : '执行完成',
  }
}

/**
 * 启动触发器调度器：应用开启期间每秒检查一次，
 * 定时触发在到点时执行、循环触发按间隔执行。
 * 返回停止函数。
 */
export function startScheduler(app: AppStore, triggerStore: TriggerStore): () => void {
  let stopped = false
  let busy = false

  const tick = async () => {
    if (stopped || busy || app.running) return
    busy = true
    try {
      const now = Date.now()
      const current = new Date(now)
      const hhmm = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`
      const due = triggerStore.triggers.filter((t) => {
        if (!t.enabled || t.kind === '手动触发') return false
        if (t.kind === '定时触发') return t.time === hhmm && now - t.lastRunAt >= 60_000
        const base = t.lastRunAt > 0 ? t.lastRunAt : now
        return now - base >= t.interval * 1000
      })
      if (due.length === 0) return
      const label = new Date(now).toLocaleString('zh-CN', { hour12: false })
      due.forEach((t) => {
        t.lastRun = label
        t.lastRunAt = now
      })
      triggerStore.persist()
      for (const t of due) {
        const run = await runTriggerNow(app, t)
        triggerStore.record(run)
      }
    } finally {
      busy = false
    }
  }

  const timer = setInterval(() => {
    void tick().catch((e: unknown) =>
      app.log('error', `触发器调度失败：${e instanceof Error ? e.message : String(e)}`),
    )
  }, 1000)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
