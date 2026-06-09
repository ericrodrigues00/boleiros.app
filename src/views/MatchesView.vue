<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'
import { useTimer } from '../composables/useTimer'
import { getLockCountdown, formatCountdown, formatKickoff } from '../lib/scoring'
import PoolNav from '../components/PoolNav.vue'
import type { Match, MatchPrediction } from '../types'

const auth = useAuthStore()
const api = useApi()
useTimer()

const matches = ref<Match[]>([])
const predictions = ref<Record<string, { home: number; away: number }>>({})
const loading = ref(true)
const saving = ref<string | null>(null)
const error = ref('')

const stageLabels: Record<string, string> = {
  round_16: 'Oitavas',
  quarter: 'Quartas',
  semi: 'Semifinal',
  third_place: '3º lugar',
  final: 'Final',
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await api.bets.matches(auth.token!)
    matches.value = data.matches
    const preds: Record<string, { home: number; away: number }> = {}
    for (const p of data.predictions as MatchPrediction[]) {
      preds[p.match_id] = { home: p.home_score, away: p.away_score }
    }
    predictions.value = preds
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar'
  } finally {
    loading.value = false
  }
}

function teamName(match: Match, side: 'home' | 'away') {
  const team = side === 'home' ? match.home_team : match.away_team
  const label = side === 'home' ? match.home_label : match.away_label
  return team?.name ?? label ?? 'TBD'
}

function isLocked(match: Match) {
  if (match.locked) return true
  return getLockCountdown(match.kickoff_at) <= 0
}

function countdown(match: Match) {
  return formatCountdown(getLockCountdown(match.kickoff_at))
}

async function savePrediction(matchId: string) {
  const pred = predictions.value[matchId]
  if (!pred) return
  saving.value = matchId
  error.value = ''
  try {
    await api.bets.saveMatch(auth.token!, {
      matchId,
      homeScore: pred.home,
      awayScore: pred.away,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao salvar'
  } finally {
    saving.value = null
  }
}

function ensurePred(matchId: string) {
  if (!predictions.value[matchId]) {
    predictions.value[matchId] = { home: 0, away: 0 }
  }
}

const grouped = computed(() => {
  const map = new Map<string, Match[]>()
  for (const m of matches.value) {
    const key = stageLabels[m.stage] ?? m.stage
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return map
})
</script>

<template>
  <div class="page">
    <PoolNav />

    <h1 class="page-title">Mata-mata</h1>
    <p class="page-sub">Palpite até 10 minutos antes de cada partida · 5 pts resultado + 5 pts placar exato</p>

    <div v-if="loading" style="color:var(--text-muted)">Carregando...</div>

    <div v-else-if="matches.length === 0" class="card" style="text-align:center;color:var(--text-muted)">
      Nenhuma partida do mata-mata cadastrada ainda.
    </div>

    <template v-else>
      <section v-for="[stage, stageMatches] in grouped" :key="stage" style="margin-bottom:2rem">
        <h2 style="font-size:1rem;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.06em">
          {{ stage }}
        </h2>
        <div class="match-list">
          <article
            v-for="match in stageMatches"
            :key="match.id"
            class="match-card"
            :class="{ locked: isLocked(match) }"
          >
            <div>
              <div class="match-card__teams">
                <span class="match-card__team">{{ teamName(match, 'home') }}</span>
                <span class="match-card__vs">vs</span>
                <span class="match-card__team">{{ teamName(match, 'away') }}</span>
              </div>
              <div class="match-card__meta">
                {{ formatKickoff(match.kickoff_at) }}
                <span v-if="match.status === 'finished'" style="color:var(--gold)">
                  · {{ match.home_score }}–{{ match.away_score }}
                </span>
              </div>
              <div class="match-card__timer" v-if="!isLocked(match)">
                Travamento em {{ countdown(match) }}
              </div>
              <div class="match-card__timer" v-else style="color:var(--danger)">
                Palpites travados
              </div>
            </div>

            <div class="score-inputs">
              <input
                type="number"
                class="score-input"
                min="0"
                max="20"
                :disabled="isLocked(match)"
                :value="predictions[match.id]?.home ?? ''"
                @focus="ensurePred(match.id)"
                @input="(e) => { ensurePred(match.id); predictions[match.id].home = Number((e.target as HTMLInputElement).value) }"
              />
              <span style="color:var(--text-muted)">×</span>
              <input
                type="number"
                class="score-input"
                min="0"
                max="20"
                :disabled="isLocked(match)"
                :value="predictions[match.id]?.away ?? ''"
                @focus="ensurePred(match.id)"
                @input="(e) => { ensurePred(match.id); predictions[match.id].away = Number((e.target as HTMLInputElement).value) }"
              />
              <button
                class="btn btn-primary"
                style="padding:0.5rem 0.85rem;font-size:0.85rem"
                :disabled="isLocked(match) || saving === match.id"
                @click="savePrediction(match.id)"
              >
                {{ saving === match.id ? '...' : 'Salvar' }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </template>

    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>
