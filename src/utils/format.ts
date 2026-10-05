export function fmtTs(ts?: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return String(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fmtDateShort(ts?: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return String(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 十进制精度舍入，解决 JS 浮点误差（如 0.1+0.2=0.30000000000000004）。
 * 返回 number 类型，适合在计算链中继续使用或直接显示。
 */
export function round(n: number | null | undefined, digits = 2): number {
  // 注意：isNaN(Infinity) === false，必须额外用 isFinite 拦住 Infinity / -Infinity，
  // 否则除零结果会原样返回并污染「平均功率」「均价」等汇总指标。
  if (n == null || isNaN(n) || !isFinite(n)) return 0
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || isNaN(v) || !isFinite(v)) return '-'
  return v.toFixed(digits)
}

/**
 * 把「小时（小数）」格式化为「1h30m」式易读文本。
 * 输入单位与系统内部一致（小时）。
 */
export function fmtDuration(h?: number | null): string {
  if (h == null || isNaN(h) || h <= 0) return '-'
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  if (hh === 0) return `${mm}min`
  if (mm === 0) return `${hh}h`
  return `${hh}h${mm}m`
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function nowLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function toNum(x: string | number | null | undefined): number | null {
  if (x === '' || x === null || x === undefined) return null
  const v = parseFloat(String(x))
  return isNaN(v) ? null : v
}
