import { request } from './client'
import type { ChargeSession } from '../types'

export async function getSessions(vehicleId?: string): Promise<ChargeSession[]> {
  const q = vehicleId ? `?vehicleId=${encodeURIComponent(vehicleId)}` : ''
  const r = await request<{ sessions: ChargeSession[] }>(`/sessions${q}`)
  return r.sessions
}

export async function createSession(
  s: Partial<ChargeSession> & { ts: string; vehicleId?: string }
): Promise<ChargeSession> {
  const r = await request<{ session: ChargeSession }>('/sessions', {
    method: 'POST',
    body: JSON.stringify(s)
  })
  return r.session
}

export async function updateSession(
  id: string,
  patch: Partial<ChargeSession>
): Promise<ChargeSession> {
  const r = await request<{ session: ChargeSession }>(`/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch)
  })
  return r.session
}

export async function deleteSession(id: string): Promise<void> {
  await request<{ ok: boolean }>(`/sessions/${id}`, { method: 'DELETE' })
}
