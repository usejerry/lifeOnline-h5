import { request } from './http'

export type MessageType = 'daily_sign_in_reminder' | 'quest_deadline_reminder'

export interface UserMessage {
  id: number
  type: MessageType
  title: string
  content: string
  businessId: string | null
  payload: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export interface MessageListResponse {
  items: UserMessage[]
  total: number
  page: number
  pageSize: number
}

export const getMessages = (page: number, pageSize = 20) =>
  request<MessageListResponse>({
    method: 'GET',
    url: '/v1/messages',
    params: { page, pageSize },
  })

export const getUnreadMessageCount = () =>
  request<{ count: number }>({ method: 'GET', url: '/v1/messages/unread-count' })

export const markMessageAsRead = (id: number) =>
  request<UserMessage>({ method: 'PATCH', url: `/v1/messages/${id}/read` })

export const markAllMessagesAsRead = () =>
  request<{ affected: number }>({ method: 'PATCH', url: '/v1/messages/read-all' })
