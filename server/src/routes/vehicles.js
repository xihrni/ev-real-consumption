import { Router } from 'express'
import { db } from '../db.js'
import { vehicleRow } from '../serialize.js'
import { isPosNumber } from '../validation.js'

const router = Router()

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

// 列出当前用户全部车辆（按创建时间升序）
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at ASC, id ASC')
    .all(req.userId)
  res.json({ vehicles: rows.map(vehicleRow) })
})

// 新建车辆（id 可选，缺失由服务端生成）
router.post('/', (req, res) => {
  const b = req.body || {}
  const { id, model, B, Pmax, M0, R0, color } = b
  if (!model || !isPosNumber(B) || !isPosNumber(Pmax) || !isPosNumber(M0, true) || !isPosNumber(R0, true)) {
    return res.status(400).json({ error: '车辆参数不合法（model 必填；B/Pmax>0；M0/R0≥0）' })
  }
  const vid = id || genId('v')
  const exist = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(vid, req.userId)
  if (exist) return res.status(409).json({ error: '该车辆 id 已存在' })
  db.prepare('INSERT INTO vehicles (id, user_id, model, B, Pmax, M0, R0, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(vid, req.userId, String(model).trim(), Number(B), Number(Pmax), Number(M0), Number(R0), color ?? null)
  res.status(201).json({ vehicle: vehicleRow(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vid)) })
})

// 更新车辆（部分字段）
router.put('/:id', (req, res) => {
  const b = req.body || {}
  const cur = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!cur) return res.status(404).json({ error: '车辆不存在或无权访问' })
  const model = b.model ?? cur.model
  const B = b.B != null ? Number(b.B) : cur.B
  const Pmax = b.Pmax != null ? Number(b.Pmax) : cur.Pmax
  const M0 = b.M0 != null ? Number(b.M0) : cur.M0
  const R0 = b.R0 != null ? Number(b.R0) : cur.R0
  const color = b.color !== undefined ? b.color : cur.color
  if (!model || !isPosNumber(B) || !isPosNumber(Pmax) || !isPosNumber(M0, true) || !isPosNumber(R0, true)) {
    return res.status(400).json({ error: '车辆参数不合法' })
  }
  db.prepare(`UPDATE vehicles SET model=?, B=?, Pmax=?, M0=?, R0=?, color=?, updated_at=strftime('%s','now') WHERE id=? AND user_id=?`)
    .run(String(model).trim(), B, Pmax, M0, R0, color ?? null, req.params.id, req.userId)
  res.json({ vehicle: vehicleRow(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id)) })
})

// 删除车辆（级联删除其充电记录）
router.delete('/:id', (req, res) => {
  const cur = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!cur) return res.status(404).json({ error: '车辆不存在或无权访问' })
  db.prepare('DELETE FROM vehicles WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  res.json({ ok: true })
})

export default router
