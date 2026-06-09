<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'
import { sortRankings } from '../lib/scoring'
import PoolNav from '../components/PoolNav.vue'
import type { RankingEntry } from '../types'

const auth = useAuthStore()
const api = useApi()

const rankings = ref<RankingEntry[]>([])
const loading = ref(true)
const showRules = ref(false)

onMounted(async () => {
  try {
    const data = await api.bets.ranking(auth.token!)
    rankings.value = sortRankings(data.rankings)
  } finally {
    loading.value = false
  }
})

function groupHits(entry: RankingEntry): number {
  return Math.floor(((entry.group_points ?? 0) + (entry.best_third_points ?? 0)) / 5)
}

function matchHits(entry: RankingEntry): number {
  return Math.max(0, Math.floor(((entry.match_points ?? 0) - (entry.exact_score_count ?? 0) * 5) / 5))
}

const leader = computed(() => rankings.value[0])
</script>

<template>
  <div class="page">
    <PoolNav />

    <div class="ranking-hero">
      <div>
        <h1 class="page-title">Ranking</h1>
        <p class="page-sub">Pontuação do bolão · desempate por placares exatos e artilheiro correto</p>
      </div>
      <button class="btn btn-ghost ranking-rules-btn" type="button" @click="showRules = !showRules">
        {{ showRules ? 'Ocultar regras' : 'Regras de Pontuação' }}
      </button>
    </div>

    <Transition name="rules">
      <section v-if="showRules" class="ranking-rules card">
        <h2>Regras de pontuação</h2>
        <div class="ranking-rules__grid">
          <article>
            <strong>Fase de grupos</strong>
            <p>Você ganha <b>5 pontos</b> por cada posição correta: 1º, 2º ou terceiro classificado.</p>
          </article>
          <article>
            <strong>Mata-mata</strong>
            <p><b>5 pontos</b> por acertar o vencedor ou empate no tempo normal.</p>
          </article>
          <article>
            <strong>Placar exato</strong>
            <p>Se cravar o placar, ganha mais <b>5 pontos extras</b>. Total máximo: 10 pontos por jogo.</p>
          </article>
          <article>
            <strong>Desempate</strong>
            <p>Empates no total são ordenados por mais placares exatos e depois por artilheiro correto.</p>
          </article>
        </div>
      </section>
    </Transition>

    <div v-if="loading" style="color:var(--text-muted)">Carregando...</div>

    <div v-else-if="rankings.length === 0" class="card ranking-empty">
      Ninguém pontuou ainda.
    </div>

    <div v-else class="ranking-shell card">
      <div v-if="leader" class="ranking-leader">
        <span class="ranking-leader__eyebrow">Líder</span>
        <strong>{{ leader.username }}</strong>
        <span>{{ leader.total_points }} pts</span>
      </div>

      <table class="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>
              <span class="th-help" title="Nome do participante no bolão">Jogador</span>
            </th>
            <th>
              <span class="th-help" title="Soma total dos pontos conquistados no bolão">Pontos</span>
            </th>
            <th>
              <span class="th-help" title="Quantidade de acertos na fase de grupos: 1º, 2º ou terceiro classificado">Grupos</span>
            </th>
            <th>
              <span class="th-help" title="Quantidade de jogos do mata-mata em que acertou o vencedor ou empate no tempo normal">Acertos</span>
            </th>
            <th>
              <span class="th-help" title="Quantidade de placares exatos cravados no mata-mata">Exatos</span>
            </th>
            <th>
              <span class="th-help" title="Jogador escolhido como artilheiro do torneio. Também serve como critério de desempate quando estiver correto.">Artilheiro</span>
            </th>
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
            <td class="ranking-player">
              <strong>{{ entry.username }}</strong>
              <span v-if="entry.member_id === auth.member?.id">você</span>
            </td>
            <td class="points-cell">{{ entry.total_points }}</td>
            <td>{{ groupHits(entry) }}</td>
            <td>{{ matchHits(entry) }}</td>
            <td>{{ entry.exact_score_count }}</td>
            <td>
              <span class="top-scorer-pick" :class="{ correct: entry.top_scorer_correct }">
                {{ entry.top_scorer_pick }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
