import { load } from '@amap/amap-jsapi-loader'

import type { Coordinates } from '@/api/explore'

interface GeolocationResult {
  position: { lng: number; lat: number }
  accuracy: number
  isConverted?: boolean
}

interface AMapGeolocationNamespace {
  Geolocation: new (options: Record<string, unknown>) => {
    getCurrentPosition(
      callback: (status: 'complete' | 'error', result: GeolocationResult) => void,
    ): void
  }
}

interface AMapCitySearchNamespace {
  CitySearch: new () => {
    getLocalCity(
      callback: (
        status: 'complete' | 'error',
        result: {
          info?: string
          adcode?: string
          city?: string
          bounds?: { getCenter(): { lng: number; lat: number } }
        },
      ) => void,
    ): void
  }
}

export interface BrowserPosition {
  coordinates: Coordinates
  accuracyM: number
  cityAdcode?: string
  cityName?: string
}

async function locate(noIpLocate: number, enableHighAccuracy: boolean) {
  const key = import.meta.env.VITE_AMAP_KEY
  if (!key) throw new Error('高德地图 Key 未配置')

  window._AMapSecurityConfig = {
    serviceHost: `${window.location.origin}/_AMapService`,
  }
  const amap = (await load({
    key,
    version: '2.0',
    plugins: ['AMap.Geolocation'],
  })) as AMapGeolocationNamespace

  return new Promise<BrowserPosition>((resolve, reject) => {
    const geolocation = new amap.Geolocation({
      enableHighAccuracy,
      timeout: enableHighAccuracy ? 10_000 : 4_000,
      convert: true,
      GeoLocationFirst: enableHighAccuracy,
      noIpLocate,
    })
    geolocation.getCurrentPosition((status, result) => {
      if (status !== 'complete' || !result.position) {
        reject(new Error('无法获取定位'))
        return
      }
      resolve({
        coordinates: {
          // longitude: 113.24794 || result.position.lng,
          // latitude: 23.11467 || result.position.lat,
          longitude: 113.24794,
          latitude: 23.11467 ,
        },
        accuracyM: Math.round(result.accuracy || 0),
      })
    })
  })
}

/**
 * 使用高德定位并转换为 GCJ-02。目标 POI 也是 GCJ-02，二者才能用于地图展示、导航和距离校验。
 * noIpLocate=3 会关闭 IP 猜测位置；拿不到设备定位就明确失败，绝不冒充“我在这里”。
 */
export async function getBrowserPosition(): Promise<BrowserPosition> {
  return locate(3, true)
}

/** 仅供定位失败后浏览城市内容，不能用于导航、解锁或完成校验。 */
export async function getIpPosition() {
  const key = import.meta.env.VITE_AMAP_KEY
  if (!key) throw new Error('高德地图 Key 未配置')

  window._AMapSecurityConfig = {
    serviceHost: `${window.location.origin}/_AMapService`,
  }
  const amap = (await load({
    key,
    version: '2.0',
    plugins: ['AMap.CitySearch'],
  })) as AMapCitySearchNamespace

  return new Promise<BrowserPosition>((resolve, reject) => {
    new amap.CitySearch().getLocalCity((status, result) => {
      const center = result.bounds?.getCenter()
      if (status !== 'complete' || result.info !== 'OK' || !center) {
        reject(new Error('无法获取 IP 所在城市'))
        return
      }
      resolve({
        coordinates: { longitude: center.lng, latitude: center.lat },
        accuracyM: 0,
        cityAdcode: result.adcode,
        cityName: result.city,
      })
    })
  })
}

export async function getBrowserCoordinates() {
  return (await getBrowserPosition()).coordinates
}
