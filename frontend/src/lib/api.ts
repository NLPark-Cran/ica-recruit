/** 统一 fetch 封装：JSON、错误处理、10s 超时 + GET 一次重试、401 跳登录 */

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** 401 时是否自动跳转 /login（默认 true） */
  redirectOn401?: boolean
  timeoutMs?: number
}

function extractMessage(status: number, data: unknown): string {
  if (data && typeof data === 'object') {
    const detail = (data as Record<string, unknown>).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object') {
      const msg = (detail[0] as Record<string, unknown>).msg
      if (typeof msg === 'string') return msg.replace(/^Value error,\s*/i, '')
    }
    const message = (data as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  if (status === 401) return '请先登录'
  if (status === 403) return '没有访问权限'
  if (status === 429) return '请求太频繁，请稍后再试'
  if (status >= 500) return '服务器开小差了，请稍后再试'
  return `请求失败（${status}）`
}

function redirectToLogin() {
  if (window.location.pathname === '/login') return
  const next = window.location.pathname + window.location.search
  window.location.href = `/login?next=${encodeURIComponent(next)}`
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', body, redirectOn401 = true, timeoutMs = 10_000 } = options
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } finally {
    window.clearTimeout(timer)
  }

  if (res.status === 401) {
    if (redirectOn401) redirectToLogin()
    throw new ApiError(401, '请先登录')
  }
  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(res.status, data), data)
  }
  return data as T
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET' } = options
  try {
    return await rawRequest<T>(path, options)
  } catch (e) {
    // 弱网兜底：GET 请求在网络错误/超时时自动重试一次
    const retriable =
      method === 'GET' &&
      (e instanceof TypeError || (e instanceof DOMException && e.name === 'AbortError'))
    if (retriable) {
      return await rawRequest<T>(path, options)
    }
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(0, '网络超时，请检查网络后重试')
    }
    if (e instanceof TypeError) {
      throw new ApiError(0, '网络连接失败，请检查网络后重试')
    }
    throw e
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  del: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}

/** 从 unknown 错误里提取可展示的信息 */
export function errorMessage(e: unknown, fallback = '操作失败，请稍后再试'): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error && e.message) return e.message
  return fallback
}
