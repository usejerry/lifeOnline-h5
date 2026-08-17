import { request } from './http'
import type { MoodCode, SceneCode } from './quest'

export interface Preference {
  mood: MoodCode
  availableMinutes: number
  scene: SceneCode
  onboarded: boolean
  onboardedAt: string
}

export interface MeResponse {
  id: number
  username: string
  email: string | null
  preference: Preference | null
  stats: { completedQuestCount: number }
}

export interface PreferencePayload {
  mood: MoodCode
  availableMinutes: number
  scene: SceneCode
}

export const getMe = () => request<MeResponse>({ method: 'GET', url: '/v1/me' })

export const savePreference = (data: PreferencePayload) =>
  request<Omit<Preference, 'onboarded'>>({ method: 'PUT', url: '/v1/me/preference', data })
