<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import { useJourneyStore } from '@/stores/journey'

const journey = useJourneyStore()
const { records } = storeToRefs(journey)

const formatDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(new Date(date))
    : ''

onMounted(() => void journey.loadRecords())
</script>

<template>
  <main class="page-shell">
    <p class="page-kicker">我的记录</p>
    <h1>你走过的支线，<br />都在这里发着光</h1>

    <div v-if="records.length" class="memory-list">
      <article v-for="memory in records" :key="memory.id" :class="{ 'has-image': memory.imageUrl }">
        <img v-if="memory.imageUrl" :src="memory.imageUrl" alt="支线记录照片" />
        <div>
          <time>{{ formatDate(memory.completedAt) }}</time>
          <h2>{{ memory.questTitle }}</h2>
          <p>{{ memory.note || '这一刻，值得被记住。' }}</p>
        </div>
      </article>
    </div>
    <div v-else class="empty">还没有记录。<br />去完成你的第一条人生支线吧。</div>
  </main>
</template>

<style scoped lang="less">
.page-shell {
  width: min(100%, 520px);
  min-height: 100svh;
  margin: 0 auto;
  padding: max(54px, env(safe-area-inset-top)) 26px 110px;
  color: #182426;
  background: #f4efe5;
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

.memory-list {
  margin-top: 36px;

  article {
    display: grid;
    grid-template-columns: 1fr;
    padding: 20px 0;
    gap: 18px;
    border-top: 1px solid #d8d2c8;

    &.has-image {
      grid-template-columns: 105px 1fr;
    }
  }

  img {
    width: 105px;
    height: 132px;
    border-radius: 3px;
    object-fit: cover;
  }

  time {
    color: #e4664f;
    font-size: 12px;
  }

  h2 {
    margin: 7px 0;
    font:
      600 18px/1.45 'Noto Serif SC',
      serif;
  }

  p {
    margin: 0;
    color: #777b77;
    font-size: 13px;
    line-height: 1.6;
  }
}

.empty {
  margin-top: 56px;
  padding: 30px 0;
  color: #858983;
  border-top: 1px solid #d8d2c8;
  line-height: 1.8;
}
</style>
