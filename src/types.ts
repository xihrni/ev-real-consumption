export interface Vehicle {
  id: string
  model: string
  B: number          // 电池容量 kWh
  Pmax: number       // 最大充电功率 kW
  M0: number         // 初始里程（基线，km）
  R0: number         // 初始车显剩余里程（基线，km）
  color?: string     // 车辆主题色（多车辆区分）
  createdAt?: number
  updatedAt?: number
}

export interface ChargeSession {
  id: string
  vehicleId?: string
  ts: string            // 充电时间（datetime-local 字符串）
  E: number             // 充电度数 kWh
  T: number             // 充电时长 h
  C: number             // 总价 ¥
  M: number | null      // 当前里程 km（可选）
  R_start: number | null // 起始车显剩余 km（可选）
  R_end: number | null   // 结束车显剩余 km（可选）
  meter?: 'battery' | 'grid' | null // 度数口径：电池端 / 电网端（风险#1 口径一致）
  ctype?: 'home' | 'fast' | 'other' | null // 充电类型：家充 / 超充 / 其他（用于分组统计）
  note?: string | null
  createdAt: number
  updatedAt: number
}

export type SegStatus = 'ok' | 'baseline' | 'pending' | 'err'

export interface Segment {
  label: string
  status: SegStatus
  dM?: number
  real?: number
  price?: number
  disp?: number
  power?: number | null
  Econs?: number
  segCost?: number
  dRdep?: number
  dR?: number
  why?: string[]
}

export interface Cum {
  real: number
  price: number
  M: number
  E: number
  C: number
}

export interface ComputeResult {
  segs: Segment[]
  cum: Cum | null
  sorted: ChargeSession[]
}
