<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = computed(() => route.params.token as string)

const links = computed(() => {
  const base = `/b/${token.value}`
  const items = [
    { to: base, label: 'Início', exact: true },
    { to: `${base}/grupos`, label: 'Grupos' },
    { to: `${base}/partidas`, label: 'Partidas' },
    { to: `${base}/ranking`, label: 'Ranking' },
  ]
  if (auth.isAdmin) items.push({ to: `${base}/admin`, label: 'Admin' })
  return items
})

function isActive(path: string, exact = false) {
  if (exact) return route.path === path
  return route.path.startsWith(path) && !(path === `/b/${token.value}` && route.path !== path)
}

function logout() {
  auth.logout()
  router.push(`/b/${token.value}`)
}
</script>

<template>
  <nav class="pool-nav" v-if="auth.isAuthenticated">
    <div class="pool-nav__links">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="pool-nav__link"
        :class="{ active: isActive(link.to, link.exact) }"
      >
        {{ link.label }}
      </router-link>
    </div>
    <button class="pool-nav__logout" @click="logout">Sair</button>
  </nav>
</template>
