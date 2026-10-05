import { request, setToken } from './client'

export interface AuthUser {
  id: string
  email: string
}
export interface AuthResult {
  token: string
  user: AuthUser
}

export async function register(email: string, password: string): Promise<AuthResult> {
  const r = await request<AuthResult>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
  setToken(r.token)
  return r
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const r = await request<AuthResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
  setToken(r.token)
  return r
}

export function logout(): void {
  setToken(null)
}

export async function me(): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/me')
}
