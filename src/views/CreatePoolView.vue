<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const api = useApi()

const name = ref('')
const poolPassword = ref('')
const memberPassword = ref('')
const username = ref('')
const topScorerPick = ref('')
const loading = ref(false)
const error = ref('')
const created = ref<{ inviteUrl: string; token: string } | null>(null)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const { pool, member, token } = await api.pools.create({
      name: name.value,
      poolPassword: poolPassword.value,
      memberPassword: memberPassword.value,
      username: username.value,
      topScorerPick: topScorerPick.value,
    })
    auth.setSession(token, member, pool.invite_token)
    const inviteUrl = `${window.location.origin}/b/${pool.invite_token}`
    created.value = { inviteUrl, token: pool.invite_token }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao criar bolão'
  } finally {
    loading.value = false
  }
}

function copyLink() {
  if (created.value) navigator.clipboard.writeText(created.value.inviteUrl)
}

function enterPool() {
  if (created.value) router.push(`/b/${created.value.token}/grupos`)
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">Criar bolão</h1>
    <p class="page-sub">Configure o bolão e compartilhe o link com seus amigos.</p>

    <div class="auth-card card" v-if="!created">
      <form @submit.prevent="submit">
        <div class="field">
          <label class="label">Nome do bolão</label>
          <input v-model="name" class="input" placeholder="Bolão da Firma" required />
        </div>
        <div class="field">
          <label class="label">Senha do bolão</label>
          <input v-model="poolPassword" class="input" type="password" placeholder="Senha de convite compartilhada" required minlength="4" />
        </div>
        <div class="field">
          <label class="label">Sua senha pessoal</label>
          <input v-model="memberPassword" class="input" type="password" placeholder="Usada só para entrar na sua conta" required minlength="6" />
        </div>
        <div class="field">
          <label class="label">Seu username</label>
          <input v-model="username" class="input" placeholder="seu_nome" required minlength="3" maxlength="20" />
        </div>
        <div class="field">
          <label class="label">Artilheiro da Copa</label>
          <input v-model="topScorerPick" class="input" placeholder="Ex: Mbappé" required />
        </div>
        <p v-if="error" class="error-msg">{{ error }}</p>
        <button class="btn btn-primary" type="submit" :disabled="loading" style="width:100%;margin-top:0.5rem">
          {{ loading ? 'Criando...' : 'Criar bolão' }}
        </button>
      </form>
    </div>

    <div class="auth-card card" v-else>
      <h2 style="margin-bottom:0.5rem">Bolão criado!</h2>
      <p style="color:var(--text-muted);margin-bottom:1rem">Compartilhe este link com seus amigos:</p>
      <div class="invite-box">
        <strong>{{ created.inviteUrl }}</strong>
      </div>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
        <button class="btn btn-ghost" @click="copyLink">Copiar link</button>
        <button class="btn btn-primary" @click="enterPool">Ir para o bolão</button>
      </div>
    </div>
  </div>
</template>
