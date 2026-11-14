<script setup lang="ts">
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAppStore } from '../store'
import { copyText } from '../clipboard'
import { toastSuccess, toastWarning } from '../notify'
import PageShell from '../components/PageShell.vue'
import * as bridge from '../bridge'
import { t, type MessageKey } from '../i18n'

const store = useAppStore()

const code = ref('print("hello from leaf rpa")')
const running = ref(false)
const outputs = ref<{ ok: boolean; text: string }[]>([])

const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function runCode() {
  const source = code.value.trim()
  if (!source) {
    toastWarning(t('tools.codeRequired'))
    return
  }
  running.value = true
  try {
    const res = await bridge.runPythonCode(source, {})
    outputs.value.unshift({
      ok: res.ok,
      text: res.ok
        ? (res.logs || res.result != null ? String(res.logs ?? JSON.stringify(res.result)) : t('tools.noOutput'))
        : t('tools.runFailed', { err: res.error ?? t('tools.unknownError') }),
    })
  } catch (err) {
    outputs.value.unshift({
      ok: false,
      text: err instanceof Error ? err.message : String(err),
    })
  } finally {
    running.value = false
  }
}

async function copyDataDir() {
  if (await copyText(store.dataDir)) toastSuccess(t('tools.dirCopied'))
  else toastWarning(t('common.copyFailed'))
}

async function clearCache() {
  try {
    await ElMessageBox.confirm(
      t('tools.cacheConfirm'),
      t('tools.cacheTitle'),
      { type: 'warning', confirmButtonText: t('tools.clear'), cancelButtonText: t('common.cancel') },
    )
  } catch {
    return
  }
  const preserved = localStorage.getItem('leaf-rpa.theme')
  Object.keys(localStorage)
    .filter((k) => k.startsWith('leaf-rpa.') && k !== 'leaf-rpa.theme')
    .forEach((k) => localStorage.removeItem(k))
  if (preserved) localStorage.setItem('leaf-rpa.theme', preserved)
  toastSuccess(t('tools.cacheCleared'))
  store.goHome()
}

const shortcuts: { key: string; desc: MessageKey }[] = [
  { key: 'Ctrl + Z', desc: 'tools.keyUndo' },
  { key: 'Ctrl + Shift + Z', desc: 'tools.keyRedo' },
  { key: 'Delete', desc: 'tools.keyDelete' },
  { key: 'Space', desc: 'tools.keyRun' },
  { key: 'Ctrl + S', desc: 'tools.keySave' },
]
</script>

<template>
  <PageShell :title="t('tools.title')" :kicker="t('tools.kicker')" :sub="t('tools.sub')">
    <div class="tools-layout">
      <div class="tools-main">
        <section class="sec-card">
          <div class="sec-card-head">
            <h2 class="sec-title">{{ t('tools.pythonTitle') }}</h2>
            <el-tag v-if="!hasTauri" type="warning" effect="plain">
              {{ t('tools.noBrowser') }}
            </el-tag>
          </div>
          <el-input
            v-model="code"
            type="textarea"
            :rows="5"
            :placeholder="t('tools.codePlaceholder')"
            class="tool-input"
          />
          <div class="tool-actions">
            <el-button @click="outputs = []" :disabled="!outputs.length">{{ t('tools.clearOutput') }}</el-button>
            <el-button type="primary" :loading="running" :disabled="!hasTauri" @click="runCode">
              {{ t('tools.runCode') }}
            </el-button>
          </div>
          <div v-if="outputs.length" class="tool-output">
            <div
              v-for="(o, i) in outputs"
              :key="i"
              class="output-line"
              :class="{ error: !o.ok }"
            >
              <span class="output-index">{{ outputs.length - i }}</span>
              <pre class="output-text">{{ o.text }}</pre>
            </div>
          </div>
          <p v-else-if="hasTauri" class="tool-note">
            {{ t('tools.pythonNote') }}
          </p>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">{{ t('tools.dataTitle') }}</h2>
          <div class="sec-rows data-rows">
            <div class="sec-row">
              <div class="data-body">
                <div class="data-name">{{ t('tools.dataDir') }}</div>
                <div class="data-desc" :title="store.dataDir">{{ store.dataDir || t('settings.data.notLoaded') }}</div>
              </div>
              <el-button plain @click="copyDataDir">{{ t('tools.copyPath') }}</el-button>
            </div>
            <div class="sec-row">
              <div class="data-body">
                <div class="data-name">{{ t('settings.data.flows') }}</div>
                <div class="data-desc">{{ t('tools.flowsCount', { n: store.flows.length }) }}</div>
              </div>
              <el-button plain @click="store.goHome()">{{ t('tools.view') }}</el-button>
            </div>
            <div class="sec-row">
              <div class="data-body">
                <div class="data-name">{{ t('tools.cache') }}</div>
                <div class="data-desc">{{ t('tools.cacheDesc') }}</div>
              </div>
              <el-button plain type="danger" @click="clearCache">{{ t('tools.clearCache') }}</el-button>
            </div>
          </div>
        </section>
      </div>

      <aside class="tools-side">
        <section class="sec-card">
          <h2 class="sec-title">{{ t('tools.shortcuts') }}</h2>
          <div class="keys">
            <div v-for="s in shortcuts" :key="s.key" class="key-row">
              <el-tag effect="plain" class="key-tag">{{ s.key }}</el-tag>
              <span class="key-desc">{{ t(s.desc) }}</span>
            </div>
          </div>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">{{ t('tools.about') }}</h2>
          <div class="sec-rows">
            <div class="sec-row">
              <span class="sec-row-label">{{ t('settings.about.version') }}</span>
              <span class="sec-row-value">v0.1.0</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">{{ t('tools.runtime') }}</span>
              <span class="sec-row-value">{{ hasTauri ? t('tools.tauri') : t('tools.browser') }}</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">{{ t('tools.storage') }}</span>
              <span class="sec-row-value">{{ t('tools.storageValue') }}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </PageShell>
</template>

<style scoped>
.tools-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.tools-main,
.tools-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.tool-input {
  margin-top: 16px;
}

.tool-input :deep(textarea) {
  font-family: 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 12px;
}

.tool-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.tool-output {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  max-height: 220px;
  overflow-y: auto;
}

.output-line {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.output-line:last-child {
  border-bottom: none;
}

.output-index {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.output-text {
  margin: 0;
  font-family: 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text);
}

.output-line.error .output-text {
  color: var(--accent);
}

.tool-note {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--panel);
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
}

.data-rows {
  margin-top: 8px;
}

.data-body {
  flex: 1;
  min-width: 0;
}

.data-name {
  font-size: 13px;
  color: var(--text);
}

.data-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keys {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}

.key-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  border-top: 1px solid var(--border);
}

.key-row:first-child {
  border-top: none;
}

.key-tag {
  min-width: 116px;
  justify-content: center;
  font-family: 'Cascadia Code', Consolas, monospace;
}

.key-desc {
  font-size: 12px;
  color: var(--text-2);
}
</style>
