<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import {
  AlarmClock,
  ArrowLeft,
  Clock,
  Connection,
  Delete,
  Edit,
  Histogram,
  Plus,
  VideoPlay,
} from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import {
  createTriggerId,
  nextRunLabel,
  runTriggerNow,
  useTriggerStore,
  type Trigger,
  type TriggerKind,
} from '../triggers'
import { toastError, toastSuccess, toastWarning } from '../notify'

type TriggerView = '' | 'form' | 'history'

const store = useAppStore()
const triggerStore = useTriggerStore()

const now = ref(Date.now())
const view = ref<TriggerView>('')
const editingId = ref('')
const form = reactive({
  name: '',
  kind: '定时触发' as TriggerKind,
  flow: '',
  flowId: '',
  time: '09:00',
  interval: 60,
})

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  triggerStore.load()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const timedCount = computed(() => triggerStore.triggers.filter((t) => t.kind === '定时触发').length)
const loopCount = computed(() => triggerStore.triggers.filter((t) => t.kind === '循环触发').length)

function planText(t: Trigger): string {
  if (t.kind === '定时触发') return `每天 ${t.time}`
  if (t.kind === '循环触发') return `每 ${t.interval} 秒`
  return '手动执行'
}

function onKindChange(kind: TriggerKind) {
  if (kind === '定时触发') form.time = form.time || '09:00'
  if (kind === '循环触发') form.interval = form.interval > 0 ? form.interval : 60
}

function onFlowChange(id: string) {
  const meta = store.flows.find((f) => f.id === id)
  form.flowId = id
  form.flow = meta?.name ?? ''
}

function resetForm() {
  form.name = ''
  form.kind = '定时触发'
  form.flow = ''
  form.flowId = ''
  form.time = '09:00'
  form.interval = 60
  editingId.value = ''
}

function openCreate() {
  resetForm()
  view.value = 'form'
}

function closeForm() {
  view.value = ''
}

function openEdit(t: Trigger) {
  editingId.value = t.id
  form.name = t.name
  form.kind = t.kind
  form.flow = t.flow
  form.flowId = t.flowId
  form.time = t.time
  form.interval = t.interval
  view.value = 'form'
}

function saveTrigger() {
  const name = form.name.trim()
  if (!name) {
    toastWarning('请输入触发器名称', { title: '名称为空' })
    return
  }
  if (!form.flowId) {
    toastWarning('请选择关联流程', { title: '未关联流程' })
    return
  }
  if (form.kind === '定时触发' && !/^\d{2}:\d{2}$/.test(form.time)) {
    toastWarning('请填写有效的执行时间', { title: '时间格式不正确' })
    return
  }
  if (form.kind === '循环触发' && !(form.interval > 0)) {
    toastWarning('循环间隔必须大于 0', { title: '间隔无效' })
    return
  }
  const patch = {
    name,
    kind: form.kind,
    flow: form.flow,
    flowId: form.flowId,
    time: form.time,
    interval: Number(form.interval),
  }
  if (editingId.value) {
    triggerStore.update(editingId.value, patch)
    toastSuccess('触发器已更新', { title: '保存成功', duration: 2200 })
  } else {
    triggerStore.add({
      id: createTriggerId(),
      ...patch,
      enabled: true,
      lastRun: '从未',
      lastRunAt: 0,
    })
    toastSuccess('触发器已创建', { title: '创建成功', duration: 2200 })
  }
  view.value = ''
}

async function removeTrigger(t: Trigger) {
  try {
    await ElMessageBox.confirm(`确定删除「${t.name}」吗？`, '删除触发器', { type: 'warning' })
  } catch {
    return
  }
  triggerStore.remove(t.id)
  toastSuccess('触发器已删除', { title: '删除成功', duration: 2000 })
}

