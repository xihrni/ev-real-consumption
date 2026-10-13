import { describe, it, expect } from 'vitest'
import { computeAll, segSummary } from '../src/utils/calc'
import { round } from '../src/utils/format'
import type { ChargeSession, Vehicle } from '../src/types'

/**
 * calc.ts 是项目的算法核心（混合充电测算）。
 * 这里的用例按「真实故障」设计，不是凑覆盖率：
 *  - 充满场景必须退化为 E/dM*100
 *  - 部分充电不能被高估（Econs < E）
 *  - 均价必须按消耗占比分摊，不能用整包费用除里程（71.33 尖峰 bug）
 */

const VEHICLE: Vehicle = {
  id: 'v1',
  model: '测试车',
  B: 59.1,
  Pmax: 60,
  M0: 0,
  R0: 0
}

/** 造一条记录，未填的字段默认 null（两阶段录入：阶段一只记账单） */
function session(patch: Partial<ChargeSession> & { ts: string }): ChargeSession {
  return {
    id: 's_' + patch.ts,
    vehicleId: 'v1',
    ts: patch.ts,
    E: 30,
    T: 1,
    C: 25,
    M: null,
    R_start: null,
    R_end: null,
    meter: 'grid',
    ctype: 'fast',
    note: null,
    createdAt: 0,
    updatedAt: 0,
    ...patch
  }
}

describe('computeAll · 状态判定', () => {
  it('缺 M / R_start / R_end 任一项 → pending，且不进累计', () => {
    const r = computeAll(VEHICLE, [session({ ts: '2026-01-01T10:00', M: 100 })])
    expect(r.segs[0].status).toBe('pending')
    expect(r.cum).toBeNull()
  })

  it('vehicle 为 null（无任何基线）→ baseline，不参与计算', () => {
    const r = computeAll(null, [
      session({ ts: '2026-01-01T10:00', M: 100, R_start: 10, R_end: 200 })
    ])
    expect(r.segs[0].status).toBe('baseline')
    expect(r.cum).toBeNull()
  })

  it('M0/R0 = 0 是有效值（新车从 0 开始），不被误判为「基线缺失」', () => {
    // 关键语义：0 是合法读数，代码用 != null 而非 truthy 判断
    const fresh: Vehicle = { ...VEHICLE, M0: 0, R0: 200 }
    const r = computeAll(fresh, [
      session({ ts: '2026-01-01T10:00', M: 100, R_start: 50, R_end: 200 })
    ])
    expect(r.segs[0].status).toBe('ok')
    expect(r.cum).not.toBeNull()
  })

  it('R0 = 0 且本段起始车显 > 0 → err（上段车显 0 却出现正起始，中间漏记充电）', () => {
    const odd: Vehicle = { ...VEHICLE, M0: 0, R0: 0 }
    const r = computeAll(odd, [
      session({ ts: '2026-01-01T10:00', M: 100, R_start: 10, R_end: 200 })
    ])
    // dM=100>0、dR=190>0，但 dRdep = 0-10 = -10 < 0
    expect(r.segs[0].status).toBe('err')
    expect(r.segs[0].why?.join('')).toContain('消耗为负')
  })

  it('首段 M0 填成当前里程（dM<=0）→ baseline 而非 err', () => {
    const bad: Vehicle = { ...VEHICLE, M0: 100, R0: 200 }
    const r = computeAll(bad, [
      session({ ts: '2026-01-01T10:00', M: 100, R_start: 10, R_end: 200 })
    ])
    expect(r.segs[0].status).toBe('baseline')
  })

  it('非首段 dM <= 0（里程未增加）→ err 并给出可操作原因', () => {
    const base: Vehicle = { ...VEHICLE, M0: 100, R0: 300 }
    const r = computeAll(base, [
      session({ ts: '2026-01-01T10:00', M: 200, R_start: 10, R_end: 200 }),
      // 第二条里程没涨（200 → 200）
      session({ ts: '2026-01-05T10:00', M: 200, R_start: 10, R_end: 200 })
    ])
    expect(r.segs[1].status).toBe('err')
    expect(r.segs[1].why?.join('')).toContain('行驶里程未增加')
  })

  it('dR <= 0（结束车显 <= 起始车显）→ err', () => {
    const base: Vehicle = { ...VEHICLE, M0: 100, R0: 300 }
    const r = computeAll(base, [
      session({ ts: '2026-01-01T10:00', M: 200, R_start: 200, R_end: 200 })
    ])
    expect(r.segs[0].status).toBe('err')
    expect(r.segs[0].why?.join('')).toContain('车显续航未增加')
  })

  it('dRdep < 0（上段结束车显 < 本段起始，漏记充电）→ err', () => {
    const base: Vehicle = { ...VEHICLE, M0: 100, R0: 100 }
    const r = computeAll(base, [
      session({ ts: '2026-01-01T10:00', M: 150, R_start: 10, R_end: 100 }),
      // 上段 R_end=100，本段 R_start=120 → dRdep = 100-120 < 0
      session({ ts: '2026-01-05T10:00', M: 250, R_start: 120, R_end: 300 })
    ])
    expect(r.segs[1].status).toBe('err')
    expect(r.segs[1].why?.join('')).toContain('消耗为负')
  })
})

