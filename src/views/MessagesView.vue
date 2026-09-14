<script setup lang="ts">
import {
  PhArrowClockwise,
  PhArrowRight,
  PhBell,
  PhCheck,
  PhCheckCircle,
  PhClockCountdown,
  PhFootprints,
} from '@phosphor-icons/vue'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { UserMessage } from '@/api/messages'
import { getActiveQuest, type QuestRecord } from '@/api/quest-record'
import { getSignInToday, type SignInToday } from '@/api/sign-in'
import { useMessagesStore } from '@/stores/messages'

const router = useRouter()
const messages = useMessagesStore()
const {
  items,
  total,
  unreadCount,
  loading,
  loadingMore,
  listError,
  unreadError,
  markingIds,
  markingAll,
  actionError,
  hasMore,
} = storeToRefs(messages)
const signInToday = ref<SignInToday | null>(null)
const activeRecord = ref<QuestRecord | null>(null)
const contextError = ref(false)
const contextLoading = ref(false)
let contextTimer: ReturnType<typeof setInterval> | undefined

const hasUnreadItems = computed(() => items.value.some((item) => !item.readAt))

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function businessDate(message: UserMessage) {
  const date = message.payload?.businessDate
  return typeof date === 'string' ? date : message.businessId
}

function questRecordId(message: UserMessage) {
  const payloadId = message.payload?.questRecordId
  if (typeof payloadId === 'number' && Number.isInteger(payloadId)) return payloadId
  const id = Number(message.businessId)
  return Number.isInteger(id) && id > 0 ? id : null
}

function businessState(message: UserMessage) {
  if (contextLoading.value) return '状态更新中'
  if (contextError.value) return '状态待刷新'
  if (message.type === 'daily_sign_in_reminder') {
    if (businessDate(message) !== shanghaiDate()) return '已过期'
    return signInToday.value?.signedIn ? '已签到' : '待签到'
  }
  return questRecordId(message) === activeRecord.value?.id ? '进行中' : '事项已结束'
}

function canOpenBusiness(message: UserMessage) {
  if (contextLoading.value || contextError.value) return false
  if (message.type === 'daily_sign_in_reminder') return businessDate(message) === shanghaiDate()
  return questRecordId(message) === activeRecord.value?.id
}

function actionLabel(message: UserMessage) {
  if (!canOpenBusiness(message)) return ''
  if (message.type === 'daily_sign_in_reminder')
    return signInToday.value?.signedIn ? '查看签到' : '去签到'
  return '继续支线'
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

async function loadBusinessContext() {
  if (contextLoading.value) return
  contextLoading.value = true
  contextError.value = false
  try {
    const [signIn, active] = await Promise.all([getSignInToday(), getActiveQuest()])
    signInToday.value = signIn
    activeRecord.value = active
  } catch {
    contextError.value = true
  } finally {
    contextLoading.value = false
  }
}

async function openMessage(message: UserMessage) {
  if (markingIds.value.has(message.id)) return
  if (!message.readAt) {
    const confirmed = await messages.markAsRead(message.id)
    // 未读写入失败时不跳转，确保用户看到的状态与服务端一致。
    if (!confirmed) return
  }
  if (!canOpenBusiness(message)) return

  if (message.type === 'daily_sign_in_reminder') {
    await router.push({ path: '/profile', hash: '#daily-sign-in' })
    return
  }
  const recordId = questRecordId(message)
  if (recordId) await router.push({ path: '/today', query: { recordId: String(recordId) } })
}

function onVisible() {
  if (document.visibilityState === 'visible') void loadBusinessContext()
}

onMounted(() => {
  void messages.loadMessages(true)
  void loadBusinessContext()
  document.addEventListener('visibilitychange', onVisible)
  contextTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void loadBusinessContext()
  }, 30_000)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisible)
  clearInterval(contextTimer)
})
</script>

