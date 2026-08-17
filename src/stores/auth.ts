import { defineStore } from 'pinia'
import { ref } from 'vue'

import { login, type LoginPayload } from '@/api/auth'
import { clearAccessToken, getAccessToken } from '@/api/http'
import { getMe, type MeResponse } from '@/api/me'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<MeResponse | null>(null)

  async function signIn(payload: LoginPayload) {
    const result = await login(payload)
    const storage = payload.rememberMe ? localStorage : sessionStorage
    clearAccessToken()
    storage.setItem('access_token', result.accessToken)
    user.value = await getMe()
  }

  async function loadMe() {
    if (!getAccessToken()) return null
    try {
      user.value = await getMe()
      return user.value
    } catch {
      user.value = null
      return null
    }
  }

  function signOut() {
    clearAccessToken()
    user.value = null
  }

  return { user, signIn, loadMe, signOut }
})
