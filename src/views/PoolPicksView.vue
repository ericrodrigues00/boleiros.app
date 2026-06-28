<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'
import PoolNav from '../components/PoolNav.vue'
import MemberPicksList from '../components/MemberPicksList.vue'
import type { KnockoutMatchInfo } from '../components/MemberKnockoutPicks.vue'
import type { AnalysisPick } from '../lib/groupAnalysis'
import type { GroupResult } from '../lib/pickCorrectness'

const auth = useAuthStore()
const api = useApi()

type MemberRow = {
  id: string
  username: string
  top_scorer_pick: string
}

const members = ref<MemberRow[]>([])
const picks = ref<AnalysisPick[]>([])
const groupResults = ref<GroupResult[]>([])
const knockoutMatches = ref<KnockoutMatchInfo[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const data = await api.bets.poolPicks(auth.token!)
    members.value = data.members ?? []
    picks.value = data.picks ?? []
    groupResults.value = data.groupResults ?? []
    knockoutMatches.value = data.knockoutMatches ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar palpites'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <PoolNav />

    <h1 class="page-title">Palpites do bolão</h1>
    <p class="page-sub">Veja o que cada participante apostou na fase de grupos e no mata-mata</p>

    <MemberPicksList
      :members="members"
      :picks="picks"
      :group-results="groupResults"
      :knockout-matches="knockoutMatches"
      :loading="loading"
      :highlight-member-id="auth.member?.id"
    />

    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>
