/**
 * 字段级校验（对应需求文档 §11 校验规则 + F-10 异常提示）。
 * 返回 errors（阻断保存）与 warnings（仅提示、不阻断）。
 */

export interface FieldErrors {
  [field: string]: string
}

const isBad = (v: number | null | undefined) => v == null || isNaN(v)

export function validateVehicle(input: {
  model: string
  B: number | null
  Pmax: number | null
  M0: number | null
  R0: number | null
}): FieldErrors {
  const e: FieldErrors = {}
  if (!input.model || !input.model.trim()) e.model = '请填写车型'
  if (isBad(input.B) || (input.B as number) <= 0) e.B = '电池容量需大于 0'
  if (isBad(input.Pmax) || (input.Pmax as number) <= 0) e.Pmax = '最大功率需大于 0'
  if (isBad(input.M0) || (input.M0 as number) < 0) e.M0 = '初始里程需 ≥ 0'
  if (isBad(input.R0) || (input.R0 as number) < 0) e.R0 = '初始车显剩余需 ≥ 0'
  return e
}

export function validateSession(input: {
  E: number | null
  T: number | null
  C: number | null
  M?: number | null
  R_start?: number | null
  R_end?: number | null
  prevM?: number | null
}): { errors: FieldErrors; warnings: FieldErrors } {
  const errors: FieldErrors = {}
  const warnings: FieldErrors = {}

  // 阶段一必填（来自充电 App）
  if (isBad(input.E) || (input.E as number) <= 0) errors.E = '充电度数需大于 0'
  if (isBad(input.T) || (input.T as number) <= 0) errors.T = '充电时长需大于 0'
  if (isBad(input.C) || (input.C as number) < 0) errors.C = '金额需 ≥ 0'

  // 阶段二可选字段：填了才校验（§11）
  if (input.M != null && input.prevM != null && input.M <= input.prevM) {
    errors.M = `当前里程需大于上一条的 ${input.prevM} km`
  }
  if (input.R_start != null && input.R_end != null) {
    if (input.R_end <= input.R_start) {
      errors.R_end = '结束车显需大于起始车显（充电须增加续航）'
    } else if (input.R_end - input.R_start < 5) {
      warnings.R_end = '车显变化过小（<5km），测算误差可能较大'
    }
  }
  return { errors, warnings }
}
