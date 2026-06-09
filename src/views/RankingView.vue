<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'
import { sortRankings } from '../lib/scoring'
import PoolNav from '../components/PoolNav.vue'
import type { RankingEntry } from '../types'

const auth = useAuthStore()
const api = useApi()

const rankings = ref<RankingEntry[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await api.bets.ranking(auth.token!)
    rankings.value = sortRankings(data.rankings)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <PoolNav />

    <h1 class="page-title">Ranking</h1>
    <p class="page-sub">Desempate: placares exatos → artilheiro correto</p>

    <div v-if="loading" style="color:var(--text-muted)">Carregando...</div>

    <div v-else class="card" style="padding:0;overflow:hidden">
      <table class="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pontos</th>
            <th>Grupos</th>
            <th>3ºs</th>
            <th>Jogos</th>
            <th>Exatos</th>
            <th>Artilheiro</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(entry, i) in rankings"
            :key="entry.member_id"
            :class="{ me: entry.member_id === auth.member?.id }"
          >
            <td>
              <span class="rank-pos" :class="{ top: i < 3 }">{{ i + 1 }}</span>
            </td>
            <td>
              <strong>{{ entry.username }}</strong>
              <span v-if="entry.member_id === auth.member?.id" style="color:var(--accent);font-size:0.75rem;margin-left:0.5rem">você</span>
            </td>
            <td class="points-cell">{{ entry.total_points }}</td>
            <td>{{ entry.group_points }}</td>
            <td>{{ entry.best_third_points }}</td>
            <td>{{ entry.match_points }}</td>
            <td>{{ entry.exact_score_count }}</td>
            <td>{{ entry.top_scorer_correct ? '✓' : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
