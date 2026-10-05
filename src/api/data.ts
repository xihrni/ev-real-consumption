import { request } from './client'
import type { Vehicle, ChargeSession } from '../types'

export interface ReplaceAllInput {
  vehicles?: Vehicle[]
  vehicle?: Vehicle | null
  sessions?: ChargeSession[]
}

export async function seedDemo(): Promise<{ vehicles: Vehicle[]; sessions: ChargeSession[] }> {
  return request<{ vehicles: Vehicle[]; sessions: ChargeSession[] }>('/seed-demo', {
    method: 'POST'
  })
}

export async function replaceAll(
  data: ReplaceAllInput
): Promise<{ vehicles: Vehicle[]; sessions: ChargeSession[] }> {
  const vehicles = Array.isArray(data.vehicles)
    ? data.vehicles
    : data.vehicle
      ? [data.vehicle]
      : []
  const sessions = Array.isArray(data.sessions) ? data.sessions : []
  return request<{ vehicles: Vehicle[]; sessions: ChargeSession[] }>('/replace-all', {
    method: 'POST',
    body: JSON.stringify({ vehicles, sessions })
  })
}

export async function deleteAll(): Promise<void> {
  await request<{ ok: boolean }>('/data', { method: 'DELETE' })
}
