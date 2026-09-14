<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getAccessToken } from '@/api/http'
import BottomNav from '@/components/BottomNav.vue'
import { useMessagesStore } from '@/stores/messages'

const route = useRoute()
const messages = useMessagesStore()
const showNavigation = computed(() => Boolean(route.meta.showNavigation))

watch(
  () => route.fullPath,
  () => {
    if (getAccessToken()) messages.start()
  },
  { immediate: true },
)
</script>

<template>
  <RouterView />
  <BottomNav v-if="showNavigation" />
</template>
