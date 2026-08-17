<script setup lang="ts">
import { PhArrowRight, PhCloudSun, PhSparkle, PhStar } from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  discoverQuest,
  getCurrentTheme,
  getNearbyQuests,
  getQuestLibrary,
  saveQuest,
  type Coordinates,
  type ExploreContext,
  type NearbyQuest,
  type WeeklyTheme,
  unsaveQuest,
} from '@/api/explore'
import { getAccessToken } from '@/api/http'
import { acceptQuest } from '@/api/quest-record'
import ExploreMap from '@/components/ExploreMap.vue'
import { getBrowserPosition, getIpPosition } from '@/utils/geolocation'

type ExploreMode = 'map' | 'list' | 'saved'

const guangzhouBrowsePosition = {
  coordinates: { longitude: 113.2806, latitude: 23.1251 },
  accuracyM: 0,
  cityAdcode: '440100',
  cityName: '广州市',
}

const router = useRouter()
const route = useRoute()
const mode = ref<ExploreMode>('map')
const quests = ref<NearbyQuest[]>([])
const selectedQuest = ref<NearbyQuest | null>(null)
const savedIds = ref<number[]>([])
const discoveredIds = ref<number[]>([])
const coordinates = ref<Coordinates | null>(null)
const locationAccuracyM = ref<number | null>(null)
const locationSource = ref<'device' | 'ip' | 'city' | null>(null)
const locationCityName = ref('')
const locationError = ref('')
const locating = ref(false)
const context = ref<ExploreContext | null>(null)
const weeklyTheme = ref<WeeklyTheme | null>(null)
const loading = ref(true)
const accepting = ref(false)
const saving = ref(false)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const visibleQuests = computed(() =>
  mode.value === 'saved'
    ? quests.value.filter((quest) => savedIds.value.includes(quest.id))
    : quests.value,
)

const isSaved = computed(() =>
  selectedQuest.value ? savedIds.value.includes(selectedQuest.value.id) : false,
)
const needsDiscovery = computed(
  () =>
    Boolean(selectedQuest.value?.requiresDiscovery) &&
    !discoveredIds.value.includes(selectedQuest.value!.id),
)
const weatherLabel = computed(() => {
  if (!coordinates.value) return '等待真实定位'
  const weather = context.value?.weather
  if (!weather) return '天气数据待接入'
  return `${weather.temperature ?? '--'}°C ${weather.weather}`
})

