import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { getAccessToken } from '@/api/http'
import {
  getMessages,
  getUnreadMessageCount,
  markAllMessagesAsRead,
  markMessageAsRead,
  type UserMessage,
} from '@/api/messages'

const REFRESH_INTERVAL_MS = 30_000

export const useMessagesStore = defineStore('messages', () => {
  const items = ref<UserMessage[]>([])
  const total = ref(0)
  const page = ref(0)
  const unreadCount = ref<number | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const listError = ref('')
  const unreadError = ref(false)
  const markingIds = ref(new Set<number>())
  const markingAll = ref(false)
  const actionError = ref('')
  const listLoaded = ref(false)
  let accountRevision = 0
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  let managerStarted = false

  const hasMore = computed(() => items.value.length < total.value)

  function clear() {
    accountRevision += 1
    items.value = []
    total.value = 0
    page.value = 0
    unreadCount.value = null
    loading.value = false
    loadingMore.value = false
    listError.value = ''
    unreadError.value = false
    markingIds.value = new Set()
    markingAll.value = false
    actionError.value = ''
    listLoaded.value = false
  }

  async function loadMessages(reset = false) {
    if (!getAccessToken() || loading.value || loadingMore.value) return
    const revision = accountRevision
    const nextPage = reset ? 1 : page.value + 1
    if (reset) loading.value = true
    else loadingMore.value = true
    listError.value = ''

    try {
      const result = await getMessages(nextPage)
      // 退出或切换账号后的迟到响应不能写回新账号的消息状态。
      if (revision !== accountRevision) return
      items.value = reset ? result.items : [...items.value, ...result.items]
      total.value = result.total
      page.value = result.page
      listLoaded.value = true
    } catch {
      if (revision === accountRevision) listError.value = '消息加载失败，请检查网络后重试'
    } finally {
      if (revision === accountRevision) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  async function loadUnreadCount() {
    if (!getAccessToken()) return
    const revision = accountRevision
    try {
      const result = await getUnreadMessageCount()
      if (revision !== accountRevision) return
      unreadCount.value = result.count
      unreadError.value = false
    } catch {
      if (revision === accountRevision) unreadError.value = true
    }
  }

  async function refresh(includeList = listLoaded.value) {
    await Promise.all([loadUnreadCount(), includeList ? loadMessages(true) : Promise.resolve()])
  }

  async function markAsRead(id: number) {
    if (markingIds.value.has(id)) return null
    const revision = accountRevision
    markingIds.value = new Set(markingIds.value).add(id)
    actionError.value = ''
    try {
      const message = await markMessageAsRead(id)
      if (revision !== accountRevision) return null
      const index = items.value.findIndex((item) => item.id === id)
      if (index !== -1) items.value[index] = message
      await loadUnreadCount()
      return message
    } catch {
      if (revision === accountRevision) actionError.value = '未能确认已读状态，请重试'
      return null
    } finally {
      if (revision === accountRevision) {
        const next = new Set(markingIds.value)
        next.delete(id)
        markingIds.value = next
      }
    }
  }

  async function markAllAsRead() {
    if (markingAll.value || unreadCount.value === 0) return false
    const revision = accountRevision
    markingAll.value = true
    actionError.value = ''
    try {
      await markAllMessagesAsRead()
      if (revision !== accountRevision) return false
      // 服务端已确认成功后再更新界面，避免请求失败时伪装成已读。
      const confirmedAt = new Date().toISOString()
      items.value = items.value.map((item) =>
        item.readAt ? item : { ...item, readAt: confirmedAt },
      )
      unreadCount.value = 0
      return true
    } catch {
      if (revision === accountRevision) actionError.value = '全部已读失败，请稍后重试'
      return false
    } finally {
      if (revision === accountRevision) markingAll.value = false
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') void refresh()
  }

  function start() {
    if (managerStarted || !getAccessToken()) return
    managerStarted = true
    document.addEventListener('visibilitychange', onVisible)
    refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, REFRESH_INTERVAL_MS)
    void refresh(false)
  }

  function stop() {
    if (!managerStarted) return
    managerStarted = false
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(refreshTimer)
    refreshTimer = undefined
  }

  window.addEventListener('auth:cleared', () => {
    stop()
    clear()
    // 跨标签登录会先清旧身份再装载新 Token，微任务中重新判断是否需要启动。
    queueMicrotask(() => {
      if (getAccessToken()) start()
    })
  })

  return {
    items,
    total,
    page,
    unreadCount,
    loading,
    loadingMore,
    listError,
    unreadError,
    markingIds,
    markingAll,
    actionError,
    hasMore,
    loadMessages,
    loadUnreadCount,
    refresh,
    markAsRead,
    markAllAsRead,
    start,
    stop,
    clear,
  }
})
