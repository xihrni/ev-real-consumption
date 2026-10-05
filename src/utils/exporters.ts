import type { Vehicle, ChargeSession } from '../types'
import { computeAll } from './calc'
import { fmtTs, round } from './format'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const dateStamp = () => new Date().toISOString().slice(0, 10)

/** 导出全部车辆与记录（完整备份，支持多车辆） */
export function exportJson(vehicles: Vehicle[], sessions: ChargeSession[]) {
  const data = JSON.stringify({ vehicles, sessions }, null, 2)
  download(`ev-record-${dateStamp()}.json`, data, 'application/json')
}

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** 导出全部记录为 CSV，含「车辆」列，并按车辆分组独立测算 */
export function exportCsv(vehicles: Vehicle[], sessions: ChargeSession[]) {
  const headers = [
    '车辆', '充电时间', '度数(kWh)', '时长(h)', '金额(元)', '度数口径', '当前里程(km)',
    '起始车显(km)', '结束车显(km)', '备注', '状态',
    '真实电耗(kWh/100km)', '均价(元/100km)', '表显电耗', '功率(kW)', '本段消耗(kWh)', '本段里程(km)'
  ]
  const rows: string[] = []
  // 按车辆分组，每组独立跑测算，保证段序号正确
  const groups = new Map<string, ChargeSession[]>()
  for (const s of sessions) {
    const key = s.vehicleId || '__none__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }
  for (const [, list] of groups) {
    const veh = vehicles.find((v) => v.id === (list[0]?.vehicleId || '')) ?? null
    const { segs } = computeAll(veh, list)
    const sorted = [...list].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    )
    const model = veh?.model ?? ''
    sorted.forEach((s, idx) => {
      const seg = segs[idx] || {}
      const st = seg.status
      const stTxt = st === 'ok' ? '完整' : st === 'baseline' ? '基准' : st === 'pending' ? '待补全' : '异常'
      const meterTxt = s.meter === 'grid' ? '电网端' : '电池端'
      rows.push(
        [
          model, fmtTs(s.ts), s.E, s.T, s.C, meterTxt, s.M, s.R_start, s.R_end, s.note || '', stTxt,
          st === 'ok' ? seg.real : '', st === 'ok' ? seg.price : '',
          st === 'ok' ? seg.disp : '', st === 'ok' ? seg.power : '',
          st === 'ok' ? seg.Econs : '', st === 'ok' ? seg.dM : ''
        ]
          .map(esc)
          .join(',')
      )
    })
  }
  const csv = '﻿' + headers.map(esc).join(',') + '\n' + rows.join('\n')
  download(`ev-record-${dateStamp()}.csv`, csv, 'text/csv;charset=utf-8')
}

/** 导出月度报表 CSV（按自然月汇总当前车辆） */
export function exportMonthlyCsv(vehicle: Vehicle | null, sessions: ChargeSession[]) {
  const { segs, sorted } = computeAll(vehicle, sessions)
  const map: Record<string, { month: string; count: number; allE: number; allC: number; okC: number; M: number; Econs: number }> = {}
  sorted.forEach((s, i) => {
    const mk = (s.ts || '').slice(0, 7)
    if (!mk) return
    if (!map[mk]) map[mk] = { month: mk, count: 0, allE: 0, allC: 0, okC: 0, M: 0, Econs: 0 }
    const g = map[mk]
    g.count++
    g.allE += s.E
    g.allC += s.C
    const seg = segs[i]
    if (seg && seg.status === 'ok') {
      g.okC += s.C
      g.M += seg.dM || 0
      g.Econs += seg.Econs || 0
    }
  })
  const headers = [
    '车辆', '月份', '充电次数', '总度数(kWh)', '总花费(元)', '行驶里程(km)',
    '真实电耗(kWh/100km)', '均价(元/100km)', '电价(元/kWh)'
  ]
  const rows = Object.keys(map)
    .sort()
    .map((mk) => {
      const g = map[mk]
      const real = g.M > 0 ? round((g.Econs / g.M) * 100) : 0
      const price = g.M > 0 ? round((g.okC / g.M) * 100) : 0
      const unitPrice = g.allE > 0 ? round(g.allC / g.allE) : 0
      return [vehicle?.model || '', g.month, g.count, round(g.allE, 1), round(g.allC), round(g.M, 0), real || '', price || '', unitPrice || '']
        .map(esc)
        .join(',')
    })
  const csv = '﻿' + headers.map(esc).join(',') + '\n' + rows.join('\n')
  download(`ev-monthly-${dateStamp()}.csv`, csv, 'text/csv;charset=utf-8')
}
