import { authHttp, request, restoreSession, withAuthLock, getAccessToken } from './http'

export interface LoginPayload {
  account: string
  password: string
  rememberMe: boolean
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number
  user: {
    id: number
    username: string
    email: string | null
    lastLoginAt: string
  }
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
}

export interface RegisterResponse {
  id: number
  username: string
  email: string | null
}

export const login = (payload: LoginPayload) =>
  authHttp
    .post<{ data: LoginResponse }>('/v1/user/login', payload)
    .then((response) => response.data.data)

export const logout = () => authHttp.post('/v1/auth/logout')
export const logoutAll = async () => {
  await restoreSession()
  return withAuthLock(() =>
    authHttp.post('/v1/auth/logout-all', null, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    }),
  )
}
export interface LoginSession {
  id: string
  userAgent: string
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  current: boolean
}
export const getSessions = () => request<LoginSession[]>({ url: '/v1/auth/sessions' })
export const revokeSession = (id: string) =>
  request({ method: 'DELETE', url: `/v1/auth/sessions/${id}` })

export const register = (payload: RegisterPayload) =>
  request<RegisterResponse>({ method: 'POST', url: '/v1/user/register', data: payload })
