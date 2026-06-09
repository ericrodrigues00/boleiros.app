import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    { path: '/criar', name: 'create', component: () => import('../views/CreatePoolView.vue') },
    {
      path: '/b/:token',
      name: 'lobby',
      component: () => import('../views/LobbyView.vue'),
      meta: { poolRoute: true },
    },
    {
      path: '/b/:token/grupos',
      name: 'groups',
      component: () => import('../views/GroupsView.vue'),
      meta: { poolRoute: true, requiresAuth: true },
    },
    {
      path: '/b/:token/partidas',
      name: 'matches',
      component: () => import('../views/MatchesView.vue'),
      meta: { poolRoute: true, requiresAuth: true },
    },
    {
      path: '/b/:token/ranking',
      name: 'ranking',
      component: () => import('../views/RankingView.vue'),
      meta: { poolRoute: true, requiresAuth: true },
    },
    {
      path: '/b/:token/admin',
      name: 'pool-admin',
      component: () => import('../views/PoolAdminView.vue'),
      meta: { poolRoute: true, requiresAuth: true, requiresAdmin: true },
    },
    { path: '/superadmin', name: 'superadmin', component: () => import('../views/SuperadminView.vue') },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const inviteToken = to.params.token as string | undefined

  if (inviteToken) {
    if (auth.poolToken && auth.poolToken !== inviteToken && to.meta.requiresAuth) {
      return { name: 'lobby', params: { token: inviteToken } }
    }
    if (to.meta.requiresAuth && !auth.isAuthenticated) {
      const ok = await auth.bootstrap(inviteToken)
      if (!ok) return { name: 'lobby', params: { token: inviteToken } }
    }
    if (to.meta.requiresAdmin && !auth.isAdmin) {
      return { name: 'lobby', params: { token: inviteToken } }
    }
  }
})

export default router
