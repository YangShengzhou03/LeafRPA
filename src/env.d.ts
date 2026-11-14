/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 服务端入口覆盖（打包时注入，如 VITE_SERVER_BASE=https://api.example.com） */
  readonly VITE_SERVER_BASE?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
