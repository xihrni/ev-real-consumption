// 轻量入参校验（后端兜底，前端已有更严格的 validation.ts）
export function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
}

export function isValidPassword(p) {
  return typeof p === 'string' && p.length >= 6
}

// 数值：必须能转成有限正数（或允许 0）
export function isPosNumber(v, allowZero = false) {
  const n = Number(v)
  if (!Number.isFinite(n)) return false
  return allowZero ? n >= 0 : n > 0
}

export function inEnum(v, values) {
  return v == null || values.includes(v)
}
