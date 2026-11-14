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
import { t, type MessageKey } from '../i18n'

/** 触发类型值（持久化数据）→ 显示文案 */
const KIND_KEYS: Record<string, MessageKey> = {
  定时触发: 'trigger.kindTimed',
  循环触发: 'trigger.kindLoop',
  手动触发: 'trigger.kindManual',
}
const kindLabel = (k: string) => t(KIND_KEYS[k] ?? 'trigger.kindManual')

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

function planText(item: Trigger): string {
  if (item.kind === '定时触发') return t('trigger.planDaily', { time: item.time })
  if (item.kind === '循环触发') return t('trigger.planInterval', { n: item.interval })
  return t('trigger.planManual')
}

function onKindChange(val: string | number | boolean | undefined) {
  const kind = val as TriggerKind
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

function openEdit(item: Trigger) {
  editingId.value = item.id
  form.name = item.name
  form.kind = item.kind
  form.flow = item.flow
  form.flowId = item.flowId
  form.time = item.time
  form.interval = item.interval
  view.value = 'form'
}

function saveTrigger() {
  const name = form.name.trim()
  if (!name) {
    toastWarning(t('trigger.nameRequired'), { title: t('common.nameEmpty') })
    return
  }
  if (!form.flowId) {
    toastWarning(t('trigger.flowRequired'), { title: t('trigger.flowNotSet') })
    return
  }
  if (form.kind === '定时触发' && !/^\d{2}:\d{2}$/.test(form.time)) {
    toastWarning(t('trigger.timeInvalid'), { title: t('trigger.timeBad') })
    return
  }
  if (form.kind === '循环触发' && !(form.interval > 0)) {
    toastWarning(t('trigger.intervalInvalid'), { title: t('trigger.intervalBad') })
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
    toastSuccess(t('trigger.updated'), { title: t('trigger.saveOk'), duration: 2200 })
  } else {
    triggerStore.add({
      id: createTriggerId(),
      ...patch,
      enabled: true,
      lastRun: '从未',
      lastRunAt: 0,
    })
    toastSuccess(t('trigger.created'), { title: t('trigger.createOk'), duration: 2200 })
  }
  view.value = ''
}

async function removeTrigger(item: Trigger) {
  try {
    await ElMessageBox.confirm(t('trigger.deleteConfirm', { name: item.name }), t('trigger.deleteTitle'), {
      type: 'warning',
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
    })
  } catch {
    return
  }
  triggerStore.remove(item.id)
  toastSuccess(t('trigger.deleted'), { title: t('trigger.deleteOk'), duration: 2000 })
}

async function runNow(item: Trigger) {
  if (store.running) {
    toastWarning(t('trigger.alreadyRunning'), { title: t('trigger.running') })
    return
  }
  if (!store.flows.some((f) => f.id === item.flowId)) {
    toastError(t('trigger.flowMissing'), { title: t('trigger.cannotRun') })
    return
  }
  const run = await runTriggerNow(store, item)
  triggerStore.record(run)
  if (run.ok) {
    toastSuccess(t('trigger.executed'), { title: t('trigger.runOk'), duration: 2200 })
  } else {
    toastError(t('trigger.runFailed', { msg: run.message }), { title: t('trigger.runFail') })
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

async function handleClearHistory() {
  if (!triggerStore.history.length) return
  try {
    await ElMessageBox.confirm(
      t('trigger.clearHistoryConfirm', { n: triggerStore.history.length }),
      t('trigger.clearHistory'),
      {
        type: 'warning',
        confirmButtonText: t('trigger.clear'),
        cancelButtonText: t('common.cancel'),
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
        <div class="page-kicker">{{ t('trigger.kicker') }}</div>
        <h1 class="page-title">{{ t('trigger.title') }}</h1>
        <p class="page-sub">{{ t('trigger.sub') }}</p>
      </div>
      <div class="page-actions">
        <el-button text @click="view = 'history'">
          <el-icon :size="15" style="margin-right: 4px"><Histogram /></el-icon>
          {{ t('trigger.history') }}
        </el-button>
        <el-button type="primary" @click="openCreate">
          <el-icon :size="15" style="margin-right: 4px"><Plus /></el-icon>
          {{ t('trigger.new') }}
        </el-button>
      </div>
    </div>

    <el-alert type="info" :closable="false" class="tip-alert"
      :title="t('trigger.alert')"
    />

    <div class="stat-row trigger-stats">
      <div class="stat-card">
        <div class="stat-value">{{ triggerStore.enabledCount }}</div>
        <div class="stat-label">{{ t('trigger.enabled') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ triggerStore.todayRuns }}</div>
        <div class="stat-label">{{ t('trigger.todayRuns') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ timedCount }}</div>
        <div class="stat-label">{{ t('trigger.statTimed') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ loopCount }}</div>
        <div class="stat-label">{{ t('trigger.statLoop') }}</div>
      </div>
    </div>

    <el-table :data="triggerStore.triggers" class="table">
      <el-table-column :label="t('trigger.colName')" prop="name" min-width="120" />
      <el-table-column :label="t('trigger.colType')" width="100">
        <template #default="{ row }">
          <el-tag :type="row.kind === '定时触发' ? 'success' : row.kind === '循环触发' ? 'warning' : 'info'" effect="light">
            {{ kindLabel(row.kind) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('trigger.colFlow')" prop="flow" min-width="140" />
      <el-table-column :label="t('trigger.colPlan')" width="120">
        <template #default="{ row }">{{ planText(row as Trigger) }}</template>
      </el-table-column>
      <el-table-column :label="t('trigger.colNext')" width="120">
        <template #default="{ row }">{{ nextRunLabel(row as Trigger, now) }}</template>
      </el-table-column>
      <el-table-column :label="t('trigger.colStatus')" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="row.enabled"
            @change="(val: string | number | boolean) => triggerStore.update((row as Trigger).id, { enabled: Boolean(val) })"
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('trigger.colLast')" prop="lastRun" width="160" />
      <el-table-column :label="t('trigger.colActions')" width="200">
        <template #default="{ row }">
          <el-button text type="primary" @click="runNow(row as Trigger)">
            <el-icon :size="13" style="margin-right: 4px"><VideoPlay /></el-icon>{{ t('trigger.runNow') }}
          </el-button>
          <el-button text @click="openEdit(row as Trigger)">
            <el-icon :size="13" style="margin-right: 4px"><Edit /></el-icon>{{ t('trigger.edit') }}
          </el-button>
          <el-button text type="danger" @click="removeTrigger(row as Trigger)">
            <el-icon :size="13" style="margin-right: 4px"><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="t('trigger.empty')" :image-size="72" />
      </template>
    </el-table>
    </template>

    <template v-else-if="view === 'form'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="closeForm">{{ t('trigger.back') }}</el-button>
      </div>
      <div class="form-card sec-card">
        <h2 class="form-title">{{ editingId ? t('trigger.editTitle') : t('trigger.newTitle') }}</h2>
        <el-form :model="form" label-width="92px">
          <el-form-item :label="t('trigger.labelName')">
            <el-input v-model="form.name" :placeholder="t('trigger.namePlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('trigger.labelKind')">
            <el-radio-group v-model="form.kind" @change="onKindChange">
              <el-radio-button value="定时触发">
                <el-icon :size="13" style="margin-right: 4px"><AlarmClock /></el-icon>{{ t('trigger.kindTimedShort') }}
              </el-radio-button>
              <el-radio-button value="循环触发">
                <el-icon :size="13" style="margin-right: 4px"><Connection /></el-icon>{{ t('trigger.kindLoopShort') }}
              </el-radio-button>
              <el-radio-button value="手动触发">
                <el-icon :size="13" style="margin-right: 4px"><Clock /></el-icon>{{ t('trigger.kindManualShort') }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="t('trigger.labelFlow')">
            <el-select v-model="form.flowId" :placeholder="t('trigger.flowPlaceholder')" style="width: 100%" @change="onFlowChange">
              <el-option v-for="f in store.flows" :key="f.id" :label="f.name" :value="f.id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.kind === '定时触发'" :label="t('trigger.labelTime')">
            <el-time-picker
              v-model="form.time"
              format="HH:mm"
              value-format="HH:mm"
              :placeholder="t('trigger.timePlaceholder')"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item v-if="form.kind === '循环触发'" :label="t('trigger.labelInterval')">
            <el-input-number v-model="form.interval" :min="1" :max="86400" :step="10" />
            <span class="form-hint">{{ t('trigger.seconds') }}</span>
          </el-form-item>
          <el-form-item v-if="form.kind === '手动触发'" :label="t('trigger.labelDesc')">
            <span class="form-hint">{{ t('trigger.manualHint') }}</span>
          </el-form-item>
        </el-form>
        <div class="form-actions">
          <el-button @click="closeForm">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="saveTrigger">{{ t('trigger.save') }}</el-button>
        </div>
      </div>
    </template>

    <template v-else-if="view === 'history'">
      <div class="detail-nav">
        <el-button text :icon="ArrowLeft" @click="view = ''">{{ t('trigger.back') }}</el-button>
      </div>
      <div class="history-card sec-card">
        <div class="history-head">
          <h2 class="form-title">{{ t('trigger.history') }}</h2>
          <div class="history-head-actions">
            <span class="sub">{{ t('trigger.historyCount', { n: triggerStore.history.length }) }}</span>
            <el-button text type="danger" :disabled="!triggerStore.history.length" @click="handleClearHistory">
              {{ t('trigger.clearHistory') }}
            </el-button>
          </div>
        </div>
        <el-table :data="triggerStore.history" max-height="480">
          <el-table-column :label="t('trigger.colTime')" width="170">
            <template #default="{ row }">{{ formatTime(row.time) }}</template>
          </el-table-column>
          <el-table-column :label="t('trigger.colTrigger')" prop="triggerName" min-width="120" />
          <el-table-column :label="t('trigger.colFlowName')" prop="flowName" min-width="120" />
          <el-table-column :label="t('trigger.colResult')" width="90">
            <template #default="{ row }">
              <el-tag :type="row.ok ? 'success' : 'danger'" effect="light">
                {{ row.ok ? t('trigger.success') : t('trigger.fail') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('trigger.colMessage')" prop="message" min-width="140" />
          <template #empty>
            <el-empty :description="t('trigger.emptyHistory')" :image-size="72" />
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
  margin-left: 12px;
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