async function runNow(t: Trigger) {
  if (store.running) {
    toastWarning('已有流程正在运行，请稍后再试', { title: '流程运行中' })
    return
  }
  if (!store.flows.some((f) => f.id === t.flowId)) {
    toastError('关联流程不存在，请重新选择', { title: '无法执行' })
    return
  }
  const run = await runTriggerNow(store, t)
  triggerStore.record(run)
  if (run.ok) {
    toastSuccess('触发器已执行', { title: '执行成功', duration: 2200 })
  } else {
    toastError(`触发失败：${run.message}`, { title: '执行失败' })
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

async function handleClearHistory() {
  if (!triggerStore.history.length) return
  try {
    await ElMessageBox.confirm(
      `确定清空全部 ${triggerStore.history.length} 条触发历史记录？此操作不可恢复。`,
      '清空记录',
      {
        type: 'warning',
        confirmButtonText: '清空',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }
  triggerStore.clearHistory()
}
</script>

<template>
  <section class="page">
    <template v-if="!view">
    <div class="page-head">
      <div class="page-head-main">
        <div class="page-kicker">自动化调度</div>
        <h1 class="page-title">触发器</h1>
        <p class="page-sub">定时、循环触发会在应用开启期间自动执行关联流程</p>
      </div>
      <div class="page-actions">
        <el-button text @click="view = 'history'">
          <el-icon :size="15" style="margin-right: 4px"><Histogram /></el-icon>
          执行记录
        </el-button>
        <el-button type="primary" @click="openCreate">
          <el-icon :size="15" style="margin-right: 4px"><Plus /></el-icon>
          新增触发器
        </el-button>
      </div>
    </div>

    <el-alert type="info" :closable="false" class="tip-alert"
      title="定时与循环触发由应用在前台运行时实时调度，关闭应用后不会触发。"
    />

    <div class="stat-row trigger-stats">
      <div class="stat-card">
        <div class="stat-value">{{ triggerStore.enabledCount }}</div>
        <div class="stat-label">启用中</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ triggerStore.todayRuns }}</div>
        <div class="stat-label">今日执行</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ timedCount }}</div>
        <div class="stat-label">定时触发</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ loopCount }}</div>
        <div class="stat-label">循环触发</div>
      </div>
    </div>

    <el-table :data="triggerStore.triggers" class="table">
      <el-table-column label="名称" prop="name" min-width="120" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.kind === '定时触发' ? 'success' : row.kind === '循环触发' ? 'warning' : 'info'" effect="light">
            {{ row.kind }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="关联流程" prop="flow" min-width="140" />
      <el-table-column label="执行计划" width="120">
        <template #default="{ row }">{{ planText(row) }}</template>
      </el-table-column>
      <el-table-column label="下次执行" width="120">
        <template #default="{ row }">{{ nextRunLabel(row, now) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="row.enabled"
            @change="(val: boolean) => triggerStore.update(row.id, { enabled: val })"
          />
        </template>
      </el-table-column>
      <el-table-column label="最近执行" prop="lastRun" width="160" />
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button text type="primary" @click="runNow(row)">
            <el-icon :size="13" style="margin-right: 3px"><VideoPlay /></el-icon>立即运行
          </el-button>
          <el-button text @click="openEdit(row)">
            <el-icon :size="13" style="margin-right: 3px"><Edit /></el-icon>编辑
          </el-button>
          <el-button text type="danger" @click="removeTrigger(row)">
            <el-icon :size="13" style="margin-right: 3px"><Delete /></el-icon>删除
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="还没有触发器，点击「新增触发器」创建" :image-size="72" />
      </template>
    </el-table>
    </template>

    <template v-else-if="view === 'form'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="closeForm">返回触发器</el-button>
      </div>
      <div class="form-card sec-card">
        <h2 class="form-title">{{ editingId ? '编辑触发器' : '新增触发器' }}</h2>
        <el-form :model="form" label-width="92px">
          <el-form-item label="名称">
            <el-input v-model="form.name" placeholder="输入触发器名称" />
          </el-form-item>
          <el-form-item label="类型">
            <el-radio-group v-model="form.kind" @change="onKindChange">
              <el-radio-button value="定时触发">
                <el-icon :size="13" style="margin-right: 3px"><AlarmClock /></el-icon>定时
              </el-radio-button>
              <el-radio-button value="循环触发">
                <el-icon :size="13" style="margin-right: 3px"><Connection /></el-icon>循环
              </el-radio-button>
              <el-radio-button value="手动触发">
                <el-icon :size="13" style="margin-right: 3px"><Clock /></el-icon>手动
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="关联流程">
            <el-select v-model="form.flowId" placeholder="选择要执行的应用" style="width: 100%" @change="onFlowChange">
              <el-option v-for="f in store.flows" :key="f.id" :label="f.name" :value="f.id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.kind === '定时触发'" label="执行时间">
            <el-time-picker
              v-model="form.time"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择每天执行的时间"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item v-if="form.kind === '循环触发'" label="循环间隔">
            <el-input-number v-model="form.interval" :min="1" :max="86400" :step="10" />
            <span class="form-hint">秒</span>
          </el-form-item>
          <el-form-item v-if="form.kind === '手动触发'" label="说明">
            <span class="form-hint">手动触发不会自动执行，只能在触发器列表点击「立即运行」。</span>
          </el-form-item>
        </el-form>
        <div class="form-actions">
          <el-button @click="closeForm">取消</el-button>
          <el-button type="primary" @click="saveTrigger">保存</el-button>
        </div>
      </div>
    </template>

    <template v-else-if="view === 'history'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="view = ''">返回触发器</el-button>
      </div>
      <div class="history-card sec-card">
        <div class="history-head">
          <h2 class="form-title">执行记录</h2>
          <div class="history-head-actions">
            <span class="sub">共 {{ triggerStore.history.length }} 条，最多保留 100 条</span>
            <el-button text type="danger" :disabled="!triggerStore.history.length" @click="handleClearHistory">
              清空记录
            </el-button>
          </div>
        </div>
        <el-table :data="triggerStore.history" max-height="480">
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ formatTime(row.time) }}</template>
          </el-table-column>
          <el-table-column label="触发器" prop="triggerName" min-width="120" />
          <el-table-column label="流程" prop="flowName" min-width="120" />
          <el-table-column label="结果" width="90">
            <template #default="{ row }">
              <el-tag :type="row.ok ? 'success' : 'danger'" effect="light">
                {{ row.ok ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="说明" prop="message" min-width="140" />
          <template #empty>
            <el-empty description="暂无执行记录" :image-size="72" />
          </template>
        </el-table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.sub {
  font-size: 13px;
  color: var(--text-2);
}

/* ---- 提示与统计 ---- */
.tip-alert {
  margin-bottom: 16px;
}

.trigger-stats {
  grid-template-columns: repeat(4, 1fr);
}

/* ---- 触发器列表 ---- */
.table {
  width: 100%;
}

/* ---- 表单 / 执行记录 ---- */
.form-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--text-3);
}

.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-head .form-title {
  margin: 0;
}

.history-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
