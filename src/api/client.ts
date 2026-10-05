// 统一的 API 客户端：注入 Bearer token、统一错误处理。
// 开发态由 Vite 代理 /api -> :3000；生产态由 Express 同域托管，均走相对路径。

const TOKEN_KEY = 'ev_token_v1'

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

let authToken: string | null = readToken()

export function setToken(t: string | null) {
  authToken = t
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 忽略存储不可用 */
  }
}

export function getToken(): string | null {
  return authToken
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`)

  const res = await fetch(`/api${path}`, { ...options, headers })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error)
        : `请求失败 (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return data as T
}
