import { defineStore } from 'pinia'
import axios from 'axios'
import { ref } from 'vue'

import { login, logout, logoutAll, type LoginPayload } from '@/api/auth'
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  restoreSession,
  withAuthLock,
  notifyAuthChange,
} from '@/api/http'
import { getMe, type MeResponse } from '@/api/me'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<MeResponse | null>(null)
  const loadingMe = ref(false)
  const meError = ref('')
  window.addEventListener('auth:cleared', () => {
    user.value = null
    meError.value = ''
  })

  async function signIn(payload: LoginPayload) {
    await withAuthLock(async () => {
      const result = await login(payload)
      clearAccessToken()
      setAccessToken(result.accessToken, result.expiresIn)
      notifyAuthChange()
    })
    user.value = await getMe()
  }

  async function loadMe() {
    loadingMe.value = true
    meError.value = ''
    try {
      await restoreSession()
      if (!getAccessToken()) return null
      user.value = await getMe()
      return user.value
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        meError.value = '积分余额更新失败，请重试'
        throw error
      }
      user.value = null
      return null
    } finally {
      loadingMe.value = false
    }
  }

  async function signOut(all = false) {
    if (all) await logoutAll()
    else await withAuthLock(() => logout())
    clearAccessToken()
    notifyAuthChange()
    user.value = null
  }

  return { user, loadingMe, meError, signIn, loadMe, signOut }
})
