<script setup lang="ts">
import { PhArrowUpRight, PhCheck, PhFootprints, PhX } from '@phosphor-icons/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  getSignInHistory,
  getSignInToday,
  signInToday,
  type SignInRecord,
  type SignInToday,
} from '@/api/sign-in'

const emit = defineEmits<{ changed: [] }>()
const today = ref<SignInToday | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const message = ref('')
const dialog = ref<HTMLDialogElement | null>(null)
const records = ref<SignInRecord[]>([])
const historyLoading = ref(false)
const historyError = ref('')
const historyTotal = ref(0)
const page = ref(0)
const signed = computed(() => today.value?.signedIn ?? false)
let previousOverflow = ''
let sheetOpen = false

function time(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
async function loadToday() {
  loading.value = true
  error.value = ''
  try {
    today.value = await getSignInToday()
  } catch {
    error.value = '签到状态加载失败，请重试'
  } finally {
    loading.value = false
  }
}
async function checkIn() {
  if (submitting.value || loading.value || signed.value || !today.value) return
  submitting.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await signInToday()
    // 签到已经确认；后续查询失败也不应让用户再次提交签到。
    today.value = { ...today.value, signedIn: true }
    message.value = result === false ? '今天已经留下脚印啦' : '今日签到成功，明天再见'
    await loadToday()
  } catch {
    error.value = '未能确认签到结果，请重试'
  } finally {
    // 重新读取服务端余额，兼容重复签到和响应丢失的情况。
    emit('changed')
    submitting.value = false
  }
}
async function loadHistory(reset = false) {
  if (historyLoading.value) return
  historyLoading.value = true
  historyError.value = ''
  const nextPage = reset ? 1 : page.value + 1
  try {
    const result = await getSignInHistory(nextPage)
    records.value = reset ? result.items : [...records.value, ...result.items]
    historyTotal.value = result.total
    page.value = result.page
  } catch {
    historyError.value = '记录加载失败，请重试'
  } finally {
    historyLoading.value = false
  }
}
function openHistory() {
  if (dialog.value?.open || historyLoading.value) return
  dialog.value?.showModal()
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  sheetOpen = true
  records.value = []
  page.value = 0
  historyTotal.value = 0
  void loadHistory(true)
}
function closeHistory() {
  dialog.value?.close()
}
function restoreScroll() {
  if (!sheetOpen) return
  document.body.style.overflow = previousOverflow
  sheetOpen = false
}
function backdropClick(event: MouseEvent) {
  if (event.target !== dialog.value || !dialog.value) return
  const bounds = dialog.value.getBoundingClientRect()
  if (
    event.clientY < bounds.top ||
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY > bounds.bottom
  )
    closeHistory()
}
function onVisible() {
  if (document.visibilityState === 'visible' && !loading.value && !submitting.value)
    void loadToday()
}
onMounted(() => {
  void loadToday()
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => {
  restoreScroll()
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <section
    id="daily-sign-in"
    class="check-in-card"
    aria-labelledby="check-in-title"
    :aria-busy="loading || submitting"
  >
    <div class="card-top">
      <span class="eyebrow"><PhFootprints :size="17" /> 每日签到</span
      ><span class="total"
        >累计 <b>{{ today?.total ?? '—' }}</b> 天</span
      >
    </div>
    <h2 id="check-in-title">{{ signed ? '今天，也留下了脚印' : '给今天留个脚印' }}</h2>
    <p class="description">每天来看看，也是一点小小的坚持。</p>
    <button
      class="check-in-button"
      :class="{ signed }"
      :disabled="loading || submitting || signed || !today"
      @click="checkIn"
    >
      <PhCheck v-if="signed" :size="19" weight="bold" />
      {{
        loading ? '正在获取签到状态…' : submitting ? '签到中…' : signed ? '今日已签到' : '今日签到'
      }}
      <PhArrowUpRight v-if="!signed && !loading && !submitting" :size="19" />
    </button>
    <div class="card-bottom">
      <span>{{
        signed && today?.record
          ? `${time(today.record.createdAt)} 已记录 · 北京时间`
          : '一天一次，慢慢积累'
      }}</span
      ><button class="history-link" @click="openHistory">
        签到记录 <PhArrowUpRight :size="14" />
      </button>
    </div>
    <p v-if="message" class="feedback" role="status">{{ message }}</p>
    <p v-if="error" class="feedback error" role="alert">
      {{ error }} <button :disabled="loading || submitting" @click="loadToday">重新获取</button>
    </p>
  </section>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="history-sheet"
      aria-labelledby="history-title"
      @click="backdropClick"
      @close="restoreScroll"
    >
      <div class="sheet-handle" aria-hidden="true"></div>
      <header class="sheet-header">
        <div>
          <span class="eyebrow">一步一步，都算数</span>
          <h2 id="history-title">签到记录</h2>
        </div>
        <button class="close-button" aria-label="关闭签到记录" @click="closeHistory">
          <PhX :size="22" />
        </button>
      </header>
      <p class="history-caption">每个平凡的日子，都值得留下印记。<span>北京时间</span></p>
      <div :aria-busy="historyLoading">
        <ul v-if="records.length" class="record-list">
          <li v-for="record in records" :key="record.id">
            <span class="record-icon"><PhCheck :size="16" /></span
            ><span>{{ record.checkInDate }}</span
            ><time :datetime="record.createdAt">{{ time(record.createdAt) }}</time>
          </li>
        </ul>
        <div v-else-if="!historyLoading && !historyError" class="empty-state">
          <PhFootprints :size="36" />
          <p>还没有签到记录</p>
          <span>今天开始，留下第一个脚印吧。</span>
        </div>
        <p v-if="historyLoading" class="history-status" role="status">正在加载记录…</p>
        <div v-else-if="historyError" class="history-status" role="alert">
          <p>{{ historyError }}</p>
          <button class="more-button" @click="loadHistory(page === 0)">重试</button>
        </div>
        <button
          v-else-if="records.length < historyTotal"
          class="more-button"
          @click="loadHistory()"
        >
          加载更多
        </button>
        <p v-else-if="records.length" class="history-status">
          已记录 {{ historyTotal }} 天，期待下一次相见
        </p>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped lang="less">
.check-in-card {
  margin-top: 30px;
  padding: 23px 21px 18px;
  border: 1px solid #e4ceb029;
  border-radius: 22px;
  background: linear-gradient(135deg, #223437, #1b2b2d);
  color: #f8f1e8;
}
.card-top,
.card-bottom,
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #e8ae89;
  font-size: 12px;
  letter-spacing: 0.08em;
}
.total {
  font-size: 12px;
  color: #a6b2ab;
  b {
    color: #f0dfc6;
    font-size: 18px;
    font-weight: 500;
    padding: 0 3px;
  }
}
h2 {
  margin: 22px 0 10px;
  font:
    500 24px/1.4 'Noto Serif SC',
    serif;
  letter-spacing: -0.04em;
}
.description {
  margin: 0;
  color: #a6b2ab;
  font-size: 12px;
  line-height: 1.8;
}
button {
  cursor: pointer;
  font: inherit;
}
button:focus-visible {
  outline: 2px solid #f0dfc6;
  outline-offset: 4px;
}
.check-in-button {
  width: 100%;
  margin-top: 23px;
  min-height: 48px;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 13px;
  color: #18282a;
  background: #efae8e;
  font-size: 15px;
  font-weight: 600;
  transition: background 0.2s;
  &:hover:not(:disabled) {
    background: #ffc5a7;
  }
  &:disabled {
    cursor: default;
  }
  &.signed {
    background: #d9e0c812;
    color: #c4d0b5;
    border: 1px solid #c4d0b52b;
  }
}
.card-bottom {
  margin-top: 15px;
  font-size: 10px;
  color: #9ca9a3;
  flex-wrap: wrap;
}
.history-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0;
  color: #edc6a9;
  background: none;
  border: 0;
  font-size: 12px;
}
.feedback {
  font-size: 12px;
  line-height: 1.7;
  color: #c4d0b5;
  margin: 8px 0 0;
  &.error {
    color: #ffb49b;
  }
  button {
    background: none;
    border: 0;
    color: inherit;
    text-decoration: underline;
  }
}
.history-sheet {
  position: fixed;
  inset: auto 0 0;
  width: min(100%, 520px);
  max-width: 100%;
  max-height: 82dvh;
  margin: 0 auto;
  padding: 12px 25px max(28px, env(safe-area-inset-bottom));
  border: 1px solid #e4ceb029;
  border-bottom: 0;
  border-radius: 26px 26px 0 0;
  background: #1b2b2d;
  color: #f8f1e8;
  box-sizing: border-box;
  overflow-y: auto;
  &::backdrop {
    background: #081314b8;
    backdrop-filter: blur(4px);
  }
}
.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 4px;
  background: #6f7e78;
  margin: 0 auto 24px;
}
.sheet-header h2 {
  margin: 8px 0 0;
  font-size: 28px;
}
.close-button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 1px solid #f0dfc622;
  border-radius: 50%;
  background: transparent;
  color: #e5d8c4;
}
.history-caption {
  font-size: 12px;
  color: #a6b2ab;
  line-height: 1.8;
  span {
    display: block;
    margin-top: 8px;
    font-size: 10px;
  }
}
.record-list {
  list-style: none;
  padding: 0;
  margin: 22px 0 0;
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 0;
    border-top: 1px solid #f0dfc617;
    font-size: 14px;
  }
  time {
    margin-left: auto;
    color: #a6b2ab;
    font-size: 12px;
  }
}
.record-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #c4d0b514;
  color: #c4d0b5;
}
.empty-state {
  text-align: center;
  padding: 42px 0;
  color: #d4b899;
  p {
    color: #f0dfc6;
  }
  span {
    font-size: 12px;
    color: #a6b2ab;
  }
}
.history-status {
  text-align: center;
  padding-top: 18px;
  font-size: 12px;
  color: #a6b2ab;
}
.more-button {
  display: block;
  margin: 20px auto 0;
  padding: 10px 24px;
  border: 1px solid #edc6a933;
  border-radius: 30px;
  color: #edc6a9;
  background: transparent;
  font-size: 13px;
}
</style>
