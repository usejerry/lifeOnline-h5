import { request } from './http'

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
  request<LoginResponse>({ method: 'POST', url: '/v1/user/login', data: payload })

export const register = (payload: RegisterPayload) =>
  request<RegisterResponse>({ method: 'POST', url: '/v1/user/register', data: payload })
