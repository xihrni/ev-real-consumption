import { Router } from 'express'
import { db } from '../db.js'
import { sessionRow } from '../serialize.js'
import { isPosNumber, inEnum } from '../validation.js'

const router = Router()

function genId() {
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

// 列出当前用户全部记录（可选按 vehicleId 过滤，该车辆须属当前用户）
router.get('/', (req, res) => {
  const vehicleId = req.query.vehicleId
  let rows
  if (vehicleId) {
    const owned = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(vehicleId, req.userId)
    if (!owned) return res.status(404).json({ error: '车辆不存在或无权访问' })
    rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? AND vehicle_id = ? ORDER BY ts ASC, id ASC').all(req.userId, vehicleId)
  } else {
    rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY ts ASC, id ASC').all(req.userId)
  }
  res.json({ sessions: rows.map(sessionRow) })
})

// 新建记录（vehicleId 必填且须属当前用户）
router.post('/', (req, res) => {
  const b = req.body || {}
  const { vehicleId, ts, E, T, C, M, R_start, R_end, meter, ctype, note } = b
  if (!vehicleId) return res.status(400).json({ error: '缺少 vehicleId' })
  const owned = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(vehicleId, req.userId)
  if (!owned) return res.status(404).json({ error: '车辆不存在或无权访问' })
  if (!ts || !isPosNumber(E, true) || !isPosNumber(T, true) || !isPosNumber(C, true)) {
    return res.status(400).json({ error: '记录参数不合法（ts 必填；E/T/C≥0）' })
  }
  if (!inEnum(meter, ['battery', 'grid'])) return res.status(400).json({ error: 'meter 取值不合法' })
  if (!inEnum(ctype, ['home', 'fast', 'other'])) return res.status(400).json({ error: 'ctype 取值不合法' })
  const sid = b.id || genId()
  const exist = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(sid, req.userId)
  if (exist) return res.status(409).json({ error: '该记录 id 已存在' })
  db.prepare(`INSERT INTO sessions (id, user_id, vehicle_id, ts, E, T, C, M, R_start, R_end, meter, ctype, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      sid, req.userId, vehicleId, String(ts), Number(E), Number(T), Number(C),
      M == null ? null : Number(M),
      R_start == null ? null : Number(R_start),
      R_end == null ? null : Number(R_end),
      meter ?? null, ctype ?? null,
      note != null ? String(note) : null
    )
  res.status(201).json({ session: sessionRow(db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid)) })
})

// 更新记录（部分字段）
router.put('/:id', (req, res) => {
  const b = req.body || {}
  const cur = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!cur) return res.status(404).json({ error: '记录不存在或无权访问' })
  const ts = b.ts ?? cur.ts
  const E = b.E != null ? Number(b.E) : cur.E
  const T = b.T != null ? Number(b.T) : cur.T
  const C = b.C != null ? Number(b.C) : cur.C
  const M = b.M !== undefined ? (b.M == null ? null : Number(b.M)) : cur.M
  const R_start = b.R_start !== undefined ? (b.R_start == null ? null : Number(b.R_start)) : cur.R_start
  const R_end = b.R_end !== undefined ? (b.R_end == null ? null : Number(b.R_end)) : cur.R_end
  const meter = b.meter !== undefined ? b.meter : cur.meter
  const ctype = b.ctype !== undefined ? b.ctype : cur.ctype
  const note = b.note !== undefined ? b.note : cur.note
  if (!ts || !isPosNumber(E, true) || !isPosNumber(T, true) || !isPosNumber(C, true)) {
    return res.status(400).json({ error: '记录参数不合法' })
  }
  if (!inEnum(meter, ['battery', 'grid'])) return res.status(400).json({ error: 'meter 取值不合法' })
  if (!inEnum(ctype, ['home', 'fast', 'other'])) return res.status(400).json({ error: 'ctype 取值不合法' })
  db.prepare(`UPDATE sessions SET ts=?, E=?, T=?, C=?, M=?, R_start=?, R_end=?, meter=?, ctype=?, note=?, updated_at=strftime('%s','now') WHERE id=? AND user_id=?`)
    .run(
      String(ts), E, T, C, M, R_start, R_end, meter ?? null, ctype ?? null,
      note != null ? String(note) : null, req.params.id, req.userId
    )
  res.json({ session: sessionRow(db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id)) })
})

// 删除记录
router.delete('/:id', (req, res) => {
  const cur = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!cur) return res.status(404).json({ error: '记录不存在或无权访问' })
  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  res.json({ ok: true })
})

export default router
