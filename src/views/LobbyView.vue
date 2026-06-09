<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'
import PoolNav from '../components/PoolNav.vue'
import type { Pool } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const api = useApi()

const token = computed(() => route.params.token as string)
const pool = ref<Pool | null>(null)
const tab = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const topScorerPick = ref('')
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const data = await api.pools.get(token.value)
    pool.value = data.pool
    if (auth.poolToken === token.value) {
      const ok = await auth.bootstrap(token.value)
      if (ok) return
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Bolão não encontrado'
  }
})

async function login() {
  error.value = ''
  loading.value = true
  try {
    const { member, token: jwt } = await api.auth.login({
      inviteToken: token.value,
      username: username.value,
      password: password.value,
    })
    auth.setSession(jwt, member, token.value)
    router.push(`/b/${token.value}/grupos`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao entrar'
  } finally {
    loading.value = false
  }
}

async function register() {
  error.value = ''
  loading.value = true
  try {
    const { member, token: jwt } = await api.auth.register({
      inviteToken: token.value,
      username: username.value,
      password: password.value,
      topScorerPick: topScorerPick.value,
    })
    auth.setSession(jwt, member, token.value)
    router.push(`/b/${token.value}/grupos`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao registrar'
  } finally {
    loading.value = false
  }
}

const inviteUrl = computed(() => `${window.location.origin}/b/${token.value}`)
</script>

<template>
  <div class="page">
    <PoolNav />

    <template v-if="auth.isAuthenticated && pool">
      <h1 class="page-title">{{ pool.name }}</h1>
      <p class="page-sub">Bem-vindo, <strong>{{ auth.member?.username }}</strong></p>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
        <router-link :to="`/b/${token}/grupos`" class="btn btn-primary">Apostar nos grupos</router-link>
        <router-link :to="`/b/${token}/partidas`" class="btn btn-ghost">Mata-mata</router-link>
        <router-link :to="`/b/${token}/ranking`" class="btn btn-ghost">Ranking</router-link>
      </div>
    </template>

    <template v-else-if="pool">
      <h1 class="page-title">{{ pool.name }}</h1>
      <p class="page-sub">{{ pool.memberCount }} participante(s) · Copa 2026</p>

      <div class="auth-card card">
        <div class="tabs">
          <button class="tab" :class="{ active: tab === 'login' }" @click="tab = 'login'">Entrar</button>
          <button class="tab" :class="{ active: tab === 'register' }" @click="tab = 'register'">Novo jogador</button>
        </div>

        <form @submit.prevent="tab === 'login' ? login() : register()">
          <div class="field">
            <label class="label">Username</label>
            <input v-model="username" class="input" placeholder="seu_nome" required minlength="3" />
          </div>
          <div class="field">
            <label class="label">Senha do bolão</label>
            <input v-model="password" class="input" type="password" required minlength="4" />
          </div>
          <div class="field" v-if="tab === 'register'">
            <label class="label">Artilheiro da Copa</label>
            <input v-model="topScorerPick" class="input" placeholder="Ex: Vini Jr" required />
          </div>
          <p v-if="error" class="error-msg">{{ error }}</p>
          <button class="btn btn-primary" type="submit" :disabled="loading" style="width:100%">
            {{ loading ? '...' : tab === 'login' ? 'Entrar' : 'Criar conta' }}
          </button>
        </form>
      </div>

      <div class="invite-box" style="margin-top:2rem">
        Link de convite: <strong>{{ inviteUrl }}</strong>
      </div>
    </template>

    <p v-else-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>