<template>
  <main class="messages-shell">
    <header class="page-header">
      <div>
        <p class="page-kicker"><PhBell weight="fill" /> 消息中心</p>
        <h1>别错过生活<br />轻轻敲门的声音</h1>
      </div>
      <button
        class="read-all"
        :disabled="markingAll || (!hasUnreadItems && unreadCount === 0)"
        @click="messages.markAllAsRead"
      >
        <PhCheckCircle :size="17" />
        {{ markingAll ? '处理中…' : '全部已读' }}
      </button>
    </header>

    <div class="summary" aria-live="polite">
      <span v-if="unreadCount !== null">{{ unreadCount }} 条未读 · 共 {{ total }} 条消息</span>
      <span v-else>未读数量暂不可用</span>
      <button v-if="unreadError" @click="messages.loadUnreadCount">
        <PhArrowClockwise :size="14" />重试
      </button>
    </div>

    <p v-if="actionError" class="action-error" role="alert">{{ actionError }}</p>

    <section class="message-list" :aria-busy="loading || loadingMore">
      <article v-for="message in items" :key="message.id" :class="{ unread: !message.readAt }">
        <span class="type-icon" aria-hidden="true">
          <PhFootprints v-if="message.type === 'daily_sign_in_reminder'" :size="19" />
          <PhClockCountdown v-else :size="19" />
        </span>
        <button class="message-main" @click="openMessage(message)">
          <span class="message-meta">
            <b>{{ businessState(message) }}</b>
            <time :datetime="message.createdAt">{{ formatTime(message.createdAt) }}</time>
          </span>
          <strong>{{ message.title }}</strong>
          <span class="message-content">{{ message.content }}</span>
          <span v-if="actionLabel(message)" class="message-action">
            {{ actionLabel(message) }} <PhArrowRight :size="15" />
          </span>
          <span v-else-if="markingIds.has(message.id)" class="message-action">正在确认已读…</span>
        </button>
        <span v-if="!message.readAt" class="unread-dot" aria-label="未读"></span>
      </article>

      <div v-if="loading && !items.length" class="state-card" role="status">
        <PhBell :size="34" />
        <p>正在收取消息…</p>
      </div>
      <div v-else-if="listError && !items.length" class="state-card error" role="alert">
        <PhBell :size="34" />
        <p>{{ listError }}</p>
        <button @click="messages.loadMessages(true)">重新加载</button>
      </div>
      <div v-else-if="!items.length" class="state-card">
        <PhCheck :size="34" />
        <p>暂时没有消息</p>
        <span>安静也是生活留给你的一点空白。</span>
      </div>

      <p v-if="listError && items.length" class="inline-error" role="alert">
        {{ listError }}
        <button @click="messages.loadMessages(false)">重试</button>
      </p>
      <button
        v-else-if="hasMore"
        class="load-more"
        :disabled="loadingMore"
        @click="messages.loadMessages()"
      >
        {{ loadingMore ? '正在加载…' : '加载更多' }}
      </button>
      <p v-else-if="items.length" class="end-note">所有消息都已抵达</p>
    </section>
  </main>
</template>

<style scoped lang="less">
.messages-shell {
  width: min(100%, 520px);
  min-height: 100svh;
  margin: 0 auto;
  padding: max(50px, env(safe-area-inset-top)) 24px 116px;
  color: #f8f1e8;
  background: radial-gradient(circle at 85% 5%, #34463f 0, transparent 28%), #142326;
}

button {
  font: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid #efae8e;
    outline-offset: 3px;
  }
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.page-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  color: #e8785e;
  font-size: 13px;
  letter-spacing: 0.14em;
}

h1 {
  margin: 0;
  font:
    600 clamp(30px, 8vw, 43px) / 1.35 'Noto Serif SC',
    serif;
  letter-spacing: -0.07em;
}

.read-all {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px 0;
  border: 0;
  color: #edc6a9;
  background: transparent;
  font-size: 12px;

  &:disabled {
    opacity: 0.42;
    cursor: default;
  }
}

.summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 25px;
  margin-top: 30px;
  color: #94a39e;
  font-size: 11px;

  button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    color: #ff9a80;
    background: transparent;
  }
}

.action-error,
.inline-error {
  color: #ffb49b;
  font-size: 12px;
}

.message-list {
  margin-top: 13px;

  article {
    position: relative;
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 13px;
    margin-bottom: 12px;
    padding: 18px 17px;
    border: 1px solid #f0dfc614;
    border-radius: 18px;
    background: #1b2c2f;

    &.unread {
      border-color: #efae8e3d;
      background: linear-gradient(135deg, #27383a, #1d2f31);
    }
  }
}

.type-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  color: #efae8e;
  background: #efae8e12;
}

.message-main {
  display: flex;
  min-width: 0;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  flex-direction: column;

  > strong {
    margin-top: 9px;
    font:
      500 17px/1.5 'Noto Serif SC',
      serif;
  }
}

.message-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  color: #83918d;
  font-size: 10px;

  b {
    color: #d5b398;
    font-weight: 500;
  }
}

.message-content {
  margin-top: 5px;
  color: #a3afaa;
  font-size: 12px;
  line-height: 1.75;
}

.message-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  color: #f18a70;
  font-size: 12px;
}

.unread-dot {
  position: absolute;
  top: 18px;
  right: 16px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff765c;
  box-shadow: 0 0 0 4px #ff765c14;
}

.state-card {
  display: grid;
  place-items: center;
  margin-top: 32px;
  padding: 50px 20px;
  border-top: 1px solid #f0dfc61f;
  color: #b89379;
  text-align: center;

  p {
    margin: 14px 0 4px;
    color: #e8dac7;
  }

  span {
    color: #82908b;
    font-size: 12px;
  }

  button {
    margin-top: 12px;
    padding: 9px 18px;
    border: 1px solid #efae8e55;
    border-radius: 999px;
    color: #efae8e;
    background: transparent;
  }
}

.inline-error {
  text-align: center;

  button {
    padding: 0;
    border: 0;
    color: inherit;
    background: transparent;
    text-decoration: underline;
  }
}

.load-more {
  display: block;
  min-width: 120px;
  min-height: 42px;
  margin: 24px auto 0;
  border: 1px solid #edc6a938;
  border-radius: 999px;
  color: #edc6a9;
  background: transparent;

  &:disabled {
    opacity: 0.5;
  }
}

.end-note {
  margin: 28px 0 0;
  color: #657570;
  font-size: 11px;
  text-align: center;
}

@media (max-width: 380px) {
  .page-header {
    display: block;
  }

  .read-all {
    margin-top: 10px;
  }
}
</style>