describe('computeAll · 充满场景应退化为简单模型', () => {
  it('R_end 恒为满值时，real == E / dM * 100', () => {
    // 电摩场景：充满自停，R_end 恒为 60
    const moto: Vehicle = { ...VEHICLE, B: 1.44, M0: 0, R0: 60 }
    const r = computeAll(moto, [
      session({ ts: '2026-08-21T08:00', E: 2.36, T: 8.15, C: 3.83, M: 51, R_start: 9, R_end: 60 })
    ])
    const seg = r.segs[0]
    expect(seg.status).toBe('ok')

    const dM = 51 - 0
    const expected = (2.36 / dM) * 100
    expect(seg.real).toBe(round(expected))
    // 充满时 k 被约掉，Econs 应等于 E
    expect(seg.Econs).toBe(round(2.36))
  })

  it('上段未充满时，不按整包电量算，而是按车显比例折算', () => {
    const base: Vehicle = { ...VEHICLE, M0: 100, R0: 300 }
    const r = computeAll(base, [
      session({ ts: '2026-01-01T10:00', E: 30, C: 25, M: 250, R_start: 100, R_end: 500 })
    ])
    const seg = r.segs[0]

    const dM = 250 - 100
    const dR = 500 - 100
    const dRdep = 300 - 100
    const k = 30 / dR
    const Econs = k * dRdep

    expect(seg.status).toBe('ok')
    expect(seg.Econs).toBe(round(Econs))
    // 只充了 30 度但消耗了 50 → 折算值必然小于整包电量
    expect(Econs).toBeLessThan(30)
    expect(seg.real).toBe(round((Econs / dM) * 100))
  })
})

describe('computeAll · 均价口径（71.33 尖峰 bug 的回归防线）', () => {
  it('过充场景：均价按消耗占比分摊，不得用整包费用除里程', () => {
    const base: Vehicle = { ...VEHICLE, M0: 100, R0: 400 }
    const r = computeAll(base, [
      // 充 50 度只跑了 30km，若用 C/dM*100 会得到 80 元/100km 的尖峰
      session({ ts: '2026-01-01T10:00', E: 50, C: 45, M: 130, R_start: 50, R_end: 500 })
    ])
    const seg = r.segs[0]

    const dM = 30
    const dR = 450
    const dRdep = 350
    const k = 50 / dR
    const Econs = k * dRdep
    const segCost = 45 * (Econs / 50)
    const expected = (segCost / dM) * 100

    expect(seg.status).toBe('ok')
    expect(seg.price).toBe(round(expected))
    // 旧公式会算出 45/30*100 = 150，必须远低于此
    expect(seg.price!).toBeLessThan(150)
  })

  it('电耗与均价同源：price/real == 单位电价', () => {
    const base: Vehicle = { ...VEHICLE, M0: 100, R0: 400 }
    const r = computeAll(base, [
      session({ ts: '2026-01-01T10:00', E: 40, C: 36, M: 250, R_start: 100, R_end: 500 })
    ])
    const seg = r.segs[0]
    const unitPrice = seg.segCost! / seg.Econs!

    // price = segCost/dM*100，real = Econs/dM*100 → 比值即单位电价
    expect(round(seg.price! / seg.real!, 4)).toBe(round(unitPrice, 4))
  })
})

