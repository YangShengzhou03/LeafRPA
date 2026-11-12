<script setup lang="ts">
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAppStore, type ThemeMode } from '../store'
import { useTriggerStore } from '../triggers'
import { installedApps } from '../installedApps'
import { copyText } from '../clipboard'
import { toastError, toastSuccess } from '../notify'
import PageShell from '../components/PageShell.vue'

const store = useAppStore()
const triggerStore = useTriggerStore()
const REPO_URL = 'https://gitee.com/Yangshengzhou/leaf-rpa'

type SectionKey = 'appearance' | 'data' | 'about' | 'danger'

const sections: { key: SectionKey; label: string }[] = [
  { key: 'appearance', label: '外观模式' },
  { key: 'data', label: '数据与存储' },
  { key: 'about', label: '关于' },
  { key: 'danger', label: '危险操作' },
]

const themes: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

/* ---------- 左侧锚点目录：点击滚动定位 + 滚动跟随高亮 ---------- */
const active = ref<SectionKey>('appearance')
const rootEl = ref<HTMLElement | null>(null)
const sectionEls = new Map<SectionKey, HTMLElement>()
let scrollBox: HTMLElement | null = null
let spyLock = false

function setSectionRef(key: SectionKey) {
  return (el: unknown) => {
    if (el) sectionEls.set(key, el as HTMLElement)
    else sectionEls.delete(key)
  }
}

function scrollToSection(key: SectionKey) {
  const el = sectionEls.get(key)
  if (!el) return
  spyLock = true
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  active.value = key
  window.setTimeout(() => (spyLock = false), 500)
}

function onScroll() {
  if (spyLock) return
  const boxTop = scrollBox?.getBoundingClientRect().top ?? 0
  let current: SectionKey = 'appearance'
  for (const { key } of sections) {
    const el = sectionEls.get(key)
    if (el && el.getBoundingClientRect().top - boxTop <= 80) current = key
  }
  active.value = current
}

onMounted(() => {
  // 页面滚动容器为本页所在的 .page 内容区（多页签共存，需取最近祖先）
  scrollBox = rootEl.value?.closest('.page') as HTMLElement | null
  const target: HTMLElement | Window = scrollBox ?? window
  target.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  const target: HTMLElement | Window = scrollBox ?? window
  target.removeEventListener('scroll', onScroll)
})

/* ---------- 主题切换 ---------- */

async function copyRepo() {
  if (await copyText(REPO_URL)) toastSuccess('仓库地址已复制')
  else toastError('复制失败，请手动复制')
}

async function clearAll() {
  try {
    await ElMessageBox.confirm(
      '将删除本机保存的全部流程、触发器、市场应用与教程进度，且无法恢复。确定继续吗？',
      '清空全部数据',
      { type: 'warning', confirmButtonText: '全部删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await store.clearAllData()
    triggerStore.load()
    toastSuccess('已清空全部数据')
  } catch (err) {
    toastError(`清空失败：${err instanceof Error ? err.message : String(err)}`)
  }
}
</script>

<template>
  <PageShell title="设置" kicker="应用偏好" sub="管理外观、数据存储与账号信息">
    <div ref="rootEl" class="set-layout">
      <nav class="set-nav">
        <button
          v-for="s in sections"
          :key="s.key"
          class="set-nav-item"
          :class="{ active: active === s.key }"
          @click="scrollToSection(s.key)"
        >
          {{ s.label }}
        </button>
      </nav>

      <div class="set-content">
        <section :ref="setSectionRef('appearance')" class="sec-card set-section">
          <h2 class="sec-title">外观模式</h2>
          <el-radio-group
            class="theme-group"
            :model-value="store.themeMode"
            @change="(v: string | number | boolean) => store.setThemeMode(v as ThemeMode)"
          >
            <el-radio-button v-for="t in themes" :key="t.value" :value="t.value">
              {{ t.label }}
            </el-radio-button>
          </el-radio-group>
          <p class="sec-meta set-hint">选择「跟随系统」后，应用会随操作系统外观自动切换。</p>
        </section>

        <section :ref="setSectionRef('data')" class="sec-card set-section">
          <h2 class="sec-title">数据与存储</h2>
          <div class="sec-rows">
            <div class="sec-row">
              <span class="sec-row-label">数据位置</span>
              <span class="sec-row-value set-ellipsis" :title="store.dataDir">
                {{ store.dataDir || '未加载' }}
              </span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">已保存流程</span>
              <span class="sec-row-value">{{ store.flows.length }} 个</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">触发器</span>
              <span class="sec-row-value">{{ triggerStore.triggers.length }} 个</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">已安装应用</span>
              <span class="sec-row-value">{{ installedApps.size }} 个</span>
            </div>
          </div>
        </section>

        <section :ref="setSectionRef('about')" class="sec-card set-section">
          <h2 class="sec-title">关于</h2>
          <div class="sec-rows">
            <div class="sec-row">
              <span class="sec-row-label">版本</span>
              <span class="sec-row-value">轻羽 RPA v0.1.0</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">开源仓库</span>
              <span class="sec-row-value">
                <span class="set-ellipsis">{{ REPO_URL }}</span>
                <el-button link type="primary" @click="copyRepo">复制地址</el-button>
              </span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">反馈方式</span>
              <span class="sec-row-value">通过开源仓库 Issues 提交问题与建议</span>
            </div>
          </div>
        </section>

        <section :ref="setSectionRef('danger')" class="sec-card set-danger set-section">
          <h2 class="sec-title">危险操作</h2>
          <div class="set-danger-body">
            <p class="sec-meta">删除本机保存的全部流程、触发器与偏好，操作后无法恢复。</p>
            <el-button type="danger" plain @click="clearAll">清空全部数据</el-button>
          </div>
        </section>
      </div>
    </div>
  </PageShell>
</template>

<style scoped>
.set-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

/* 目录固定，右侧内容随页面滚动，目录仅作锚点定位 */
.set-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 16px;
}

.set-nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-2);
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.set-nav-item:hover {
  background: var(--panel);
  color: var(--text);
}

.set-nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}

.set-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.set-section {
  scroll-margin-top: 16px;
}

/* 主题分段控件：Element Plus 默认样式 */
.theme-group {
  margin-top: 14px;
}

.set-hint {
  margin: 12px 0 0;
}

.set-danger-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
}

.set-danger-body .sec-meta {
  margin: 0;
}

.set-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
