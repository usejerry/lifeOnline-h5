<script setup lang="ts">
import { PhBell, PhCompass, PhNotebook, PhSparkle, PhUser } from '@phosphor-icons/vue'
import { computed } from 'vue'

import { useMessagesStore } from '@/stores/messages'

const messages = useMessagesStore()
const badge = computed(() => {
  const count = messages.unreadCount
  if (count === null || count === 0) return ''
  return count > 99 ? '99+' : String(count)
})
const messageLabel = computed(() =>
  messages.unreadCount === null ? '消息，未读数量暂不可用' : `消息，${messages.unreadCount} 条未读`,
)
</script>

<template>
  <nav class="bottom-nav" aria-label="主导航">
    <RouterLink to="/today"><PhSparkle />今日</RouterLink>
    <RouterLink to="/explore"><PhCompass />探索</RouterLink>
    <RouterLink to="/records"><PhNotebook />记录</RouterLink>
    <RouterLink to="/messages" :aria-label="messageLabel">
      <span class="nav-icon"
        ><PhBell /><b v-if="badge">{{ badge }}</b></span
      >
      消息
    </RouterLink>
    <RouterLink to="/profile"><PhUser />我的</RouterLink>
  </nav>
</template>

<style scoped lang="less">
.bottom-nav {
  position: fixed;
  z-index: 20;
  bottom: 0;
  left: 50%;
  width: min(100%, 520px);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 12px 16px calc(10px + env(safe-area-inset-bottom));
  background: rgba(13, 23, 25, 0.96);
  backdrop-filter: blur(18px);
  transform: translateX(-50%);

  a {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 2px 0 5px;
    color: #9ca4a2;
    font-size: 12px;
    text-decoration: none;

    svg {
      width: 22px;
      height: 22px;
    }

    &.router-link-active {
      color: #ff7157;

      &::after {
        position: absolute;
        bottom: -5px;
        left: 50%;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
        content: '';
      }
    }

    &:focus-visible {
      border-radius: 4px;
      outline: 2px solid #ff7157;
      outline-offset: 3px;
    }
  }

  .nav-icon {
    position: relative;
    display: grid;
    place-items: center;

    b {
      position: absolute;
      top: -8px;
      left: 14px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border: 2px solid #0d1719;
      border-radius: 9px;
      color: #fff;
      background: #ff7157;
      font-size: 9px;
      font-weight: 700;
      line-height: 13px;
      text-align: center;
    }
  }
}
</style>
