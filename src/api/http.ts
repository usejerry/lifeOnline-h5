import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

interface ApiResponse<T> {
  code: string
  success: boolean
  message: string
  data: T
}

interface RetryConfig extends InternalAxiosRequestConfig {
  authRetried?: boolean
  authRevision?: number
}
interface TokenResponse {
  accessToken: string
  expiresIn: number
}
interface StoredAccessToken {
  token: string
  expiresAt: number
}
function readStoredToken(): StoredAccessToken | null {
  try {
    const value = JSON.parse(
      localStorage.getItem('access_token') ?? 'null',
    ) as StoredAccessToken | null
    return value && typeof value.token === 'string' && Number.isFinite(value.expiresAt)
      ? value
      : null
  } catch {
    return null
  }
}
const initialToken = readStoredToken()
let accessToken: string | null = initialToken?.token ?? null
let expiresAt = initialToken?.expiresAt ?? 0
let refreshPromise: Promise<string> | null = null
let restorePromise: Promise<void> | null = null
let authRevision = 0
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('life-online-auth') : null
export function getAccessToken() {
  return accessToken
}
function hasValidAccessToken() {
  return Boolean(accessToken && expiresAt > Date.now())
}
export function setAccessToken(token: string, expiresIn: number) {
  accessToken = token
  expiresAt = Date.now() + expiresIn * 1000
  localStorage.setItem('access_token', JSON.stringify({ token, expiresAt }))
}

export function clearAccessToken() {
  accessToken = null
  expiresAt = 0
  authRevision += 1
  localStorage.removeItem('access_token')
  sessionStorage.removeItem('access_token')
  window.dispatchEvent(new Event('auth:cleared'))
}

export function notifyAuthChange() {
  channel?.postMessage('changed')
}
if (channel)
  channel.onmessage = () => {
    // 其他标签页已更新共享存储；这里只清本页状态，不能删除新登录的 Token。
    authRevision += 1
    accessToken = null
    expiresAt = 0
    window.dispatchEvent(new Event('auth:cleared'))
    const stored = readStoredToken()
    accessToken = stored?.token ?? null
    expiresAt = stored?.expiresAt ?? 0
    restorePromise = null
  }

// 所有标签页共用锁，避免同时消费同一个 Refresh Token。
export function withAuthLock<T>(action: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    return Promise.reject(
      new Error('登录需要支持 Web Locks 的浏览器和 HTTPS（本地可用 localhost）'),
    )
  return navigator.locks.request('life-online-refresh', action)
}

const options = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
  withCredentials: true,
  headers: { 'X-Auth-Request': '1' },
}
export const http = axios.create(options)
// 不安装自动刷新拦截器，防止刷新接口递归。
export const authHttp = axios.create(options)

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise
  const revision = authRevision
  refreshPromise = withAuthLock(async () => {
    if (revision !== authRevision) throw new Error('登录状态已改变，请重试')
    const stored = readStoredToken()
    if (stored && stored.token !== accessToken && stored.expiresAt > Date.now()) {
      accessToken = stored.token
      expiresAt = stored.expiresAt
      return stored.token
    }
    const response = await authHttp.post<ApiResponse<TokenResponse>>('/v1/auth/refresh')
    if (revision !== authRevision) throw new Error('登录状态已改变，请重试')
    setAccessToken(response.data.data.accessToken, response.data.data.expiresIn)
    return response.data.data.accessToken
  })
    .catch((error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        clearAccessToken()
        notifyAuthChange()
      }
      throw error
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

export function restoreSession(): Promise<void> {
  if (hasValidAccessToken()) return Promise.resolve()
  if (!restorePromise) {
    restorePromise = refreshAccessToken()
      .then(() => {})
      .catch((error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) return
        restorePromise = null
        throw error
      })
      .finally(() => {
        restorePromise = null
      })
  }
  return restorePromise
}

http.interceptors.request.use(async (config) => {
  const authConfig = config as RetryConfig
  authConfig.authRevision ??= authRevision
  if (authConfig.authRevision !== authRevision) throw new Error('登录状态已改变，请重新操作')
  if (accessToken && !hasValidAccessToken() && !authConfig.authRetried) await refreshAccessToken()
  if (authConfig.authRevision !== authRevision) throw new Error('登录状态已改变，请重新操作')
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError<ApiResponse<null>>(error)) throw error
    const config = error.config as RetryConfig | undefined
    if (!config || error.response?.status !== 401) throw error
    if (config.authRevision !== authRevision) throw error
    // 退出或切换账号后迟到的旧响应不能触发续期，也不能清除新登录。
    if (
      !accessToken ||
      (config.headers.Authorization !== `Bearer ${accessToken}` &&
        error.response.data?.code !== 'ACCESS_TOKEN_EXPIRED')
    )
      throw error
    if (error.response.data?.code === 'ACCESS_TOKEN_EXPIRED' && !config.authRetried) {
      config.authRetried = true
      const sentToken = config.headers.Authorization
      const token =
        accessToken && sentToken !== `Bearer ${accessToken}`
          ? accessToken
          : await refreshAccessToken()
      config.headers.Authorization = `Bearer ${token}`
      return http.request(config)
    }
    if (config.headers.Authorization) {
      clearAccessToken()
      notifyAuthChange()
    }
    throw error
  },
)

export async function request<T>(config: AxiosRequestConfig) {
  const response = await http.request<ApiResponse<T>>(config)
  return response.data.data
}
