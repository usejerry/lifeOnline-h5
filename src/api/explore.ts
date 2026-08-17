import { request } from './http'
import type { Quest } from './quest'

export interface Coordinates {
  longitude: number
  latitude: number
}

export interface NearbyQuest extends Quest, Coordinates {
  markerId: string
  poiId: string | null
  targetName: string | null
  targetAddress: string | null
  distanceM: number
  completionRadiusM: number
  requiresDiscovery: boolean
}

export interface ExploreContext {
  cityAdcode: string | null
  cityName: string | null
  weather: { weather: string; temperature: number | null } | null
  mapWebServiceConfigured: boolean
}

export interface WeeklyTheme {
  id: number
  title: string
  subtitle: string | null
  description: string | null
  coverUrl: string | null
  startAt: string
  endAt: string
}

interface NearbyQuestResponse {
  items: NearbyQuest[]
  context: ExploreContext
}

interface QuestLibraryItem {
  questId: number
  savedAt: string | null
  discoveredAt: string | null
}

export const getNearbyQuests = (coordinates: Coordinates, radius = 5000, cityAdcode?: string) =>
  request<NearbyQuestResponse>({
    method: 'GET',
    url: '/v1/quests/nearby',
    params: { ...coordinates, radius, cityAdcode },
  })

export const getCurrentTheme = () =>
  request<WeeklyTheme | null>({ method: 'GET', url: '/v1/themes/current' })

export const getQuestLibrary = (kind: 'saved' | 'discovered') =>
  request<QuestLibraryItem[]>({
    method: 'GET',
    url: '/v1/me/quest-library',
    params: { kind },
  })

export const saveQuest = (questId: number) =>
  request({ method: 'PUT', url: `/v1/me/quest-library/${questId}/save` })

export const unsaveQuest = (questId: number) =>
  request({ method: 'DELETE', url: `/v1/me/quest-library/${questId}/save` })

export const discoverQuest = (questId: number, coordinates: Coordinates) =>
  request({ method: 'POST', url: `/v1/quests/${questId}/discover`, data: coordinates })
