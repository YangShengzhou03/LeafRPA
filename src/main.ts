import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import ElementEditor from './components/ElementEditor.vue'
import { isElementEditorWindow } from './element-editor'
import './style.css'

/**
 * 元素编辑器是独立 Tauri 子窗口，复用同一个 index.html，
 * 靠查询串 ?elementEditor=1 区分挂哪个根组件。
 */
const Root = isElementEditorWindow() ? ElementEditor : App

const app = createApp(Root)
app.use(createPinia())
app.use(ElementPlus)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#app')
