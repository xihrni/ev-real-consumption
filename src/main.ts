import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

// PWA: 注册 Service Worker（离线可用 / 可安装）。
// 关键：监听 controllerchange —— 当新的 SW 接管（skipWaiting+claim）后自动刷新一次，
// 确保用户始终运行最新构建；配合 sw.js 的「导航网络优先」策略彻底告别“永远旧版”。
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  let refreshed = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshed) return
    refreshed = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // 每次启动主动检查一次更新
        reg.update().catch(() => {})
      })
      .catch(() => {})
  })
}
