<script setup lang="ts">
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { ArrowRight, Link, QuestionFilled, Service } from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import { copyText } from '../clipboard'
import { toastSuccess, toastWarning } from '../notify'
import PageShell from '../components/PageShell.vue'
import * as bridge from '../bridge'

const store = useAppStore()
const REPO_URL = 'https://gitee.com/Yangshengzhou/leaf-rpa'

const code = ref('print("hello from leaf rpa")')
const running = ref(false)
const outputs = ref<{ ok: boolean; text: string }[]>([])

const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function runCode() {
  const source = code.value.trim()
  if (!source) {
    toastWarning('请输入要执行的 Python 代码')
    return
  }
  running.value = true
  try {
    const res = await bridge.runPythonCode(source, {})
    outputs.value.unshift({
      ok: res.ok,
      text: res.ok
        ? (res.logs || res.result != null ? String(res.logs ?? JSON.stringify(res.result)) : '执行完成，无输出')
        : `执行失败：${res.error ?? '未知错误'}`,
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
  if (await copyText(store.dataDir)) toastSuccess('数据目录已复制')
  else toastWarning('复制失败，请手动复制')
}

async function openRepo() {
  await bridge.openInBrowser(REPO_URL)
}

async function clearCache() {
  try {
    await ElMessageBox.confirm(
      '将清除浏览器本地缓存的界面偏好（主题、消息、邀请记录等），流程数据不受影响。',
      '清除本地缓存',
      { type: 'warning', confirmButtonText: '清除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  const preserved = localStorage.getItem('leaf-rpa.theme')
  Object.keys(localStorage)
    .filter((k) => k.startsWith('leaf-rpa.') && k !== 'leaf-rpa.theme')
    .forEach((k) => localStorage.removeItem(k))
  if (preserved) localStorage.setItem('leaf-rpa.theme', preserved)
  toastSuccess('本地缓存已清除')
  store.goHome()
}

const shortcuts = [
  { key: 'Ctrl + Z', desc: '撤销上一步操作' },
  { key: 'Ctrl + Shift + Z', desc: '重做' },
  { key: 'Delete', desc: '删除选中的步骤' },
  { key: 'Space', desc: '运行 / 停止当前流程' },
  { key: 'Ctrl + S', desc: '立即保存流程' },
]
</script>

<template>
  <PageShell title="工具" kicker="效率工具" sub="实用小工具与开发者选项">
    <div class="tools-layout">
      <div class="tools-main">
        <section class="sec-card">
          <div class="sec-card-head">
            <h2 class="sec-title">Python 代码运行器</h2>
            <el-tag v-if="!hasTauri" type="warning" effect="plain">
              浏览器环境不可用
            </el-tag>
          </div>
          <el-input
            v-model="code"
            type="textarea"
            :rows="5"
            placeholder="输入 Python 代码，例如：print(sum(range(10)))"
            class="tool-input"
          />
          <div class="tool-actions">
            <el-button @click="outputs = []" :disabled="!outputs.length">清空输出</el-button>
            <el-button type="primary" :loading="running" :disabled="!hasTauri" @click="runCode">
              运行代码
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
            代码会在你本机的系统 Python 中执行，请注意不要运行来源不明的脚本。
          </p>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">数据管理</h2>
          <div class="sec-rows data-rows">
            <div class="sec-row">
              <div class="data-body">
                <div class="data-name">数据目录</div>
                <div class="data-desc" :title="store.dataDir">{{ store.dataDir || '未加载' }}</div>
              </div>
              <el-button plain @click="copyDataDir">复制路径</el-button>
            </div>
            <div class="sec-row">
              <div class="data-body">
                <div class="data-name">已保存流程</div>
                <div class="data-desc">共 {{ store.flows.length }} 个流程</div>
              </div>
              <el-button plain @click="store.goHome()">查看</el-button>
            </div>
            <div class="sec-row">
              <div class="data-body">
                <div class="data-name">本地缓存</div>
                <div class="data-desc">主题、消息、邀请记录等界面偏好</div>
              </div>
              <el-button plain type="danger" @click="clearCache">清除缓存</el-button>
            </div>
          </div>
        </section>
      </div>

      <aside class="tools-side">
        <section class="sec-card">
          <h2 class="sec-title">快捷操作</h2>
          <div class="quick-list">
            <el-button class="quick-item" @click="openRepo">
              <span class="quick-ico"><el-icon :size="15"><Link /></el-icon></span>
              <span class="quick-texts">
                <span class="quick-label">打开开源仓库</span>
                <span class="quick-desc">查看源码与提交 Issue</span>
              </span>
              <el-icon class="quick-arrow" :size="14"><ArrowRight /></el-icon>
            </el-button>
            <el-button class="quick-item" @click="store.navigate('service')">
              <span class="quick-ico"><el-icon :size="15"><Service /></el-icon></span>
              <span class="quick-texts">
                <span class="quick-label">联系客服</span>
                <span class="quick-desc">获取帮助与反馈问题</span>
              </span>
              <el-icon class="quick-arrow" :size="14"><ArrowRight /></el-icon>
            </el-button>
            <el-button class="quick-item" @click="store.navigate('help')">
              <span class="quick-ico"><el-icon :size="15"><QuestionFilled /></el-icon></span>
              <span class="quick-texts">
                <span class="quick-label">帮助中心</span>
                <span class="quick-desc">查看常见问题</span>
              </span>
              <el-icon class="quick-arrow" :size="14"><ArrowRight /></el-icon>
            </el-button>
          </div>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">快捷键</h2>
          <div class="keys">
            <div v-for="s in shortcuts" :key="s.key" class="key-row">
              <el-tag effect="plain" class="key-tag">{{ s.key }}</el-tag>
              <span class="key-desc">{{ s.desc }}</span>
            </div>
          </div>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">关于</h2>
          <div class="sec-rows">
            <div class="sec-row">
              <span class="sec-row-label">版本</span>
              <span class="sec-row-value">v0.1.0</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">运行环境</span>
              <span class="sec-row-value">{{ hasTauri ? 'Tauri 桌面端' : '浏览器预览' }}</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">数据存储</span>
              <span class="sec-row-value">本机 localForage / localStorage</span>
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
  margin-top: 14px;
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
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.output-line:last-child {
  border-bottom: none;
}

.output-index {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
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
  padding: 10px 12px;
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
  gap: 10px;
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
