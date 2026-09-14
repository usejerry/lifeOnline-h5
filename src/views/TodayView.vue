<script setup lang="ts">
import { PhArrowRight, PhArrowsClockwise, PhPlanet, PhSparkle } from '@phosphor-icons/vue'
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getAccessToken } from '@/api/http'
import type { QuestRecord } from '@/api/quest-record'
import { useAuthStore } from '@/stores/auth'
import { type Mood, useJourneyStore } from '@/stores/journey'
import { getBrowserCoordinates } from '@/utils/geolocation'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const journey = useJourneyStore()
const { onboarded, mood, availableTime, scene, activeRecord, activeQuest, quest, loading } =
  storeToRefs(journey)

const onboardingStep = ref(0)
const completing = ref(false)
const result = ref<QuestRecord | null>(null)
const note = ref('')
const preview = ref('')
const selectedImage = ref<File | null>(null)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

function requireLogin() {
  if (getAccessToken()) return false
  void router.push({ name: 'login', query: { redirect: route.fullPath } })
  return true
}

async function finishOnboarding() {
  if (requireLogin()) return
  try {
    await journey.finishOnboarding()
    showToast('你的第一条支线已准备好')
  } catch {
    showToast('偏好保存失败，请稍后重试')
  }
}

async function switchQuest() {
  try {
    await journey.switchQuest()
    showToast('换了一条更适合此刻的支线')
  } catch {
    showToast('暂时没有更多合适的支线')
  }
}

async function acceptQuest() {
  if (requireLogin()) return
  try {
    await journey.acceptQuest()
    showToast('支线已接受，现在就出发吧')
  } catch {
    showToast('接受失败，请稍后重试')
  }
}

async function abandonQuest() {
  try {
    await journey.abandonQuest()
    showToast('已放弃这条支线')
  } catch {
    showToast('操作失败，请稍后重试')
  }
}

function handlePhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (preview.value) URL.revokeObjectURL(preview.value)
  selectedImage.value = file
  preview.value = URL.createObjectURL(file)
}

async function submitMemory() {
  try {
    // 地点任务必须把浏览器的实时坐标交给后端，由后端判断是否进入完成半径。
    const coordinates = activeRecord.value?.target ? await getBrowserCoordinates() : undefined
    const memory = await journey.completeQuest(note.value, selectedImage.value, coordinates)
    if (!memory) return
    result.value = memory
    completing.value = false
    note.value = ''
  } catch {
    showToast(activeRecord.value?.target ? '请开启定位并在目标附近完成' : '提交失败，请稍后重试')
  }
}

function closeResult() {
  result.value = null
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  selectedImage.value = null
}

onMounted(() => {
  void journey
    .initialize()
    .then(async () => {
      const requestedId = Number(route.query.recordId)
      if (!Number.isInteger(requestedId) || requestedId <= 0) return
      if (activeRecord.value?.id === requestedId) return

      // 消息只能继续它关联的原记录，不能把旧提醒误导向后来接取的新支线。
      showToast('这条支线已经结束，无法继续')
      const query = { ...route.query }
      delete query.recordId
      await router.replace({ query })
    })
    .catch(() => showToast('页面加载失败，请稍后重试'))
})
onBeforeUnmount(() => {
  if (preview.value) URL.revokeObjectURL(preview.value)
})

function shareMemory() {
  showToast('纪念卡已保存，可以分享给朋友了')
}
</script>

