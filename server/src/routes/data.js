import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { vehicleRow, sessionRow } from '../serialize.js'
import { isPosNumber, inEnum } from '../validation.js'

const router = Router()
const uid = () => crypto.randomUUID()

const PALETTE = ['#0fae8e', '#6366f1', '#f59e0b', '#e5484d', '#0ea5e9', '#a855f7', '#ec4899', '#14b8a6']

// 生成与前端 loadDemo 等价的示例数据（当前用户）
function demoData(userId) {
  const va = uid()
  const vb = uid()
  const vehicles = [
    { id: va, model: '示例EV 长续航版', B: 60, Pmax: 120, M0: 10000, R0: 400, color: PALETTE[0] },
    { id: vb, model: '示例EV 性能版', B: 75, Pmax: 250, M0: 10000, R0: 400, color: PALETTE[1] }
  ]
  const sessions = [
    { id: uid(), vehicleId: va, ts: '2026-06-01T09:30', E: 40, T: 0.8, C: 40, M: 10400, R_start: 50, R_end: 450, meter: 'battery', ctype: 'fast', note: '超充' },
    { id: uid(), vehicleId: va, ts: '2026-06-08T20:10', E: 55, T: 1.0, C: 55, M: 10950, R_start: 30, R_end: 480, meter: 'battery', ctype: 'home', note: '家充' },
    { id: uid(), vehicleId: va, ts: '2026-06-15T11:00', E: 34, T: 0.9, C: 34, M: 11300, R_start: 200, R_end: 480, meter: 'battery', ctype: 'fast', note: '高速服务区' },
    { id: uid(), vehicleId: va, ts: '2026-06-22T18:40', E: 30, T: 0.7, C: 30, M: null, R_start: null, R_end: null, meter: 'battery', ctype: 'home', note: '' },
    { id: uid(), vehicleId: vb, ts: '2026-06-05T10:00', E: 68, T: 0.5, C: 75, M: 20300, R_start: 40, R_end: 520, meter: 'battery', ctype: 'fast', note: '超充' },
    { id: uid(), vehicleId: vb, ts: '2026-06-18T21:30', E: 72, T: 0.6, C: 70, M: 20960, R_start: 60, R_end: 540, meter: 'battery', ctype: 'home', note: '家充' }
  ]
  return { vehicles, sessions }
}

// POST /api/seed-demo —— 灌入示例数据（仅当前用户）
router.post('/seed-demo', (req, res) => {
  const { vehicles, sessions } = demoData(req.userId)
  const tx = db.transaction((vs, ss) => {
    const iv = db.prepare('INSERT INTO vehicles (id, user_id, model, B, Pmax, M0, R0, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const v of vs) iv.run(v.id, req.userId, v.model, v.B, v.Pmax, v.M0, v.R0, v.color ?? null)
    const is = db.prepare(`INSERT INTO sessions (id, user_id, vehicle_id, ts, E, T, C, M, R_start, R_end, meter, ctype, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const s of ss) is.run(s.id, req.userId, s.vehicleId, s.ts, s.E, s.T, s.C, s.M ?? null, s.R_start ?? null, s.R_end ?? null, s.meter ?? null, s.ctype ?? null, s.note ?? null)
  })
  tx.immediate(vehicles, sessions)
  const vRows = db.prepare('SELECT * FROM vehicles WHERE user_id = ?').all(req.userId)
  const sRows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY ts ASC, id ASC').all(req.userId)
  res.status(201).json({ vehicles: vRows.map(vehicleRow), sessions: sRows.map(sessionRow) })
})

// POST /api/replace-all —— 整库替换（对应前端 importData 语义）：事务内先清当前用户全部，再批量插入
router.post('/replace-all', (req, res) => {
  const body = req.body || {}
  const inVehicles = Array.isArray(body.vehicles) ? body.vehicles
    : Array.isArray(body.vehicle) ? [body.vehicle]
    : []
  const inSessions = Array.isArray(body.sessions) ? body.sessions : []

  // 归一化校验
  for (const v of inVehicles) {
    if (!v || !v.model || !isPosNumber(v.B) || !isPosNumber(v.Pmax) || !isPosNumber(v.M0, true) || !isPosNumber(v.R0, true)) {
      return res.status(400).json({ error: '车辆数据不合法' })
    }
  }
  const vIds = new Set(inVehicles.map((v) => v.id))
  for (const s of inSessions) {
    if (!s || !s.ts || !isPosNumber(s.E, true) || !isPosNumber(s.T, true) || !isPosNumber(s.C, true)) {
      return res.status(400).json({ error: '记录数据不合法' })
    }
    if (!inEnum(s.meter, ['battery', 'grid'])) return res.status(400).json({ error: 'meter 取值不合法' })
    if (!inEnum(s.ctype, ['home', 'fast', 'other'])) return res.status(400).json({ error: 'ctype 取值不合法' })
    // vehicleId 缺失则归到第一辆车
    if (!s.vehicleId || !vIds.has(s.vehicleId)) s.vehicleId = inVehicles[0]?.id
  }
  if (inSessions.length && !inVehicles.length) {
    return res.status(400).json({ error: '记录缺少归属车辆' })
  }

  const tx = db.transaction((vs, ss) => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.userId)
    db.prepare('DELETE FROM vehicles WHERE user_id = ?').run(req.userId)
    const iv = db.prepare('INSERT INTO vehicles (id, user_id, model, B, Pmax, M0, R0, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const v of vs) iv.run(v.id || uid(), req.userId, String(v.model).trim(), Number(v.B), Number(v.Pmax), Number(v.M0), Number(v.R0), v.color ?? null)
    const is = db.prepare(`INSERT INTO sessions (id, user_id, vehicle_id, ts, E, T, C, M, R_start, R_end, meter, ctype, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const s of ss) is.run(s.id || uid(), req.userId, s.vehicleId, String(s.ts), Number(s.E), Number(s.T), Number(s.C),
      s.M == null ? null : Number(s.M), s.R_start == null ? null : Number(s.R_start), s.R_end == null ? null : Number(s.R_end),
      s.meter ?? null, s.ctype ?? null, s.note != null ? String(s.note) : null)
  })
  try {
    tx.immediate(inVehicles, inSessions)
  } catch (e) {
    return res.status(400).json({ error: '导入失败：' + (e.message || '数据冲突') })
  }
  const vRows = db.prepare('SELECT * FROM vehicles WHERE user_id = ?').all(req.userId)
  const sRows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY ts ASC, id ASC').all(req.userId)
  res.json({ vehicles: vRows.map(vehicleRow), sessions: sRows.map(sessionRow) })
})

// DELETE /api/data —— 清空当前用户全部数据
router.delete('/data', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.userId)
  db.prepare('DELETE FROM vehicles WHERE user_id = ?').run(req.userId)
  res.json({ ok: true })
})

export default router
