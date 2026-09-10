<script setup lang="ts">
import { load } from '@amap/amap-jsapi-loader'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { Coordinates, NearbyQuest } from '@/api/explore'

interface MapInstance {
  destroy(): void
  setCenter(position: [number, number]): void
}

interface MarkerInstance {
  setMap(map: MapInstance | null): void
}

interface AMapNamespace {
  Map: new (
    container: HTMLElement,
    options: {
      center: [number, number]
      features: string[]
      mapStyle: string
      showLabel: boolean
      viewMode: '2D'
      zoom: number
      zooms: [number, number]
    },
  ) => MapInstance
  Marker: new (options: {
    anchor: 'center'
    content: HTMLElement
    map: MapInstance
    position: [number, number]
    zIndex: number
  }) => MarkerInstance
}

const props = defineProps<{
  quests: NearbyQuest[]
  selectedMarkerId: string | null
  showUserLocation: boolean
  mapCenter: Coordinates
  userLocation: Coordinates
}>()

const emit = defineEmits<{
  select: [quest: NearbyQuest]
}>()

const mapContainer = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const markerElements = new Map<string, HTMLElement>()
const markers: MarkerInstance[] = []
let amap: AMapNamespace | null = null
let map: MapInstance | null = null

function clearMarkers() {
  markers.splice(0).forEach((marker) => marker.setMap(null))
  markerElements.clear()
}

function createMarkerContent(quest: NearbyQuest) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'quest-map-marker'
  button.setAttribute('aria-label', `查看支线：${quest.title}`)

  const dot = document.createElement('span')
  dot.className = 'marker-dot'
  const name = document.createElement('strong')
  name.textContent = quest.targetName || quest.settingLabel
  const distance = document.createElement('small')
  distance.textContent = quest.distanceLabel
  button.append(dot, name, distance)
  button.addEventListener('click', (event) => {
    if (event.detail > 0) button.blur()
    emit('select', quest)
  })
  return button
}

function renderMarkers() {
  if (!amap || !map) return
  clearMarkers()
  props.quests.forEach((quest, index) => {
    const content = createMarkerContent(quest)
    const marker = new amap!.Marker({
      anchor: 'center',
      content,
      map: map!,
      position: [quest.longitude, quest.latitude],
      zIndex: 20 + index,
    })
    markers.push(marker)
    markerElements.set(quest.markerId, content)
  })

  if (props.showUserLocation) {
    const here = document.createElement('div')
    here.className = 'user-location-marker'
    here.innerHTML = '<span></span><strong>我在这里</strong>'
    markers.push(
      new amap.Marker({
        anchor: 'center',
        content: here,
        map,
        position: [props.userLocation.longitude, props.userLocation.latitude],
        zIndex: 50,
      }),
    )
  }
  updateSelectedMarker()
}

function updateSelectedMarker() {
  markerElements.forEach((element, markerId) => {
    element.classList.toggle('selected', markerId === props.selectedMarkerId)
  })
}

async function initializeMap() {
  const key = import.meta.env.VITE_AMAP_KEY

  if (!key || !mapContainer.value) {
    status.value = 'error'
    return
  }

  // 生产环境不把安全密钥打包到 JS；高德请求统一经过 NestJS 同域代理。
  window._AMapSecurityConfig = {
    serviceHost: `${window.location.origin}/_AMapService`,
    // securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
  }
  try {
    amap = (await load({ key, version: '2.0' })) as AMapNamespace
    map = new amap.Map(mapContainer.value, {
      center: [props.mapCenter.longitude, props.mapCenter.latitude],
      features: ['bg', 'road', 'building'],
      mapStyle: 'amap://styles/dark',
      showLabel: false,
      viewMode: '2D',
      zoom: 14,
      zooms: [12, 18],
    })
    renderMarkers()
    status.value = 'ready'
  } catch (error) {
    console.error('高德地图加载失败', error)
    status.value = 'error'
  }
}

watch(() => props.quests, renderMarkers)
watch(() => props.selectedMarkerId, updateSelectedMarker)
watch(() => props.showUserLocation, renderMarkers)
watch(
  () => props.mapCenter,
  (location) => {
    map?.setCenter([location.longitude, location.latitude])
    renderMarkers()
  },
)
onMounted(initializeMap)
onBeforeUnmount(() => {
  clearMarkers()
  map?.destroy()
  map = null
})
</script>

<template>
  <div class="explore-map">
    <div ref="mapContainer" class="amap-container" aria-label="高德地图"></div>
    <p v-if="status === 'loading'" class="map-status">正在展开城市地图…</p>
    <p v-else-if="status === 'error'" class="map-status error">地图暂时无法加载</p>
  </div>
</template>

<style scoped lang="less">
.explore-map,
.amap-container {
  position: absolute;
  inset: 0;
}

.explore-map {
  background: rgba(8, 21, 23, 0.32) url('@/assets/explore-map-placeholder.png') center 42% / cover
    no-repeat;
}

.amap-container {
  background: transparent;
}

:deep(.amap-layer) {
  filter: sepia(0.3) saturate(0.62) brightness(0.76) contrast(1.08);
}

:deep(.amap-logo) {
  display: none !important;
  bottom: 96px !important;
}

:deep(.amap-copyright) {
  display: none !important;
  bottom: 100px !important;
}

.map-status {
  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  margin: 0;
  padding: 8px 13px;
  color: #d8cab4;
  border-radius: 999px;
  background: rgba(8, 21, 23, 0.72);
  font-size: 12px;
  transform: translate(-50%, -50%);

  &.error {
    color: #f1c2b7;
  }
}

:deep(.quest-map-marker) {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 112px;
  padding: 0;
  color: #e6d5bd;
  text-align: center;
  text-shadow: 0 2px 8px #061012;
  border: 0;
  background: transparent;
  cursor: pointer;

  .marker-dot {
    width: 16px;
    height: 16px;
    margin-bottom: 7px;
    border: 3px solid rgba(255, 223, 198, 0.28);
    border-radius: 50%;
    background: #ff765c;
    box-shadow: 0 0 0 7px rgba(255, 118, 92, 0.14);
  }

  strong {
    max-width: 100%;
    overflow: hidden;
    font:
      500 14px/1.45 'Noto Serif SC',
      serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    margin-top: 2px;
    color: #c5b49f;
  }

  &.selected .marker-dot {
    width: 20px;
    height: 20px;
    box-shadow:
      0 0 0 7px rgba(255, 118, 92, 0.18),
      0 0 0 13px rgba(238, 211, 177, 0.18);
  }

  &:focus-visible {
    border-radius: 8px;
    outline: 2px solid #ff765c;
    outline-offset: 4px;
  }
}

:deep(.user-location-marker) {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #f0dfc7;
  text-shadow: 0 2px 8px #061012;

  span {
    width: 14px;
    height: 14px;
    border: 3px solid #f6dfc6;
    border-radius: 50%;
    background: #ff765c;
    box-shadow:
      0 0 0 7px rgba(255, 118, 92, 0.22),
      0 0 18px rgba(255, 118, 92, 0.7);
  }

  strong {
    margin-top: 7px;
    font:
      500 13px 'Noto Serif SC',
      serif;
    white-space: nowrap;
  }
}

@media (max-width: 370px) {
  :deep(.quest-map-marker) {
    width: 96px;
  }
}
</style>
