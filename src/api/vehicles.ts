import { request } from './client'
import type { Vehicle } from '../types'

export async function getVehicles(): Promise<Vehicle[]> {
  const r = await request<{ vehicles: Vehicle[] }>('/vehicles')
  return r.vehicles
}

export async function createVehicle(
  v: Partial<Vehicle> & { model: string }
): Promise<Vehicle> {
  const r = await request<{ vehicle: Vehicle }>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(v)
  })
  return r.vehicle
}

export async function updateVehicle(
  id: string,
  patch: Partial<Vehicle>
): Promise<Vehicle> {
  const r = await request<{ vehicle: Vehicle }>(`/vehicles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch)
  })
  return r.vehicle
}

export async function deleteVehicle(id: string): Promise<void> {
  await request<{ ok: boolean }>(`/vehicles/${id}`, { method: 'DELETE' })
}
