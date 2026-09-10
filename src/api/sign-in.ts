import { request } from './http'

export interface SignInRecord {
  id: number
  checkInDate: string
  createdAt: string
}
export interface SignInToday {
  signedIn: boolean
  record: SignInRecord | null
  total: number
}
export interface SignInHistory {
  items: SignInRecord[]
  total: number
  page: number
  pageSize: number
}
interface SignInCheckResponse {
  signedIn: boolean
  record: SignInRecord | null
}
interface SignInRecordsResponse {
  records: SignInRecord[]
  total: number
  page: number
  pageSize: number
}

export const getSignInToday = async (): Promise<SignInToday> => {
  const [status, history] = await Promise.all([
    request<SignInCheckResponse>({ method: 'POST', url: '/v1/sign-in/check' }),
    request<SignInRecordsResponse>({
      method: 'POST',
      url: '/v1/sign-in/record',
      data: { page: 1, pageSize: 1 },
    }),
  ])
  return { ...status, total: history.total }
}
export const signInToday = () => request<string | false>({ method: 'POST', url: '/v1/sign-in' })
export const getSignInHistory = async (page: number): Promise<SignInHistory> => {
  const result = await request<SignInRecordsResponse>({
    method: 'POST',
    url: '/v1/sign-in/record',
    data: { page, pageSize: 10 },
  })
  return {
    items: result.records,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  }
}
