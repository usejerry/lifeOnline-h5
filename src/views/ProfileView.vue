<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useJourneyStore } from '@/stores/journey'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const journey = useJourneyStore()
const auth = useAuthStore()
const signingOut = ref(false)
const logoutError = ref('')
async function signOut(all = false) {
  signingOut.value = true
  logoutError.value = ''
  try {
    await auth.signOut(all)
    await router.replace('/login')
  } catch {
    logoutError.value = '退出失败，请检查网络后重试'
  } finally {
    signingOut.value = false
  }
}
const { mood, availableTime, scene, completedCount } = storeToRefs(journey)

function resetPreferences() {
  journey.beginPreferenceSetup()
  void router.push('/today')
}

onMounted(() => void journey.initialize())
</script>

<template>
  <main class="page-shell">
    <p class="page-kicker">我的世界</p>
    <h1>每一次出发，<br />都在重新编辑生活</h1>

    <div class="world-stat">
      <strong>{{ completedCount }}</strong
      ><span>已完成支线</span>
    </div>
    <div class="profile-row">
      <span>偏好心情</span><strong>{{ mood }}</strong>
    </div>
    <div class="profile-row">
      <span>常用时间</span><strong>{{ availableTime }}</strong>
    </div>
    <div class="profile-row">
      <span>行动场景</span><strong>{{ scene }}</strong>
    </div>
    <button class="reset" @click="resetPreferences">重新设置偏好</button>
    <div>
      <button class="reset" :disabled="signingOut" @click="signOut()">退出登录</button>
      <button class="reset" :disabled="signingOut" style="margin-left: 24px" @click="signOut(true)">
        退出全部设备
      </button>
      <p v-if="logoutError" role="alert">{{ logoutError }}</p>
    </div>
  </main>
</template>

<style scoped lang="less">
.page-shell {
  width: min(100%, 520px);
  min-height: 100svh;
  margin: 0 auto;
  padding: max(54px, env(safe-area-inset-top)) 26px 110px;
  color: #f8f1e8;
  background: #142326;
}

.page-kicker {
  margin: 0 0 18px;
  color: #e4664f;
  font-size: 14px;
  letter-spacing: 0.16em;
}

h1 {
  margin: 0 0 20px;
  font:
    600 clamp(34px, 9vw, 48px) / 1.35 'Noto Serif SC',
    serif;
  letter-spacing: -0.07em;
}

.world-stat {
  display: flex;
  align-items: end;
  gap: 15px;
  margin: 46px 0;
  padding-bottom: 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);

  strong {
    color: #ff7459;
    font:
      600 78px/1 'Noto Serif SC',
      serif;
  }

  span {
    padding-bottom: 8px;
    color: #9eaaa7;
  }
}

.profile-row {
  display: flex;
  justify-content: space-between;
  padding: 18px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  span {
    color: #899692;
  }
}

.reset {
  margin-top: 34px;
  padding: 0;
  color: #ff7459;
  border: 0;
  background: transparent;
  text-decoration: underline;
  text-underline-offset: 5px;
  cursor: pointer;
}
</style>