<template>
  <main class="today-shell">
    <Transition name="fade">
      <section v-if="!onboarded" class="onboarding">
        <p class="wordmark">人生支线</p>

        <div v-if="onboardingStep === 0" class="onboarding-copy">
          <p class="kicker">欢迎抵达</p>
          <h1>普通的一天，<br />也可以有隐藏剧情。</h1>
          <p>我们会根据你当下的状态，推荐一件值得去做的小事。</p>
          <button class="primary" @click="onboardingStep = 1">开始设置</button>
        </div>

        <div v-else class="onboarding-copy setup">
          <p class="kicker">1 / 1</p>
          <h1>告诉我，<br />你此刻需要什么？</h1>
          <label>当下心情</label>
          <div class="choice-row">
            <button
              v-for="item in ['松弛', '新鲜', '成就感', '陪伴'] as Mood[]"
              :key="item"
              :class="{ selected: mood === item }"
              @click="journey.selectMood(item)"
            >
              {{ item }}
            </button>
          </div>
          <label>可用时间</label>
          <div class="choice-row compact">
            <button
              v-for="item in ['5分钟', '20分钟', '1小时']"
              :key="item"
              :class="{ selected: availableTime === item }"
              @click="availableTime = item"
            >
              {{ item }}
            </button>
          </div>
          <label>想去哪里</label>
          <div class="choice-row compact">
            <button
              v-for="item in ['室内', '室外', '都可以']"
              :key="item"
              :class="{ selected: scene === item }"
              @click="scene = item"
            >
              {{ item }}
            </button>
          </div>
          <button class="primary" @click="finishOnboarding">生成我的今日支线</button>
        </div>
      </section>
    </Transition>

    <section v-if="onboarded" class="today">
      <header class="greeting">
        <p>
          下午好，<span>{{ auth.user?.username || '旅行者' }}</span>
        </p>
        <h1>今天，给生活加一点新鲜</h1>
        <div class="moods" aria-label="选择当下心情">
          <button
            v-for="item in ['松弛', '新鲜', '成就感', '陪伴'] as Mood[]"
            :key="item"
            :class="{ selected: mood === item }"
            @click="void journey.selectMood(item)"
          >
            {{ item }}
          </button>
        </div>
      </header>

      <article class="quest-panel">
        <p v-if="loading" class="quest-label">正在寻找适合此刻的支线...</p>
        <template v-else-if="!activeQuest && quest">
          <p class="quest-label"><PhSparkle weight="fill" />今日支线</p>
          <h2>{{ quest.title }}</h2>
          <p class="meta">
            {{ quest.durationLabel }} <i></i> {{ quest.distanceLabel }} <i></i>
            {{ quest.settingLabel }}
          </p>
          <p class="quest-prompt">{{ quest.prompt }}</p>
          <div class="quest-actions">
            <button class="primary" @click="acceptQuest">接受支线 <PhArrowRight /></button>
            <button class="secondary" @click="switchQuest">换一个 <PhArrowsClockwise /></button>
          </div>
        </template>

        <template v-else-if="activeQuest">
          <p class="quest-label"><PhPlanet weight="fill" />进行中</p>
          <h2>{{ activeQuest.title }}</h2>
          <p class="meta">从你接受它的那一刻，故事已经开始了。</p>
          <div class="quest-actions active-actions">
            <button class="primary" @click="completing = true">我完成了</button>
            <button class="secondary" @click="abandonQuest">放弃</button>
          </div>
        </template>
        <p v-else class="quest-label">暂时没有合适的支线，请换个心情试试。</p>
      </article>
    </section>

    <Transition name="sheet">
      <section v-if="completing && activeQuest" class="completion-layer">
        <button class="close" aria-label="关闭" @click="completing = false">关闭</button>
        <p class="kicker">完成支线</p>
        <h1>你想怎么<br />记住这一刻？</h1>
        <label class="photo-input" :class="{ filled: preview }">
          <img v-if="preview" :src="preview" alt="待提交的支线照片" />
          <span v-else>添加一张照片</span>
          <input type="file" accept="image/*" @change="handlePhoto" />
        </label>
        <label for="memory-note">留下一句话</label>
        <textarea
          id="memory-note"
          v-model="note"
          rows="4"
          placeholder="此刻有什么想记住的？"
        ></textarea>
        <button class="primary" @click="submitMemory">生成生活纪念卡</button>
      </section>
    </Transition>

    <Transition name="fade">
      <section v-if="result" class="result-layer">
        <div class="memory-card">
          <img v-if="result.imageUrl" :src="result.imageUrl" alt="生活纪念" />
          <div class="memory-card-copy">
            <p>
              {{
                new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(
                  new Date(result.completedAt!),
                )
              }}
              · 人生支线
            </p>
            <h1>{{ result.questTitle }}</h1>
            <blockquote>“{{ result.note || '这一刻，值得被记住。' }}”</blockquote>
          </div>
        </div>
        <p class="result-note">今天的你，去了一个昨天没去过的地方。</p>
        <button class="primary" @click="shareMemory">保存并分享</button>
        <RouterLink class="text-button" to="/records" @click="closeResult">
          收进我的记录
        </RouterLink>
      </section>
    </Transition>

    <Transition name="toast"
      ><p v-if="toast" class="toast">{{ toast }}</p></Transition
    >
  </main>
