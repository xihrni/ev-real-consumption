// 将 SQLite 行（snake_case）映射为前端 TS 模型（camelCase）
export function vehicleRow(r) {
  if (!r) return null
  return {
    id: r.id,
    model: r.model,
    B: r.B,
    Pmax: r.Pmax,
    M0: r.M0,
    R0: r.R0,
    color: r.color ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function sessionRow(r) {
  if (!r) return null
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    ts: r.ts,
    E: r.E,
    T: r.T,
    C: r.C,
    M: r.M ?? null,
    R_start: r.R_start ?? null,
    R_end: r.R_end ?? null,
    meter: r.meter ?? null,
    ctype: r.ctype ?? null,
    note: r.note ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}
