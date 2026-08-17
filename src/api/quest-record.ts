import { request } from './http'
import type { Quest } from './quest'
import type { Coordinates, NearbyQuest } from './explore'

export type QuestRecordStatus = 'accepted' | 'completed' | 'abandoned'

export interface QuestRecord {
  id: number
  questId: number
  questTitle: string
  status: QuestRecordStatus
  note: string | null
  imageUrl: string | null
  acceptedAt: string
  completedAt: string | null
  abandonedAt: string | null
  quest?: Quest
  target: {
    poiId: string | null
    name: string | null
    address: string | null
    longitude: number
    latitude: number
    completionRadiusM: number
  } | null
  completion:
    | (Coordinates & {
        distanceM: number | null
        cityAdcode: string | null
        cityName: string | null
      })
    | null
}

interface QuestRecordListResponse {
  items: QuestRecord[]
  page: number
  pageSize: number
  total: number
}

export const acceptQuest = (quest: number | NearbyQuest) =>
  request<QuestRecord>({
    method: 'POST',
    url: '/v1/quest-records',
    data:
      typeof quest === 'number'
        ? { questId: quest }
        : {
            questId: quest.id,
            poiId: quest.poiId,
            targetName: quest.targetName,
            targetAddress: quest.targetAddress,
            longitude: quest.longitude,
            latitude: quest.latitude,
          },
  })

export const getActiveQuest = () =>
  request<QuestRecord | null>({ method: 'GET', url: '/v1/quest-records/active' })

export const abandonQuest = (id: number) =>
  request<QuestRecord>({ method: 'PATCH', url: `/v1/quest-records/${id}/abandon` })

export const completeQuest = (
  id: number,
  note: string,
  image?: File | null,
  coordinates?: Coordinates,
) => {
  const data = new FormData()
  if (note.trim()) data.append('note', note.trim())
  if (image) data.append('image', image)
  if (coordinates) {
    data.append('longitude', String(coordinates.longitude))
    data.append('latitude', String(coordinates.latitude))
  }
  return request<QuestRecord>({ method: 'POST', url: `/v1/quest-records/${id}/complete`, data })
}

export const getCompletedRecords = () =>
  request<QuestRecordListResponse>({
    method: 'GET',
    url: '/v1/quest-records',
    params: { status: 'completed', page: 1, pageSize: 100 },
  })
