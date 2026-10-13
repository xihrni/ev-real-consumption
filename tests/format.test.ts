import { describe, it, expect } from 'vitest'
import { round, fmtNum, toNum, fmtDuration, fmtTs, fmtDateShort, uid } from '../src/utils/format'

/**
 * format.ts 是数值安全的最后一道防线。
 * 重点覆盖 isNaN 拦不住 Infinity 这个历史 bug。
 */
describe('round · Infinity 防护（历史 bug）', () => {
  it('Infinity 被拦下并返回 0', () => {
    // isNaN(Infinity) === false，只判断 isNaN 是拦不住的
    expect(Number.isNaN(Infinity)).toBe(false)
    expect(round(Infinity)).toBe(0)
  })

  it('-Infinity 同样被拦下', () => {
    expect(round(-Infinity)).toBe(0)
  })

  it('NaN 返回 0', () => {
    expect(round(NaN)).toBe(0)
  })

  it('null / undefined 返回 0', () => {
    expect(round(null)).toBe(0)
    expect(round(undefined)).toBe(0)
  })

  it('正常值按位数舍入', () => {
    expect(round(3.14159, 2)).toBe(3.14)
    expect(round(3.14159, 1)).toBe(3.1)
    expect(round(3.14159, 0)).toBe(3)
    expect(round(2.5, 0)).toBe(3) // 四舍五入
  })

  it('除零产生 Infinity 的链路被兜住', () => {
    const T = 0
    const E = 30
    const power = T > 0 ? round(E / T, 1) : null
    expect(power).toBeNull()

    // 即使绕过上层判断直接算，round 也能兜住
    expect(round(E / T, 1)).toBe(0)
  })
})

describe('round · 浮点精度', () => {
  it('避免 0.1+0.2 式的抖动', () => {
    expect(round(0.1 + 0.2, 1)).toBe(0.3)
    expect(round(1.005, 2)).toBe(1.0) // JS 浮点固有行为，保持一致即可
  })
})

describe('fmtNum', () => {
  it('null 显示为占位符', () => {
    expect(fmtNum(null)).toBe('-')
    expect(fmtNum(undefined)).toBe('-')
  })

  it('NaN / Infinity 显示为占位符，不泄漏到界面', () => {
    expect(fmtNum(NaN)).toBe('-')
    expect(fmtNum(Infinity)).toBe('-')
    expect(fmtNum(-Infinity)).toBe('-')
  })

  it('按指定位数格式化（不做千分位分隔）', () => {
    expect(fmtNum(3.14159, 2)).toBe('3.14')
    expect(fmtNum(3.14159, 0)).toBe('3')
    expect(fmtNum(1234.5, 0)).toBe('1235')
  })

  it('0 是有效值，显示 0.00 而非占位符', () => {
    expect(fmtNum(0)).toBe('0.00')
  })
})

describe('toNum', () => {
  it('空值与非法输入返回 null', () => {
    expect(toNum('')).toBeNull()
    expect(toNum('abc')).toBeNull()
    expect(toNum(null)).toBeNull()
    expect(toNum(undefined)).toBeNull()
  })

  it('数字与数字字符串都能解析', () => {
    expect(toNum(42)).toBe(42)
    expect(toNum('42')).toBe(42)
    expect(toNum('3.14')).toBe(3.14)
  })

  it('0 是有效值，不被当成空', () => {
    expect(toNum(0)).toBe(0)
    expect(toNum('0')).toBe(0)
  })
})

describe('fmtDuration', () => {
  it('小时数拆成「1h30m」式', () => {
    expect(fmtDuration(1.5)).toBe('1h30m')
    expect(fmtDuration(0.25)).toBe('15min')
    expect(fmtDuration(2)).toBe('2h') // 整小时不带分钟
  })

  it('0 与负值返回占位符', () => {
    expect(fmtDuration(0)).toBe('-')
    expect(fmtDuration(-1)).toBe('-')
  })

  it('空值返回占位符', () => {
    expect(fmtDuration(null)).toBe('-')
    expect(fmtDuration(undefined)).toBe('-')
  })
})

describe('时间格式化', () => {
  it('fmtTs 把 datetime-local 转成可读格式', () => {
    expect(fmtTs('2026-07-09T09:25')).toBe('2026-07-09 09:25')
  })

  it('fmtTs 空值返回空串', () => {
    expect(fmtTs('')).toBe('')
    expect(fmtTs(null)).toBe('')
    expect(fmtTs(undefined)).toBe('')
  })

  it('fmtTs 无法解析时原样返回，不抛错', () => {
    expect(fmtTs('not-a-date')).toBe('not-a-date')
  })

  it('fmtDateShort 只取月日', () => {
    expect(fmtDateShort('2026-07-09T09:25')).toBe('07-09')
  })

  it('fmtDateShort 空值返回空串', () => {
    expect(fmtDateShort('')).toBe('')
  })
})

describe('uid', () => {
  it('每次生成都不同', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()))
    expect(ids.size).toBe(100)
  })

  it('长度足够避免碰撞', () => {
    expect(uid().length).toBeGreaterThanOrEqual(8)
  })
})
