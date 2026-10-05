/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Vue 单文件组件的类型声明。
// 缺少它，`tsc --noEmit` 会报 TS2307: Cannot find module './App.vue'。
// vite/client 只提供静态资源与 import.meta 的类型，不含 .vue 模块。
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
