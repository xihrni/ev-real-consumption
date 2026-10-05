import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Pin root to this file's directory so vite resolves the HTML entry on the
  // same drive letter as the project (avoids a C:/ vs D:/ path mismatch in
  // some sandboxed Windows environments that breaks the build-html emit).
  root: __dirname,
  plugins: [vue()],
  server: {
    // 允许反向代理域名访问（Coolify / WorkBuddy 发布等反向代理场景需要）
    allowedHosts: true,
    // 开发态：前端 :5173 的 /api 请求代理到后端 :3000
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    // 产物目录是否先清空。默认 true —— 必须在构建前清空，否则每次构建都会
    // 残留上一版的 hash 资源（dist/assets 曾在 30 个文件上持续膨胀）。
    // 少数受限沙箱环境的 safe-delete 会拦截 dist 删除操作而让构建失败，
    // 这种环境可设 EV_KEEP_DIST=1 临时关闭。
    emptyOutDir: process.env.EV_KEEP_DIST !== '1',
    chunkSizeWarningLimit: 1500
  }
})
