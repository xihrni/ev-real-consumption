import type { Vehicle, ChargeSession, ComputeResult, Segment } from '../types'
import { round } from './format'

/**
 * 混合充电测算引擎（全量重算）。
 * 用车显剩余里程作为"电量代理"：k = E / (R_end - R_start) 表示每车显公里对应多少电；
 * 本段真实耗电 = k × (上段结束车显 - 本段起始车显)，从而兼容充满与部分充电。
 *
 * 首段用基线 M0/R0。首段若无有效基准（M0 缺失或填成当前里程）则标记为"基准"，
 * 仅建立起点、不参与消耗计算；从第二段开始测算，避免一刀切报异常。
 */
export function computeAll(vehicle: Vehicle | null, sessions: ChargeSession[]): ComputeResult {
  const segs: Segment[] = []
  let cumM = 0, cumE = 0, cumC = 0

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  )

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]
    const prev =
      i === 0
        ? { M: vehicle?.M0 ?? null, R_end: vehicle?.R0 ?? null }
        : sorted[i - 1].M != null && sorted[i - 1].R_end != null
          ? { M: sorted[i - 1].M, R_end: sorted[i - 1].R_end }
          : null

    const hasPrev = !!prev && prev.M != null && prev.R_end != null
    const hasCur = cur.E != null && cur.R_start != null && cur.R_end != null && cur.M != null

    if (!hasCur) {
      segs.push({ label: '#' + (i + 1), status: 'pending' })
      continue
    }
    // 首段无有效基准：作为"基准记录"，建立起点，本段不参与消耗计算
    if (!hasPrev) {
      segs.push({ label: '#' + (i + 1), status: 'baseline' })
      continue
    }

    const dM = cur.M! - prev.M!
    const dR = cur.R_end! - cur.R_start!
    const dRdep = prev.R_end! - cur.R_start!

    // 首段基准（M0）不合理时同样视为基准，避免一刀切报异常
    if (i === 0 && dM <= 0) {
      segs.push({ label: '#' + (i + 1), status: 'baseline' })
      continue
    }

    if (dM <= 0 || dR <= 0 || dRdep < 0) {
      const why: string[] = []
      if (dM <= 0)
        why.push(
          `行驶里程未增加(dM=${dM.toFixed(1)})，请确认 M(${cur.M}) > 上段里程(${prev.M})`
        )
      if (dR <= 0)
        why.push(
          `车显续航未增加(dR=${dR.toFixed(1)})，请确认 结束车显(${cur.R_end}) > 起始车显(${cur.R_start})`
        )
      if (dRdep < 0)
        why.push(
          `消耗为负(dRdep=${dRdep.toFixed(1)})，上段结束车显(${prev.R_end}) < 本段起始车显(${cur.R_start})，可能遗漏了中间充电记录`
        )
      segs.push({ label: '#' + (i + 1), status: 'err', dM, dR, dRdep, why })
      continue
    }

    const k = cur.E / dR
    const Econs = k * dRdep
    const real = (Econs / dM) * 100
    // FIX: 均价与真实电耗使用同一套建模口径
    // 原公式 price = C/dM*100 用了"整包充电费"，当 overcharge 时会被 dR/dRdep 倍放大
    // 新公式：先算本次充电单价，再按本段实际消耗占比归因费用
    const segCost = cur.E > 0 ? cur.C * (Econs / cur.E) : 0
    const price = (segCost / dM) * 100
    const disp = k * 100
    // 充电时长为 0 时功率无意义，置 null 避免除零产生 Infinity 污染「平均功率」
    const power = cur.T > 0 ? round(cur.E / cur.T, 1) : null

    segs.push({
      label: '#' + (i + 1),
      status: 'ok',
      dM,
      real: round(real),
      price: round(price),
      disp: round(disp),
      power: power == null ? null : round(power, 1),
      Econs: round(Econs),
      segCost: round(segCost),
      dRdep,
      dR
    })
    cumM += dM
    cumE += Econs
    cumC += segCost
  }

  const cum =
    cumM > 0
      ? {
          real: round((cumE / cumM) * 100),
          price: round((cumC / cumM) * 100),
          M: round(cumM, 0),
          E: round(cumE),
          C: round(cumC)
        }
      : null

  return { segs, cum, sorted }
}

/** 段状态统计 */
export function segSummary(segs: Segment[]) {
  return {
    ok: segs.filter((s) => s.status === 'ok').length,
    baseline: segs.filter((s) => s.status === 'baseline').length,
    pending: segs.filter((s) => s.status === 'pending').length,
    err: segs.filter((s) => s.status === 'err').length,
    total: segs.length
  }
}
