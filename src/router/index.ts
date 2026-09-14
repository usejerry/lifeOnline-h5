import { createRouter, createWebHistory } from 'vue-router'

import { authRoutes } from './modules/auth'
import { getAccessToken, restoreSession } from '@/api/http'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...authRoutes,
    {
      path: '/today',
      name: 'today',
      component: () => import('@/views/TodayView.vue'),
      meta: { title: '今日支线', showNavigation: true },
    },
    {
      path: '/explore',
      name: 'explore',
      component: () => import('@/views/ExploreView.vue'),
      meta: { title: '探索', showNavigation: true },
    },
    {
      path: '/records',
      name: 'records',
      component: () => import('@/views/RecordsView.vue'),
      meta: { title: '记录', showNavigation: true, requiresAuth: true },
    },
    {
      path: '/messages',
      name: 'messages',
      component: () => import('@/views/MessagesView.vue'),
      meta: { title: '消息中心', showNavigation: true, requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { title: '我的世界', showNavigation: true, requiresAuth: true },
    },
    { path: '/', redirect: '/today' },
    { path: '/:pathMatch(.*)*', redirect: '/today' },
  ],
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 20, behavior: 'smooth' } : { top: 0 }),
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) await restoreSession()
  if (to.meta.requiresAuth && !getAccessToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  document.title = `${String(to.meta.title ?? '人生支线')} · 人生支线`
})

export default router

window.addEventListener('auth:cleared', () => {
  const route = router.currentRoute.value
  if (route.meta.requiresAuth)
    void router.replace({ name: 'login', query: { redirect: route.fullPath } })
})
