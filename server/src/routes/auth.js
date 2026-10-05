import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { hashPassword, verifyPassword, signToken } from '../auth.js'
import { isValidEmail, isValidPassword } from '../validation.js'

const router = Router()

// 公共：注册
router.post('/register', (req, res) => {
  const { email, password } = req.body || {}
  if (!isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({ error: '邮箱格式或密码长度(≥6)不合法' })
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim())
  if (exists) return res.status(409).json({ error: '该邮箱已注册' })

  const id = crypto.randomUUID()
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .run(id, email.trim(), hashPassword(password))
  const token = signToken(id)
  return res.status(201).json({ token, user: { id, email: email.trim() } })
})

// 公共：登录
router.post('/login', (req, res) => {
  const { email, password } = req.body || {}
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim())
  if (!row || !verifyPassword(password || '', row.password_hash)) {
    return res.status(401).json({ error: '邮箱或密码错误' })
  }
  const token = signToken(row.id)
  return res.status(200).json({ token, user: { id: row.id, email: row.email } })
})

export default router
