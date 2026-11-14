import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import MarketView from './views/MarketView.vue'
import CommunityView from './views/CommunityView.vue'
import FlowsView from './views/FlowsView.vue'
import ProfileView from './views/ProfileView.vue'
import './style.css'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', component: HomeView },
  { path: '/login', component: LoginView },
  { path: '/market', component: MarketView },
  { path: '/community', component: CommunityView },
  { path: '/flows', component: FlowsView },
  { path: '/profile', component: ProfileView }
]

const router = createRouter({ history: createWebHistory(), routes })

createApp(App).use(router).use(ElementPlus).mount('#app')
