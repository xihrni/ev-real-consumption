import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export function hashPassword(p) {
  return bcrypt.hashSync(p, 10)
}

export function verifyPassword(p, hash) {
  return bcrypt.compareSync(p, hash)
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '30d' })
}
