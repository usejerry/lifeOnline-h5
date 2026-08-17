import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { savePreference } from '@/api/me'
import type { Coordinates } from '@/api/explore'
import {
  getQuests,
  getRecommendation,
  type MoodCode,
  type Quest,
  type SceneCode,
} from '@/api/quest'
import {
  abandonQuest as abandonQuestApi,
  acceptQuest as acceptQuestApi,
  completeQuest as completeQuestApi,
  getActiveQuest,
  getCompletedRecords,
  type QuestRecord,
} from '@/api/quest-record'
import { useAuthStore } from './auth'

export type Mood = '松弛' | '新鲜' | '成就感' | '陪伴'
export type AvailableTime = '5分钟' | '20分钟' | '1小时'
export type Scene = '室内' | '室外' | '都可以'

export const moodCode: Record<Mood, MoodCode> = {
  松弛: 'relaxed',
  新鲜: 'fresh',
  成就感: 'achievement',
  陪伴: 'company',
}
export const moodLabel: Record<MoodCode, Mood> = {
  relaxed: '松弛',
  fresh: '新鲜',
  achievement: '成就感',
  company: '陪伴',
}
export const sceneCode: Record<Scene, SceneCode> = {
  室内: 'indoor',
  室外: 'outdoor',
  都可以: 'any',
}
export const sceneLabel: Record<SceneCode, Scene> = {
  indoor: '室内',
  outdoor: '室外',
  any: '都可以',
  online: '都可以',
}
const timeMinutes: Record<AvailableTime, number> = { '5分钟': 5, '20分钟': 20, '1小时': 60 }

export const useJourneyStore = defineStore('journey', () => {
  const auth = useAuthStore()
  const onboarded = ref(false)
  const mood = ref<Mood>('新鲜')
  const availableTime = ref<AvailableTime>('20分钟')
  const scene = ref<Scene>('都可以')
  const quest = ref<Quest | null>(null)
  const quests = ref<Quest[]>([])
  const activeRecord = ref<QuestRecord | null>(null)
  const records = ref<QuestRecord[]>([])
  const loading = ref(false)
  const editingPreference = ref(false)

  const activeQuest = computed(() => activeRecord.value?.quest ?? null)
  const completedCount = computed(
    () => auth.user?.stats.completedQuestCount ?? records.value.length,
  )

  function applyUserPreference() {
    const preference = auth.user?.preference
    onboarded.value = Boolean(preference?.onboarded)
    if (!preference) return
    mood.value = moodLabel[preference.mood]
    availableTime.value =
      preference.availableMinutes === 5
        ? '5分钟'
        : preference.availableMinutes === 60
          ? '1小时'
          : '20分钟'
    scene.value = sceneLabel[preference.scene]
  }

  async function initialize() {
    loading.value = true
    try {
      await auth.loadMe()
      if (!editingPreference.value) applyUserPreference()
      if (auth.user) activeRecord.value = await getActiveQuest()
      if (!activeRecord.value) await loadRecommendation()
    } finally {
      loading.value = false
    }
  }

  async function finishOnboarding() {
    const saved = await savePreference({
      mood: moodCode[mood.value],
      availableMinutes: timeMinutes[availableTime.value],
      scene: sceneCode[scene.value],
    })
    onboarded.value = true
    editingPreference.value = false
    if (auth.user) {
      auth.user.preference = { ...saved, onboarded: true }
    }
    await loadRecommendation()
  }

  async function selectMood(value: Mood) {
    mood.value = value
    if (!activeRecord.value) await loadRecommendation()
  }

  async function loadRecommendation(excludeId?: number) {
    quest.value = await getRecommendation({
      mood: moodCode[mood.value],
      scene: sceneCode[scene.value],
      maxMinutes: timeMinutes[availableTime.value],
      excludeId,
    })
  }

  async function switchQuest() {
    await loadRecommendation(quest.value?.id)
  }

  async function acceptQuest() {
    if (!quest.value) return null
    activeRecord.value = await acceptQuestApi(quest.value.id)
    activeRecord.value.quest = quest.value
    return activeRecord.value
  }

  async function abandonQuest() {
    if (!activeRecord.value) return
    await abandonQuestApi(activeRecord.value.id)
    activeRecord.value = null
    await loadRecommendation()
  }

  async function completeQuest(note: string, image?: File | null, coordinates?: Coordinates) {
    if (!activeRecord.value) return null
    const completed = await completeQuestApi(activeRecord.value.id, note, image, coordinates)
    activeRecord.value = null
    records.value.unshift(completed)
    if (auth.user) auth.user.stats.completedQuestCount += 1
    return completed
  }

  async function loadQuests() {
    quests.value = (await getQuests()).items
  }

  async function loadRecords() {
    records.value = (await getCompletedRecords()).items
  }

  function beginPreferenceSetup() {
    editingPreference.value = true
    onboarded.value = false
  }

  return {
    onboarded,
    mood,
    availableTime,
    scene,
    quest,
    quests,
    activeRecord,
    activeQuest,
    records,
    loading,
    completedCount,
    initialize,
    finishOnboarding,
    selectMood,
    switchQuest,
    acceptQuest,
    abandonQuest,
    completeQuest,
    loadQuests,
    loadRecords,
    beginPreferenceSetup,
  }
})
