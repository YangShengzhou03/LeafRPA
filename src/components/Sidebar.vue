<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import {
  Plus, InfoFilled, Monitor, Iphone, Grid,
  CaretBottom, Connection, Upload, Document, Delete, ArrowRight,
} from '@element-plus/icons-vue'
import { useAppStore } from '../store'
import { serverApps } from '../marketApps'
import { installedApps } from '../installedApps'
import { t } from '../i18n'

const store = useAppStore()
const menuVisible = ref(false)

function onCreateMove(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  el.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
const appsOpen = ref(true)
const instructionsOpen = ref(true)
const acquiredOpen = ref(false)

const apps = computed(() => store.flows.filter((f) => f.type !== 'instruction'))
const instructions = computed(() => store.flows.filter((f) => f.type === 'instruction'))
const acquiredApps = computed(() => serverApps.value.filter((a) => installedApps.value.has(a.id)))
const appName = computed(() => t('sidebar.untitledApp', { n: store.flows.length + 1 }))

const goMarket = () => store.setTab('market')

const create = (type: 'pc' | 'mobile' | 'instruction') => {
  menuVisible.value = false
  store.createAndOpen(appName.value, type)
}

const confirmDelete = async (e: MouseEvent, id: string) => {
  e.stopPropagation()
  try {
    await ElMessageBox.confirm(t('sidebar.deleteConfirm'), t('sidebar.deleteTitle'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })
    store.removeFlow(id)
  } catch {
    /* 已取消 */
  }
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-scroll">
      <el-popover
        v-model:visible="menuVisible"
        placement="bottom-start"
        :width="236"
        trigger="click"
        :show-arrow="false"
        popper-class="create-popover"
      >
        <template #reference>
          <button
            class="create-btn"
            :class="{ open: menuVisible }"
            @mousemove="onCreateMove"
          >
            <el-icon :size="15"><Plus /></el-icon>
            {{ t('sidebar.new') }}
          </button>
        </template>

        <div class="create-menu">
          <div class="menu-group">
            <div class="menu-group-title">
              {{ t('sidebar.groupApps') }}
              <el-tooltip :content="t('sidebar.whatApps')" placement="right">
                <button class="info-btn"><el-icon :size="12"><InfoFilled /></el-icon></button>
              </el-tooltip>
            </div>
            <button class="menu-item" @click="create('pc')">
              <span class="menu-icon" style="background: #fdecec; color: #f53f3f"><el-icon :size="13"><Monitor /></el-icon></span>
              {{ t('sidebar.createPc') }}
            </button>
            <button class="menu-item" @click="create('mobile')">
              <span class="menu-icon" style="background: #ecf2ff; color: #3b6fe0"><el-icon :size="13"><Iphone /></el-icon></span>
              {{ t('sidebar.createMobile') }}
            </button>
          </div>

          <div class="menu-group">
            <div class="menu-group-title">
              {{ t('sidebar.groupInstructions') }}
              <el-tooltip :content="t('sidebar.whatInstructions')" placement="right">
                <button class="info-btn"><el-icon :size="12"><InfoFilled /></el-icon></button>
              </el-tooltip>
            </div>
            <button class="menu-item" @click="create('instruction')">
              <span class="menu-icon" style="background: #ecf2ff; color: #3b6fe0"><el-icon :size="13"><Monitor /></el-icon></span>
              {{ t('sidebar.groupInstructions') }}
            </button>
          </div>
        </div>
      </el-popover>

      <div class="side-section">
        <div class="side-title">{{ t('sidebar.myApps') }}</div>
        <div class="collapse-head" :class="{ selected: store.view === 'apps' }">
          <span class="head-main" role="button" tabindex="0" @click="store.showApps()" @keydown.enter="store.showApps()">
            <el-icon :size="15" class="row-icon"><Grid /></el-icon>
            <span class="collapse-name">{{ t('sidebar.myDeveloped') }}</span>
            <span class="count">{{ apps.length }}</span>
          </span>
          <el-tooltip :content="t('sidebar.toggle')" placement="right" :show-after="300">
            <button class="chev-btn" @click.stop="appsOpen = !appsOpen">
              <el-icon :size="13" class="chev" :class="{ rotated: !appsOpen }"><CaretBottom /></el-icon>
            </button>
          </el-tooltip>
        </div>
        <div v-if="appsOpen" class="collapse-body">
          <div
            v-for="app in apps"
            :key="app.id"
            class="flow-item"
            role="button"
            tabindex="0"
            :class="{ active: store.current?.id === app.id && store.view === 'designer' }"
            @click="store.openFlow(app.id)"
            @keydown.enter="store.openFlow(app.id)"
          >
            <span class="thumb"><el-icon :size="12"><Connection /></el-icon></span>
            <span class="name" :title="app.name">{{ app.name }}</span>
            <el-tooltip :content="t('common.delete')" placement="right" :show-after="300">
              <button class="del" @click="confirmDelete($event, app.id)">
                <el-icon :size="12"><Delete /></el-icon>
              </button>
            </el-tooltip>
          </div>
        </div>
        <div class="collapse-head" role="button" tabindex="0" @click="acquiredOpen = !acquiredOpen" @keydown.enter="acquiredOpen = !acquiredOpen">
          <el-icon :size="15" class="row-icon"><Upload /></el-icon>
          <span class="collapse-name">{{ t('sidebar.acquired') }}</span>
          <span class="count">{{ acquiredApps.length }}</span>
          <el-icon :size="13" class="chev" :class="{ rotated: !acquiredOpen }"><CaretBottom /></el-icon>
        </div>
        <div v-if="acquiredOpen" class="collapse-body">
          <el-empty v-if="!acquiredApps.length" :image-size="72" :description="t('sidebar.noAcquired')">
            <button class="acquired-go" @click="goMarket">
              {{ t('sidebar.goMarket') }}
              <el-icon :size="12"><ArrowRight /></el-icon>
            </button>
          </el-empty>
          <div
            v-for="a in acquiredApps"
            :key="a.id"
            class="flow-item"
            role="button"
            tabindex="0"
            :title="a.desc"
            @click="goMarket"
            @keydown.enter="goMarket"
          >
            <span class="thumb" :style="{ background: a.color }"><el-icon :size="12" color="#fff"><component :is="a.icon" /></el-icon></span>
            <span class="name">{{ a.name }}</span>
          </div>
        </div>
      </div>

      <div class="side-section">
        <div class="side-title">{{ t('sidebar.groupInstructions') }}</div>
        <div
          class="collapse-head"
          role="button"
          tabindex="0"
          @click="instructionsOpen = !instructionsOpen"
          @keydown.enter="instructionsOpen = !instructionsOpen"
        >
          <el-icon :size="15" class="row-icon"><Document /></el-icon>
          <span class="collapse-name">{{ t('sidebar.myInstructions') }}</span>
          <el-icon :size="13" class="chev" :class="{ rotated: !instructionsOpen }"><CaretBottom /></el-icon>
        </div>
        <div v-if="instructionsOpen" class="collapse-body">
          <div
            v-for="inst in instructions"
            :key="inst.id"
            class="flow-item"
            role="button"
            tabindex="0"
            :class="{ active: store.current?.id === inst.id && store.view === 'designer' }"
            @click="store.openFlow(inst.id)"
            @keydown.enter="store.openFlow(inst.id)"
          >
            <span class="thumb" style="background: #22c55e"><el-icon :size="12"><Connection /></el-icon></span>
            <span class="name" :title="inst.name">{{ inst.name }}</span>
            <el-tooltip :content="t('common.delete')" placement="right" :show-after="300">
              <button class="del" @click="confirmDelete($event, inst.id)">
                <el-icon :size="12"><Delete /></el-icon>
              </button>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

  </aside>
</template>

<style scoped>
.collapse-head {
  cursor: pointer;
}

.head-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.chev-btn {
  border: none;
  background: transparent;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
}

.chev-btn:hover {
  background: var(--hover);
}

.acquired-go {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--accent);
  font-size: 12px;
  align-self: flex-start;
}

.acquired-go:hover {
  color: var(--accent-hover);
}
</style>