function showToast(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

function selectQuest(quest: NearbyQuest) {
  selectedQuest.value = quest
  if (mode.value !== 'map') mode.value = 'map'
}

function locationLabel(quest: NearbyQuest) {
  return quest.targetName || quest.targetAddress || quest.settingLabel
}

async function requireLogin() {
  if (getAccessToken()) return false
  await router.push({ name: 'login', query: { redirect: route.fullPath } })
  return true
}

async function toggleSaved() {
  if (!selectedQuest.value || saving.value || (await requireLogin())) return
  const id = selectedQuest.value.id
  saving.value = true
  try {
    if (savedIds.value.includes(id)) {
      await unsaveQuest(id)
      savedIds.value = savedIds.value.filter((savedId) => savedId !== id)
      showToast('已取消收藏')
    } else {
      await saveQuest(id)
      savedIds.value.push(id)
      showToast('已加入稍后完成')
    }
  } catch {
    showToast('收藏操作失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

async function handleAccept() {
  if (!selectedQuest.value || !coordinates.value || accepting.value) return
  if (await requireLogin()) return

  accepting.value = true
  try {
    if (needsDiscovery.value) {
      if (locationSource.value !== 'device') {
        showToast('发现隐藏支线需要开启精确定位')
        return
      }
      await discoverQuest(selectedQuest.value.id, coordinates.value)
      discoveredIds.value.push(selectedQuest.value.id)
      showToast('发现了一条隐藏支线')
      return
    }
    await acceptQuest(selectedQuest.value)
    await router.push('/today')
  } catch {
    showToast('接受失败，请稍后重试')
  } finally {
    accepting.value = false
  }
}

watch(visibleQuests, (quests) => {
  if (!selectedQuest.value || !quests.some((quest) => quest.id === selectedQuest.value?.id)) {
    selectedQuest.value = quests[0] ?? null
  }
})

async function loadLocationAndQuests() {
  locating.value = true
  locationError.value = ''
  try {
    let position
    try {
      position = await getBrowserPosition()
      locationSource.value = 'device'
    } catch {
      try {
        const ipPosition = await getIpPosition()
        const isGuangzhou =
          ipPosition.cityAdcode?.startsWith('4401') || ipPosition.cityName?.includes('广州')
        position = isGuangzhou ? ipPosition : guangzhouBrowsePosition
        locationSource.value = isGuangzhou ? 'ip' : 'city'
      } catch {
        position = guangzhouBrowsePosition
        locationSource.value = 'city'
      }
    }
    coordinates.value = position.coordinates
    locationAccuracyM.value = position.accuracyM
    locationCityName.value = position.cityName ?? ''
    const nearby = await getNearbyQuests(position.coordinates, 50_000, position.cityAdcode)
    // IP 位置不能证明用户真正靠近隐藏任务，避免产生错误解锁入口。
    quests.value = nearby.items.filter(
      (quest) => locationSource.value === 'device' || !quest.requiresDiscovery,
    )
    context.value = nearby.context
    selectedQuest.value = quests.value[0] ?? null
  } catch {
    coordinates.value = null
    locationAccuracyM.value = null
    locationSource.value = null
    locationCityName.value = ''
    quests.value = []
    selectedQuest.value = null
    context.value = null
    locationError.value = '无法取得真实定位，请允许浏览器访问位置后重试。'
  } finally {
    locating.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    weeklyTheme.value = await getCurrentTheme()

    if (getAccessToken()) {
      const [saved, discovered] = await Promise.all([
        getQuestLibrary('saved'),
        getQuestLibrary('discovered'),
      ])
      savedIds.value = saved.map((item) => item.questId)
      discoveredIds.value = discovered.map((item) => item.questId)
    }
    await loadLocationAndQuests()
  } catch {
    showToast('探索内容加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="explore-shell">
    <section class="map-stage" aria-label="附近支线地图">
      <header class="explore-header">
        <div class="title-row">
          <h1>探索附近</h1>
          <p><PhCloudSun /> {{ weatherLabel }}</p>
        </div>

        <div class="mode-tabs" role="tablist" aria-label="探索方式">
          <button :class="{ active: mode === 'map' }" role="tab" @click="mode = 'map'">地图</button>
          <button :class="{ active: mode === 'list' }" role="tab" @click="mode = 'list'">
            列表
          </button>
          <button :class="{ active: mode === 'saved' }" role="tab" @click="mode = 'saved'">
            稍后完成
          </button>
        </div>
      </header>

      <div v-if="mode === 'map'" class="map-content">
        <ExploreMap
          v-if="coordinates"
          class="real-map"
          :quests="quests"
          :selected-marker-id="selectedQuest?.markerId ?? null"
          :show-user-location="locationSource === 'device'"
          :user-location="coordinates"
          @select="selectedQuest = $event"
        />

        <div v-else class="location-required">
          <PhCloudSun />
          <strong>{{ locating ? '正在获取真实定位…' : '需要你的真实位置' }}</strong>
          <span>{{ locationError || '定位成功后才会展示附近支线和“我在这里”。' }}</span>
          <button :disabled="locating" @click="loadLocationAndQuests">
            {{ locating ? '定位中…' : '重新定位' }}
          </button>
        </div>

        <p v-if="coordinates" class="location-accuracy">
          {{
            locationSource === 'device'
              ? `设备定位 · 精度约 ${locationAccuracyM ?? '--'} 米`
              : locationSource === 'ip'
                ? `IP 定位：${locationCityName || '广州'} · 仅供浏览`
                : '广州城市浏览 · 不是我的位置'
          }}
        </p>

        <div v-if="weeklyTheme" class="weekly-theme">
          <PhSparkle weight="fill" />
          <span>{{ weeklyTheme.subtitle || '本周主题' }}</span>
          <strong>{{ weeklyTheme.title }}</strong>
        </div>
      </div>

      <div v-else class="quest-list" :class="{ empty: !visibleQuests.length }">
        <button v-for="quest in visibleQuests" :key="quest.id" @click="selectQuest(quest)">
          <span>{{ quest.distanceLabel }}</span>
          <strong>{{ quest.title }}</strong>
          <small>{{ quest.durationLabel || `约${quest.durationMinutes}分钟` }}</small>
          <PhArrowRight />
        </button>
        <div v-if="!visibleQuests.length" class="empty-state">
          <PhStar />
          <strong>{{ loading ? '正在寻找附近支线' : '还没有可展示的支线' }}</strong>
          <span v-if="mode === 'saved'">在地图中收藏感兴趣的支线，它会出现在这里。</span>
          <span v-else>可以移动到新的区域后重新进入探索页。</span>
        </div>
      </div>
    </section>

    <article v-if="selectedQuest" class="quest-card">
      <div class="torn-edge" aria-hidden="true"></div>
      <div class="quest-copy">
        <h2>{{ selectedQuest.title }}</h2>
        <p class="meta">
          <span>{{ selectedQuest.distanceLabel }}</span>
          <i></i>
          <span>{{ selectedQuest.durationLabel || `约${selectedQuest.durationMinutes}分钟` }}</span>
          <i></i>
          <span>{{ selectedQuest.settingLabel }}</span>
        </p>
        <p v-if="selectedQuest.prompt" class="prompt">{{ selectedQuest.prompt }}</p>
        <div class="destination">
          <span>目标地点</span>
          <strong>{{ locationLabel(selectedQuest) }}</strong>
        </div>
        <button class="accept-button" :disabled="accepting" @click="handleAccept">
          {{ accepting ? '正在处理…' : needsDiscovery ? '发现隐藏支线' : '接受支线' }}
          <PhArrowRight />
        </button>
        <button
          class="save-button"
          :class="{ saved: isSaved }"
          :disabled="saving"
          @click="toggleSaved"
        >
          <PhStar :weight="isSaved ? 'fill' : 'regular'" />
          {{ saving ? '正在保存…' : isSaved ? '已加入稍后完成' : '稍后完成' }}
        </button>
      </div>
    </article>

    <Transition name="toast">
      <p v-if="toast" class="toast">{{ toast }}</p>
    </Transition>
  </main>
</template>

<style scoped lang="less">
button {
  border: 0;
  cursor: pointer;
}

.explore-shell {
  width: min(100%, 520px);
  min-height: 100svh;
  margin: 0 auto;
  padding-bottom: calc(82px + env(safe-area-inset-bottom));
  overflow: hidden;
  color: #eadbc3;
  background: #0b1719;
}

.map-stage {
  position: relative;
  min-height: 560px;
  overflow: hidden;
  background:
    linear-gradient(rgba(8, 21, 23, 0.24), rgba(8, 21, 23, 0.48)),
    url('@/assets/explore-map-placeholder.png') center 42% / cover no-repeat;
}

.explore-header {
  position: relative;
  z-index: 5;
  padding: max(36px, env(safe-area-inset-top)) 26px 0;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h1 {
    margin: 0;
    color: #f1dfc6;
    font:
      600 clamp(32px, 9vw, 40px) / 1.2 'Noto Serif SC',
      serif;
    letter-spacing: -0.04em;
  }

  p {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 6px;
    margin: 0;
    color: #d4c4ad;
    font-size: 15px;
  }

  svg {
    width: 23px;
    height: 23px;
  }
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 20px;
  padding: 3px;
  border: 1px solid rgba(222, 207, 184, 0.28);
  border-radius: 999px;
  background: rgba(10, 24, 26, 0.68);
  backdrop-filter: blur(10px);

  button {
    min-width: 0;
    padding: 11px 8px;
    border-radius: 999px;
    color: #b7aa98;
    background: transparent;
    font-size: 15px;

    &.active {
      color: #ef7158;
      background: #f0dfc4;
      box-shadow: 0 5px 18px rgba(2, 12, 14, 0.2);
    }

    &:focus-visible {
      outline: 2px solid #ff765c;
      outline-offset: 2px;
    }
  }
}

.map-content {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.real-map {
  pointer-events: auto;
}

.location-required {
  position: absolute;
  z-index: 4;
  top: 52%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(82%, 340px);
  padding: 24px 22px;
  color: #dfd0ba;
  text-align: center;
  border: 1px solid rgba(231, 214, 190, 0.2);
  border-radius: 18px;
  background: rgba(9, 22, 24, 0.9);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
  transform: translate(-50%, -50%);
  backdrop-filter: blur(12px);
  pointer-events: auto;

  svg {
    width: 30px;
    height: 30px;
    color: #ff765c;
  }

  strong {
    margin-top: 10px;
    font:
      500 18px 'Noto Serif SC',
      serif;
  }

  span {
    margin-top: 9px;
    color: #aa9e8d;
    font-size: 13px;
    line-height: 1.7;
  }

  button {
    margin-top: 17px;
    padding: 10px 22px;
    border-radius: 999px;
    color: #fff8ee;
    background: #ef7057;

    &:disabled {
      opacity: 0.65;
    }
  }
}

.location-accuracy {
  position: absolute;
  z-index: 4;
  right: 16px;
  bottom: 34px;
  margin: 0;
  padding: 6px 10px;
  color: #cbbda8;
  border-radius: 999px;
  background: rgba(8, 21, 23, 0.72);
  font-size: 11px;
}

.weekly-theme {
  position: absolute;
  top: 45%;
  right: 7%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-shadow: 0 2px 10px #061012;

  svg {
    width: 34px;
    height: 34px;
    color: #ff765c;
  }

  span {
    margin-top: 4px;
    color: #ff765c;
    font:
      500 13px 'Noto Serif SC',
      serif;
  }

  strong {
    margin-top: 5px;
    font:
      500 13px 'Noto Serif SC',
      serif;
  }
}

.current-location {
  position: absolute;
  right: 0;
  bottom: 48px;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  color: #f0dfc7;
  font:
    500 14px 'Noto Serif SC',
    serif;
  text-shadow: 0 2px 8px #061012;

  svg {
    width: 28px;
    height: 28px;
    color: #ff765c;
    filter: drop-shadow(0 0 8px rgba(255, 118, 92, 0.6));
  }
}

.quest-list {
  position: relative;
  z-index: 4;
  display: grid;
  gap: 10px;
  max-height: 430px;
  padding: 22px 26px 80px;
  overflow-y: auto;

  > button {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 10px;
    width: 100%;
    padding: 16px;
    color: #ede0cb;
    text-align: left;
    border: 1px solid rgba(231, 214, 190, 0.18);
    border-radius: 16px;
    background: rgba(9, 22, 24, 0.78);
    backdrop-filter: blur(10px);

    span {
      grid-row: 1 / 3;
      color: #ff765c;
      font-size: 12px;
    }

    strong {
      min-width: 0;
      font:
        500 15px/1.5 'Noto Serif SC',
        serif;
      overflow-wrap: anywhere;
    }

    small {
      color: #aa9e8d;
    }

    svg {
      grid-row: 1 / 3;
      grid-column: 3;
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 68px 24px;
  color: #b9aa95;
  text-align: center;

  svg {
    width: 30px;
    height: 30px;
    margin-bottom: 14px;
  }

  strong {
    color: #eadbc3;
    font:
      500 17px 'Noto Serif SC',
      serif;
  }

  span {
    max-width: 260px;
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.7;
  }
}

.quest-card {
  position: relative;
  z-index: 8;
  margin-top: -22px;
  color: #17272a;
  background: #f3e5c9 url('@/assets/paper-texture.png') center / 520px auto repeat;
  border-radius: 0 0 28px 28px;
  box-shadow: 0 -16px 40px rgba(2, 10, 12, 0.16);
}

.torn-edge {
  position: absolute;
  right: 0;
  bottom: calc(100% - 1px);
  left: 0;
  height: 66px;
  background: url('@/assets/paper-torn-edge.png') center bottom / 100% 100% no-repeat;
  pointer-events: none;
}

.quest-copy {
  padding: 25px 28px 24px;

  h2 {
    margin: 0;
    font:
      600 clamp(27px, 7.8vw, 38px) / 1.35 'Noto Serif SC',
      serif;
    letter-spacing: -0.04em;
    overflow-wrap: anywhere;
  }
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 11px 0 0;
  color: #776f63;
  font-size: 14px;
  line-height: 1.6;

  i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
  }
}

.prompt {
  margin: 13px 0 0;
  color: #6d695f;
  font-size: 13px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.destination {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  margin-top: 19px;
  padding-top: 18px;
  border-top: 1px solid rgba(75, 68, 57, 0.18);

  span {
    color: #777065;
    font-size: 14px;
  }

  strong {
    min-width: 0;
    font:
      500 17px/1.5 'Noto Serif SC',
      serif;
    overflow-wrap: anywhere;
  }
}

.accept-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  margin-top: 22px;
  gap: 12px;
  border-radius: 999px;
  color: #fffaf2;
  background: #ff6f54;
  box-shadow: 0 14px 28px rgba(222, 91, 68, 0.22);
  font:
    500 18px 'Noto Serif SC',
    serif;

  &:disabled {
    cursor: wait;
    opacity: 0.72;
  }

  &:focus-visible {
    outline: 2px solid #17272a;
    outline-offset: 3px;
  }
}

.save-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 16px;
  gap: 8px;
  color: #5d5a53;
  background: transparent;
  font-size: 15px;

  &.saved {
    color: #d85f49;
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.toast {
  position: fixed;
  z-index: 100;
  bottom: calc(94px + env(safe-area-inset-bottom));
  left: 50%;
  width: max-content;
  max-width: calc(100% - 40px);
  margin: 0;
  padding: 11px 18px;
  border-radius: 999px;
  color: #f8f1e9;
  background: rgba(18, 31, 33, 0.94);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  font-size: 13px;
  transform: translateX(-50%);
}

.toast-enter-active,
.toast-leave-active {
  transition: 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (max-width: 370px) {
  .explore-header,
  .quest-copy {
    padding-right: 20px;
    padding-left: 20px;
  }

  .title-row p {
    font-size: 13px;
  }
}
</style>
