/**
 * 时间周期筛选。
 *
 * 概览页与「记录/分析页」都要按周期过滤记录，逻辑完全一致，
 * 抽到这里共用，避免两处各写一份后出现行为漂移。
 */

export type Period = 'all' | '30d' | 'month' | 'lastmonth'

export const PERIOD_OPTS: { key: Period; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '30d', label: '近30天' },
  { key: 'month', label: '本月' },
  { key: 'lastmonth', label: '上月' }
]

/**
 * 判断一条记录是否落在指定周期内。
 * `ts` 是 datetime-local 字符串（无时区），由 `new Date()` 按本地时间解析。
 *
 * `all` 直接短路返回 true；其余三档下无法解析的时间返回 false ——
 * 不静默放行，避免脏数据混进按周期的统计。
 */
export function inPeriod(tsStr: string, p: Period): boolean {
  if (p === 'all') return true
  const d = new Date(tsStr)
  if (isNaN(d.getTime())) return false
  const now = new Date()
  if (p === '30d') return d.getTime() >= now.getTime() - 30 * 86400000
  if (p === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  // lastmonth：上一个自然月
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
}
