<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PhCoins, PhArrowsClockwise } from '@phosphor-icons/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useJourneyStore } from '@/stores/journey'
import { useAuthStore } from '@/stores/auth'
import DailySignIn from '@/components/DailySignIn.vue'

const router = useRouter()
const journey = useJourneyStore()
const auth = useAuthStore()
const pointsBalance = computed(() =>
  auth.user ? (auth.user.growth?.pointsBalance ?? 0).toLocaleString('zh-CN') : '—',
)

async function refreshGrowth() {
  try {
    await auth.loadMe()
  } catch {
    // loadMe 保存错误状态，卡片提供重试入口。
  }
}

function onVisible() {
  if (document.visibilityState === 'visible' && !auth.loadingMe) void refreshGrowth()
}
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

onMounted(() => {
  // 用户信息请求失败由积分卡片展示，避免未处理的 Promise 异常。
  void journey.initialize().catch(() => {})
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))
</script>

<template>
  <main class="page-shell">
    <p class="page-kicker">我的世界</p>
    <h1>每一次出发，<br />都在重新编辑生活</h1>
    <section class="points-card" aria-labelledby="points-title" :aria-busy="auth.loadingMe">
      <div class="points-heading">
        <h2 id="points-title"><PhCoins :size="19" /> 我的积分</h2>
        <button
          class="refresh-points"
          :disabled="auth.loadingMe"
          aria-label="刷新积分余额"
          @click="refreshGrowth"
        >
          <PhArrowsClockwise :size="18" />
        </button>
      </div>
      <p class="points-value" aria-live="polite" aria-atomic="true">
        <strong>{{ pointsBalance }}</strong
        ><span>积分</span>
      </p>
      <p class="points-caption">{{ auth.loadingMe ? '正在更新余额…' : '每一次积累，都算数。' }}</p>
      <p v-if="auth.meError" class="points-error" role="alert">
        {{ auth.meError }}<span v-if="auth.user">，当前展示上次获取的余额。</span>
        <button :disabled="auth.loadingMe" @click="refreshGrowth">重新获取</button>
      </p>
    </section>
    <DailySignIn @changed="refreshGrowth" />

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

.points-card {
  margin-top: 30px;
  padding: 20px 22px;
  border: 1px solid #edc6a933;
  border-radius: 22px;
  background: linear-gradient(135deg, #303631, #223033);
}

.points-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: #edc6a9;
    font-size: 14px;
    font-weight: 500;
  }
}

.refresh-points {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid #edc6a933;
  border-radius: 50%;
  background: transparent;
  color: #edc6a9;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  &:focus-visible {
    outline: 2px solid #edc6a9;
    outline-offset: 3px;
  }
}

.points-value {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin: 12px 0;

  strong {
    color: #f0dfc6;
    font-size: clamp(32px, 10vw, 48px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  span {
    color: #a6b2ab;
    font-size: 13px;
  }
}

.points-caption,
.points-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: #a6b2ab;
}

.points-error {
  margin-top: 10px;
  color: #ffb49b;

  button {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
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
