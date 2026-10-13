import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { inPeriod, PERIOD_OPTS, type Period } from '../src/utils/period'

/**
 * 周期筛选被概览页与分析页共用，且「本月 / 上月」依赖当前时间。
 * 测试里用固定系统时间，避免跨月运行时随机失败。
 */

const NOW = new Date('2026-10-13T16:00:00') // 本地时间 2026-10-13

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('inPeriod · 全部', () => {
  it('任何可解析时间都算在「全部」内', () => {
    expect(inPeriod('2020-01-01T10:00', 'all')).toBe(true)
    expect(inPeriod('2026-10-13T15:00', 'all')).toBe(true)
    expect(inPeriod('2099-12-31T23:59', 'all')).toBe(true)
  })

  it('无法解析的时间在「全部」下也返回 true（不按周期过滤）', () => {
    // all 直接短路返回，不做日期解析
    expect(inPeriod('bad-date', 'all')).toBe(true)
  })
})

describe('inPeriod · 近30天', () => {
  it('30 天内为真，超过为假', () => {
    expect(inPeriod('2026-10-13T15:00', '30d')).toBe(true) // 今天
    expect(inPeriod('2026-09-14T16:00', '30d')).toBe(true) // 第 29 天
    expect(inPeriod('2026-09-01T10:00', '30d')).toBe(false) // 42 天前
  })

  it('刚好 30 天前为真（含边界）', () => {
    const exactly30 = new Date(NOW.getTime() - 30 * 86400000)
    const p = (n: number) => String(n).padStart(2, '0')
    const ts = `${exactly30.getFullYear()}-${p(exactly30.getMonth() + 1)}-${p(exactly30.getDate())}T${p(exactly30.getHours())}:${p(exactly30.getMinutes())}`
    expect(inPeriod(ts, '30d')).toBe(true)
  })
})

describe('inPeriod · 本月', () => {
  it('同月为真，跨月为假', () => {
    expect(inPeriod('2026-10-01T00:00', 'month')).toBe(true)
    expect(inPeriod('2026-10-13T16:00', 'month')).toBe(true)
    expect(inPeriod('2026-10-31T23:59', 'month')).toBe(true)
    expect(inPeriod('2026-09-30T23:59', 'month')).toBe(false)
    expect(inPeriod('2026-11-01T00:00', 'month')).toBe(false)
  })

  it('去年同月不算本月', () => {
    expect(inPeriod('2025-10-13T16:00', 'month')).toBe(false)
  })
})

describe('inPeriod · 上月', () => {
  it('上一个自然月为真', () => {
    expect(inPeriod('2026-09-01T00:00', 'lastmonth')).toBe(true)
    expect(inPeriod('2026-09-30T23:59', 'lastmonth')).toBe(true)
  })

  it('本月与上上月都不算上月', () => {
    expect(inPeriod('2026-10-01T00:00', 'lastmonth')).toBe(false)
    expect(inPeriod('2026-08-31T23:59', 'lastmonth')).toBe(false)
  })

  it('跨年边界：1 月的上月是去年 12 月', () => {
    vi.setSystemTime(new Date('2027-01-15T10:00:00'))
    expect(inPeriod('2026-12-20T10:00', 'lastmonth')).toBe(true)
    expect(inPeriod('2026-11-20T10:00', 'lastmonth')).toBe(false)
    expect(inPeriod('2027-01-05T10:00', 'lastmonth')).toBe(false)
  })
})

describe('inPeriod · 脏数据', () => {
  it('空串 / 非法字符串返回 false', () => {
    expect(inPeriod('', '30d')).toBe(false)
    expect(inPeriod('not-a-date', 'month')).toBe(false)
    expect(inPeriod('2026-13-45T99:99', '30d')).toBe(false)
  })

  it('空值按 Invalid Date 处理，不抛错', () => {
    expect(() => inPeriod(null as unknown as string, '30d')).not.toThrow()
    expect(inPeriod(null as unknown as string, '30d')).toBe(false)
  })
})

describe('PERIOD_OPTS', () => {
  it('四档周期，key 与 label 一一对应', () => {
    const keys: Period[] = PERIOD_OPTS.map((o) => o.key)
    expect(keys).toEqual(['all', '30d', 'month', 'lastmonth'])
    expect(PERIOD_OPTS.every((o) => o.label.length > 0)).toBe(true)
  })
})
