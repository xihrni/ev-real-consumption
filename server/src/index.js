// 默认生产模式：未显式设置 NODE_ENV 时按生产处理（单端口托管前端 + /api）。
// 这样 `npm run start`（跨平台，无需 NODE_ENV=xxx 前缀）即可直接对外提供服务。
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

// 启动即建表（import 副作用）
import './db.js'
import authRouter from './routes/auth.js'
import { authenticate } from './middleware/auth.js'
import { db } from './db.js'
import vehicleRouter from './routes/vehicles.js'
import sessionRouter from './routes/sessions.js'
import dataRouter from './routes/data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[fatal] 生产环境必须设置 JWT_SECRET')
  process.exit(1)
}

const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json())

// 健康检查
app.get('/healthz', (_req, res) => res.json({ ok: true, time: Date.now() }))

// 路由挂载
const api = express.Router()
// 公开端点：注册 / 登录
api.use('/auth', authRouter)
// 受保护端点
api.get('/me', authenticate, (req, res) => {
  const row = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.userId)
  if (!row) return res.status(401).json({ error: '未授权' })
  res.json({ user: { id: row.id, email: row.email } })
})
api.use('/vehicles', authenticate, vehicleRouter)
api.use('/sessions', authenticate, sessionRouter)
api.use(authenticate, dataRouter)
app.use('/api', api)

// 生产环境：静态托管前端 + SPA 回退（仅在 NODE_ENV=production 且 dist 存在时）
if (process.env.NODE_ENV === 'production') {
  const dist = resolve(__dirname, '..', '..', 'dist')
  if (existsSync(dist)) {
    // index.html 与 sw.js 必须禁缓存：前者决定加载哪个 hash 的 JS，后者决定 SW 能否更新。
    // 若被浏览器缓存，用户会一直停留在旧版本（曾导致“改了但页面没变化”）。
    const noCache = 'no-cache, no-store, must-revalidate'
    app.use(
      express.static(dist, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', noCache)
          }
        }
      })
    )
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader('Cache-Control', noCache)
      res.sendFile(resolve(dist, 'index.html'))
    })
  }
}

// 全局错误处理：把抛出的异常统一转成 JSON（避免返回 HTML）
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err)
  const status = err.status || (err.message && /NOT NULL|UNIQUE|CHECK|constraint/i.test(err.message) ? 400 : 500)
  res.status(status).json({ error: err.message || '服务器内部错误' })
})

const PORT = Number(process.env.PORT || 3000)
app.listen(PORT, () => {
  console.log(`[server] ev-app 后端已启动: http://localhost:${PORT}`)
})
