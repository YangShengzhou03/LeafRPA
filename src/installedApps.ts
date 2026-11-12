import { ref } from 'vue'
import { loadInstalled, saveInstalled } from './marketApps'

/** 已安装市场应用（全局共享，市场页与侧栏实时同步） */
export const installedApps = ref<Set<string>>(loadInstalled())

export function installApp(id: string) {
  installedApps.value = new Set(installedApps.value).add(id)
  saveInstalled(installedApps.value)
}

export function uninstallApp(id: string) {
  const next = new Set(installedApps.value)
  next.delete(id)
  installedApps.value = next
  saveInstalled(installedApps.value)
}