</template>

<style scoped lang="less">
button {
  border: 0;
  cursor: pointer;
}

.today-shell {
  width: min(100%, 520px);
  min-height: 100svh;
  margin: 0 auto;
  overflow: hidden;
  color: #f9f3e9;
  background: #0d1719;
}

.today {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  padding-bottom: 86px;
  background: url('@/assets/lane-quest.png') center/cover no-repeat;

  &::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(255, 247, 227, 0.04) 24%,
      rgba(8, 17, 19, 0.12) 49%,
      rgba(8, 17, 19, 0.94) 76%,
      #0d1719 100%
    );
    content: '';
  }
}

.greeting {
  position: relative;
  z-index: 1;
  padding: max(38px, env(safe-area-inset-top)) 28px 0;
  color: #102125;
  text-shadow: 0 1px 12px rgba(255, 250, 235, 0.35);

  > p {
    margin: 0;
    font:
      600 clamp(32px, 9vw, 48px) / 1.2 'Noto Serif SC',
      serif;
    letter-spacing: -2px;

    span {
      color: #eb6d55;
    }
  }

  h1 {
    margin: 10px 0 24px;
    font:
      600 16px/1.4 'Noto Serif SC',
      serif;
    letter-spacing: 0.08em;
  }
}

.moods,
.choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    padding: 10px 16px;
    border-radius: 999px;
    color: #243032;
    background: rgba(241, 234, 215, 0.8);
    backdrop-filter: blur(8px);

    &.selected {
      color: #fff;
      background: #ec7159;
    }
  }
}

.quest-panel {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding: 32px 28px 24px;

  h2 {
    margin: 0;
    white-space: pre-line;
    font:
      600 clamp(29px, 8.4vw, 42px) / 1.42 'Noto Serif SC',
      serif;
    letter-spacing: -0.06em;
  }
}

.kicker,
.quest-label {
  margin: 0 0 18px;
  color: #ff755c;
  font-size: 14px;
  letter-spacing: 0.16em;
}

.quest-label {
  display: flex;
  align-items: center;
  gap: 9px;

  svg {
    width: 17px;
    height: 17px;
  }
}

.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0 0;
  color: #cec7bd;
  font-size: 14px;

  i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
  }
}

.quest-prompt {
  margin: 14px 0 0;
  color: #9fa8a6;
  font-size: 13px;
  line-height: 1.7;
}

.quest-actions {
  display: grid;
  grid-template-columns: 1.7fr 0.9fr;
  gap: 12px;
  margin-top: 24px;

  &.active-actions {
    grid-template-columns: 1fr 0.55fr;
  }
}

.primary,
.secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  gap: 9px;
  border-radius: 999px;
  font-weight: 600;

  svg {
    width: 19px;
    height: 19px;
  }
}

.primary {
  color: #fff;
  background: #ff6f54;
  box-shadow: 0 16px 38px rgba(255, 105, 80, 0.25);
}

.secondary {
  color: #f7efe5;
  border: 1px solid rgba(247, 239, 229, 0.55);
  background: rgba(14, 24, 26, 0.24);
  backdrop-filter: blur(10px);
}

