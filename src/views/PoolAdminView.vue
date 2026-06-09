<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'
import PoolNav from '../components/PoolNav.vue'
import type { Member } from '../types'

const route = useRoute()
const auth = useAuthStore()
const api = useApi()

const members = ref<Member[]>([])
const loading = ref(true)
const error = ref('')

const inviteUrl = `${window.location.origin}/b/${route.params.token}`

onMounted(async () => {
  try {
    const data = await api.admin.members(auth.token!)
    members.value = data.members
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar'
  } finally {
    loading.value = false
  }
})

async function removeMember(memberId: string) {
  if (!confirm('Remover este membro?')) return
  try {
    await api.admin.removeMember(auth.token!, memberId)
    members.value = members.value.filter((m) => m.id !== memberId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao remover'
  }
}

function copyLink() {
  navigator.clipboard.writeText(inviteUrl)
}
</script>

<template>
  <div class="page">
    <PoolNav />

    <h1 class="page-title">Admin do bolão</h1>
    <p class="page-sub">Gerencie membros e compartilhe o convite</p>

    <div class="card" style="margin-bottom:1.5rem">
      <p style="margin-bottom:0.75rem;color:var(--text-muted);font-size:0.9rem">Link de convite</p>
      <div class="invite-box" style="margin:0">{{ inviteUrl }}</div>
      <button class="btn btn-ghost" style="margin-top:0.75rem" @click="copyLink">Copiar link</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table class="ranking-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Artilheiro</th>
            <th>Papel</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td><strong>{{ m.username }}</strong></td>
            <td style="color:var(--text-muted)">{{ m.top_scorer_pick }}</td>
            <td>{{ m.role === 'admin' ? 'Admin' : 'Membro' }}</td>
            <td>
              <button
                v-if="m.id !== auth.member?.id"
                class="btn btn-ghost"
                style="padding:0.35rem 0.6rem;font-size:0.8rem"
                @click="removeMember(m.id)"
              >
                Remover
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>
