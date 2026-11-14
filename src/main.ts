import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import ElementEditor from './components/ElementEditor.vue'
import { isElementEditorWindow } from './element-editor'
import { setupAuthExpiryWatcher } from './auth'
import './style.css'

/**
 * Element Plus 组件样式由 unplugin-vue-components 按需注入；
 * 以下三个 API 组件通过 JS 调用（notify.ts / store.ts），需手动引入样式。
 */
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/notification/style/css'
import 'element-plus/es/components/message-box/style/css'

/**
 * 元素编辑器是独立 Tauri 子窗口，复用同一个 index.html，
 * 靠查询串 ?elementEditor=1 区分挂哪个根组件。
 */
const Root = isElementEditorWindow() ? ElementEditor : App

const app = createApp(Root)
app.use(createPinia())
// 401 / token 失效统一登出并回到登录页
setupAuthExpiryWatcher()
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#app')