describe('computeAll · 除零防护', () => {
  it('T = 0 时 power 为 null，不是 Infinity', () => {
    const base: Vehicle = { ...VEHICLE, M0: 100, R0: 400 }
    const r = computeAll(base, [
      session({ ts: '2026-01-01T10:00', E: 30, T: 0, C: 25, M: 250, R_start: 100, R_end: 500 })
    ])
    const seg = r.segs[0]
    expect(seg.status).toBe('ok')
    expect(seg.power).toBeNull()
    expect(Number.isFinite(seg.power as number)).toBe(false)
  })

  it('空记录数组不抛错，cum 为 null', () => {
    const r = computeAll(VEHICLE, [])
    expect(r.segs).toEqual([])
    expect(r.cum).toBeNull()
    expect(r.sorted).toEqual([])
  })
})

describe('computeAll · 累计口径', () => {
  it('累计是先加总再相除，不是各段结果求平均', () => {
    const base: Vehicle = { ...VEHICLE, M0: 1000, R0: 500 }
    const r = computeAll(base, [
      session({ ts: '2026-01-01T10:00', E: 30, C: 25, M: 1200, R_start: 100, R_end: 500 }),
      session({ ts: '2026-01-08T10:00', E: 20, C: 18, M: 1400, R_start: 50, R_end: 500 })
    ])
    expect(r.segs.every((s) => s.status === 'ok')).toBe(true)

    let M = 0, E = 0, C = 0
    r.segs.forEach((s) => {
      M += s.dM!
      E += s.Econs!
      C += s.segCost!
    })
    expect(r.cum!.M).toBe(round(M, 0))
    expect(r.cum!.E).toBe(round(E))
    expect(r.cum!.C).toBe(round(C))
    expect(r.cum!.real).toBe(round((E / M) * 100))
    expect(r.cum!.price).toBe(round((C / M) * 100))
  })

  it('待补全的段不进累计', () => {
    const base: Vehicle = { ...VEHICLE, M0: 1000, R0: 500 }
    const r = computeAll(base, [
      session({ ts: '2026-01-01T10:00', E: 30, C: 25, M: 1200, R_start: 100, R_end: 500 }),
      // 第二条缺车显 → pending
      session({ ts: '2026-01-08T10:00', E: 20, C: 18, M: 1400 })
    ])
    expect(r.segs[1].status).toBe('pending')
    // 累计只含第一段
    expect(r.cum!.M).toBe(200)
  })
})

describe('computeAll · 全量重算与幂等', () => {
  it('同样输入多次计算，结果完全一致', () => {
    const base: Vehicle = { ...VEHICLE, M0: 1000, R0: 500 }
    const data = [
      session({ ts: '2026-01-01T10:00', E: 30, C: 25, M: 1200, R_start: 100, R_end: 500 }),
      session({ ts: '2026-01-08T10:00', E: 20, C: 18, M: 1400, R_start: 50, R_end: 500 })
    ]
    const a = computeAll(base, data)
    const b = computeAll(base, data)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('修改早期记录会影响后续所有段（全量重算的必要性）', () => {
    const base: Vehicle = { ...VEHICLE, M0: 1000, R0: 500 }
    const mk = (rEnd1: number) => [
      session({ ts: '2026-01-01T10:00', E: 30, C: 25, M: 1200, R_start: 100, R_end: rEnd1 }),
      session({ ts: '2026-01-08T10:00', E: 20, C: 18, M: 1400, R_start: 50, R_end: 500 })
    ]
    const before = computeAll(base, mk(400))
    const after = computeAll(base, mk(500))

    // 第一段 dR 变化 → k 变化 → 第二段的 Econs/price 随之变化
    expect(before.segs[1].real).not.toBe(after.segs[1].real)
  })

  it('记录按时间排序后再计算，与输入顺序无关', () => {
    const base: Vehicle = { ...VEHICLE, M0: 1000, R0: 500 }
    const s1 = session({ ts: '2026-01-01T10:00', E: 30, C: 25, M: 1200, R_start: 100, R_end: 500 })
    const s2 = session({ ts: '2026-01-08T10:00', E: 20, C: 18, M: 1400, R_start: 50, R_end: 500 })
    const ordered = computeAll(base, [s1, s2])
    const shuffled = computeAll(base, [s2, s1])
    expect(JSON.stringify(ordered)).toBe(JSON.stringify(shuffled))
  })
})

describe('segSummary', () => {
  it('按状态分类计数', () => {
    const s = segSummary([
      { label: '1', status: 'ok' },
      { label: '2', status: 'ok' },
      { label: '3', status: 'baseline' },
      { label: '4', status: 'pending' },
      { label: '5', status: 'err' }
    ])
    expect(s).toEqual({ ok: 2, baseline: 1, pending: 1, err: 1, total: 5 })
  })
})
