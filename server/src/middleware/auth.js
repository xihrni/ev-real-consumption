import jwt from 'jsonwebtoken'

// 校验 Authorization: Bearer <token>，注入 req.userId；失败 401
export function authenticate(req, res, next) {
  const h = req.headers.authorization || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  if (!m) return res.status(401).json({ error: '未授权' })
  try {
    const payload = jwt.verify(m[1], process.env.JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json({ error: '未授权' })
  }
}
