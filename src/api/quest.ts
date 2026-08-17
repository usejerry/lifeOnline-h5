import { request } from './http'

export type MoodCode = 'relaxed' | 'fresh' | 'achievement' | 'company'
export type SceneCode = 'indoor' | 'outdoor' | 'any' | 'online'

export interface Quest {
  id: number
  mood: MoodCode
  title: string
  durationMinutes: number
  durationLabel?: string
  distanceLabel: string
  scene: SceneCode
  settingLabel: string
  prompt: string
}

interface QuestListResponse {
  items: Quest[]
  page: number
  pageSize: number
  total: number
}

export const getQuests = () =>
  request<QuestListResponse>({ method: 'GET', url: '/v1/quests', params: { pageSize: 100 } })

export const getRecommendation = (params: {
  mood: MoodCode
  scene: SceneCode
  maxMinutes: number
  excludeId?: number
}) => request<Quest>({ method: 'GET', url: '/v1/quests/recommendation', params })