.onboarding {
  position: fixed;
  z-index: 50;
  inset: 0;
  overflow-y: auto;
  padding: max(38px, env(safe-area-inset-top)) 28px 40px;
  background: #142326 url('@/assets/lane-quest.png') 65% center/cover no-repeat;

  &::after {
    position: absolute;
    inset: 0;
    background: rgba(7, 16, 18, 0.76);
    content: '';
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

.wordmark {
  margin: 0;
  font:
    600 18px 'Noto Serif SC',
    serif;
  letter-spacing: 0.16em;
}

.onboarding-copy {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: calc(100svh - 110px);
  max-width: 450px;
  margin: 0 auto;

  h1,
  .completion-layer h1 {
    margin: 0 0 20px;
    font:
      600 clamp(34px, 9vw, 48px) / 1.35 'Noto Serif SC',
      serif;
    letter-spacing: -0.07em;
  }

  > p:not(.kicker) {
    color: #bcc3c1;
    line-height: 1.8;
  }

  > .primary {
    margin-top: 26px;
  }

  &.setup {
    justify-content: center;
    padding-top: 50px;

    label {
      margin: 22px 0 10px;
      color: #aeb7b4;
      font-size: 13px;
    }
  }
}

.completion-layer,
.result-layer {
  position: fixed;
  z-index: 60;
  inset: 0;
  overflow-y: auto;
  width: min(100%, 520px);
  margin: 0 auto;
  padding: max(60px, env(safe-area-inset-top)) 26px 40px;
}

.completion-layer {
  color: #172426;
  background: #f4efe5;

  h1 {
    margin: 0 0 20px;
    font:
      600 clamp(34px, 9vw, 48px) / 1.35 'Noto Serif SC',
      serif;
  }

  > label:not(.photo-input) {
    display: block;
    margin: 22px 0 10px;
    color: #68716f;
    font-size: 13px;
  }

  > .primary {
    width: 100%;
    margin-top: 24px;
  }
}

.close {
  position: absolute;
  top: 24px;
  right: 22px;
  color: #68716f;
  background: transparent;
}

.photo-input {
  display: grid;
  place-items: center;
  overflow: hidden;
  height: 240px;
  margin: 28px 0 6px;
  color: #68716f;
  border: 1px dashed #a9aaa4;
  background: #e7e0d5;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
}

textarea {
  width: 100%;
  padding: 16px;
  resize: vertical;
  color: #172426;
  border: 1px solid #d1cbc0;
  border-radius: 2px;
  outline: none;
  background: #fffdf8;

  &:focus {
    border-color: #ef7259;
    box-shadow: 0 0 0 3px rgba(239, 114, 89, 0.13);
  }
}

.result-layer {
  z-index: 70;
  text-align: center;
  background: #0d1719;

  > .primary {
    width: 100%;
    margin-top: 24px;
  }
}

.memory-card {
  position: relative;
  min-height: 525px;
  overflow: hidden;
  text-align: left;
  background: url('@/assets/lane-quest.png') center/cover no-repeat;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.32);

  &::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 30%, rgba(6, 14, 16, 0.9) 90%);
    content: '';
  }

  > img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.memory-card-copy {
  position: absolute;
  z-index: 1;
  right: 24px;
  bottom: 25px;
  left: 24px;

  p {
    color: #ff8068;
    font-size: 12px;
    letter-spacing: 0.12em;
  }

  h1 {
    margin: 10px 0;
    font:
      600 30px/1.45 'Noto Serif SC',
      serif;
  }

  blockquote {
    margin: 0;
    color: #d5d4ce;
    font-size: 13px;
    line-height: 1.7;
  }
}

.result-note {
  margin: 25px 10px 0;
  color: #a8b1ae;
  line-height: 1.7;
}

.text-button {
  display: block;
  margin-top: 20px;
  color: #bac2c0;
  text-underline-offset: 5px;
}

.toast {
  position: fixed;
  z-index: 100;
  bottom: 94px;
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

.fade-enter-active,
.fade-leave-active,
.sheet-enter-active,
.sheet-leave-active,
.toast-enter-active,
.toast-leave-active {
  transition: 0.35s ease;
}

.fade-enter-from,
.fade-leave-to,
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}

@media (max-width: 370px) {
  .greeting,
  .quest-panel {
    padding-right: 20px;
    padding-left: 20px;
  }

  .moods button {
    padding: 9px 12px;
  }
}
</style>
