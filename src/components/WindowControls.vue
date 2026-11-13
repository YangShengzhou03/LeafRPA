<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Close, FullScreen, Minus } from '@element-plus/icons-vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { t } from '../i18n'

/* 无边框窗口的最小化 / 最大化 / 关闭，顶栏与设计器工具栏共用 */
const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const appWindow = hasTauri ? getCurrentWindow() : null
const isMax = ref(false)

onMounted(async () => {
  isMax.value = (await appWindow?.isMaximized()) ?? false
})

const onMaxToggle = async () => {
  if (!appWindow) return
  await appWindow.toggleMaximize()
  isMax.value = await appWindow.isMaximized()
}
</script>

<template>
  <div class="win-controls">
    <el-tooltip :content="t('win.minimize')" placement="bottom" :show-after="300">
      <button class="win-btn" @click="appWindow?.minimize()">
        <el-icon :size="15"><Minus /></el-icon>
      </button>
    </el-tooltip>
    <el-tooltip :content="isMax ? t('win.restore') : t('win.maximize')" placement="bottom" :show-after="300">
      <button class="win-btn" @click="onMaxToggle">
        <el-icon :size="13"><FullScreen /></el-icon>
      </button>
    </el-tooltip>
    <el-tooltip :content="t('win.close')" placement="bottom" :show-after="300">
      <button class="win-btn close" @click="appWindow?.close()">
        <el-icon :size="15"><Close /></el-icon>
      </button>
    </el-tooltip>
  </div>
</template>
