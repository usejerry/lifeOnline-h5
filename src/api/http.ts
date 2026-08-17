import axios, { type AxiosRequestConfig } from 'axios'

interface ApiResponse<T> {
  code: string
  success: boolean
  message: string
  data: T
}

export function getAccessToken() {
  return localStorage.getItem('access_token') || sessionStorage.getItem('access_token')
}

export function clearAccessToken() {
  localStorage.removeItem('access_token')
  sessionStorage.removeItem('access_token')
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
})

http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) clearAccessToken()
    return Promise.reject(error)
  },
)

export async function request<T>(config: AxiosRequestConfig) {
  const response = await http.request<ApiResponse<T>>(config)
  return response.data.data
}
