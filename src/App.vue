<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import BottomNav from '@/components/BottomNav.vue'

const route = useRoute()
const showNavigation = computed(() => Boolean(route.meta.showNavigation))
</script>

<template>
  <RouterView />
  <BottomNav v-if="showNavigation" />
</template>
