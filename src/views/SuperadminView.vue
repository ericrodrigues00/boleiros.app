<script setup lang="ts">
import { ref, computed } from 'vue'
import { useApi } from '../composables/useApi'
import { isMatchLocked } from '../lib/scoring'
import type { Match, Team, WcGroup } from '../types'

const api = useApi()
const SUPERADMIN_KEY = 'boleiros_superadmin_token'

const token = ref(localStorage.getItem(SUPERADMIN_KEY))
const password = ref('')
const loginError = ref('')
const tab = ref<'matches' | 'groups' | 'settings'>('matches')

const matches = ref<Match[]>([])
const teams = ref<Team[]>([])
const groups = ref<WcGroup[]>([])
const groupResults = ref<Record<string, { first: string; second: string; third: string; advancing: boolean }>>({})
const topScorer = ref('')
const loading = ref(false)
const message = ref('')
const resultInputs = ref<Record<string, { home: number; away: number }>>({})

const newMatch = ref({
  homeTeamId: '',
  awayTeamId: '',
  homeLabel: '',
  awayLabel: '',
  stage: 'round_32',
  kickoffAt: '',
})

async function login() {
  loginError.value = ''
  try {
    const { token: t } = await api.superadmin.login(password.value)
    token.value = t
    localStorage.setItem(SUPERADMIN_KEY, t)
    await loadAll()
  } catch (e) {
    loginError.value = e instanceof Error ? e.message : 'Erro'
  }
}

function logout() {
  token.value = null
  localStorage.removeItem(SUPERADMIN_KEY)
}

async function loadAll() {
  if (!token.value) return
  loading.value = true
  try {
    const [m, t] = await Promise.all([
      api.superadmin.matches(token.value),
      api.superadmin.teams(token.value),
    ])
    matches.value = m.matches
    teams.value = t.teams
    groups.value = t.groups

    for (const g of groups.value) {
      if (!groupResults.value[g.id]) {
        groupResults.value[g.id] = { first: '', second: '', third: '', advancing: false }
      }
    }
  } finally {
    loading.value = false
  }
}

if (token.value) loadAll()

async function setResult(matchId: string, homeScore: number, awayScore: number) {
  if (!token.value) return
  message.value = ''
  try {
    await api.superadmin.matchResult(token.value, { matchId, homeScore, awayScore })
    message.value = 'Resultado salvo e pontos recalculados'
    await loadAll()
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Erro'
  }
}

async function confirmGroup(groupId: string) {
  if (!token.value) return
  const r = groupResults.value[groupId]
  if (!r.first || !r.second || !r.third) {
    message.value = 'Preencha as 3 posições'
    return
  }
  try {
    await api.superadmin.confirmGroup(token.value, {
      groupId,
      firstTeamId: r.first,
      secondTeamId: r.second,
      thirdTeamId: r.third,
      advancingAsThird: r.advancing,
    })
    message.value = `Grupo confirmado`
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Erro'
  }
}

async function createMatch() {
  if (!token.value) return
  try {
    await api.superadmin.createMatch(token.value, {
      homeTeamId: newMatch.value.homeTeamId || null,
      awayTeamId: newMatch.value.awayTeamId || null,
      homeLabel: newMatch.value.homeLabel || null,
      awayLabel: newMatch.value.awayLabel || null,
      stage: newMatch.value.stage,
      kickoffAt: new Date(newMatch.value.kickoffAt).toISOString(),
    })
    message.value = 'Partida criada'
    await loadAll()
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Erro'
  }
}

async function saveTopScorer() {
  if (!token.value || !topScorer.value.trim()) return
  try {
    await api.superadmin.setTopScorer(token.value, topScorer.value.trim())
    message.value = 'Artilheiro definido'
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Erro'
  }
}

async function recalculate() {
  if (!token.value) return
  try {
    await api.superadmin.recalculate(token.value)
    message.value = 'Pontuação recalculada'
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Erro'
  }
}

async function setLockMode(matchId: string, mode: 'auto' | 'locked' | 'unlocked') {
  if (!token.value) return
  message.value = ''
  try {
    const payload =
      mode === 'locked'
        ? { matchId, lockedOverride: true, unlockedOverride: false }
        : mode === 'unlocked'
          ? { matchId, lockedOverride: false, unlockedOverride: true }
          : { matchId, lockedOverride: false, unlockedOverride: false }
    await api.superadmin.updateMatch(token.value, payload)
    message.value =
      mode === 'locked' ? 'Palpites bloqueados' : mode === 'unlocked' ? 'Palpites desbloqueados' : 'Modo automático restaurado'
    await loadAll()
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Erro'
  }
}

async function deleteMatch(matchId: string) {
  if (!token.value) return
  if (!confirm('Excluir esta partida? Os palpites associados também serão removidos.')) return
  message.value = ''
  try {
    await api.superadmin.deleteMatch(token.value, matchId)
    message.value = 'Partida excluída'
    await loadAll()
  } catch (e) {
    message.value = e instanceof Error ? e.message : 'Erro'
  }
}

function lockStatusLabel(match: Match): string {
  if (match.unlocked_override) return 'Desbloqueado (manual)'
  if (match.locked_override) return 'Bloqueado (manual)'
  if (match.status === 'finished' || match.status === 'live') return 'Bloqueado (jogo)'
  return isMatchLocked(match) ? 'Bloqueado (automático)' : 'Aberto (automático)'
}

function teamsInGroup(groupId: string) {
  return teams.value.filter((t) => t.group_id === groupId)
}

const stageLabels: Record<string, string> = {
  group: 'Grupos',
  round_32: '16 avos',
  round_16: 'Oitavas',
  quarter: 'Quartas',
  semi: 'Semi',
  third_place: '3º lugar',
  final: 'Final',
}

const knockoutMatches = computed(() => matches.value.filter((m) => m.stage !== 'group'))
</script>

<template>
  <div class="page">
    <template v-if="!token">
      <h1 class="page-title">Superadmin</h1>
      <div class="auth-card card">
        <div class="field">
          <label class="label">Senha</label>
          <input v-model="password" class="input" type="password" @keyup.enter="login" />
        </div>
        <p v-if="loginError" class="error-msg">{{ loginError }}</p>
        <button class="btn btn-primary" style="width:100%" @click="login">Entrar</button>
      </div>
    </template>

    <template v-else>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
        <h1 class="page-title" style="margin:0">Superadmin</h1>
        <button class="btn btn-ghost" @click="logout">Sair</button>
      </div>

      <div class="tabs" style="margin-bottom:1.5rem">
        <button class="tab" :class="{ active: tab === 'matches' }" @click="tab = 'matches'">Partidas</button>
        <button class="tab" :class="{ active: tab === 'groups' }" @click="tab = 'groups'">Grupos</button>
        <button class="tab" :class="{ active: tab === 'settings' }" @click="tab = 'settings'">Config</button>
      </div>

      <p v-if="message" class="success-msg" style="margin-bottom:1rem">{{ message }}</p>

      <!-- Matches tab -->
      <template v-if="tab === 'matches'">
        <div class="card" style="margin-bottom:1.5rem">
          <h3 style="margin-bottom:1rem">Nova partida (mata-mata)</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
            <div class="field">
              <label class="label">Time casa (ID)</label>
              <select v-model="newMatch.homeTeamId" class="input">
                <option value="">— label manual —</option>
                <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Time fora (ID)</label>
              <select v-model="newMatch.awayTeamId" class="input">
                <option value="">— label manual —</option>
                <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Label casa (se TBD)</label>
              <input v-model="newMatch.homeLabel" class="input" />
            </div>
            <div class="field">
              <label class="label">Label fora (se TBD)</label>
              <input v-model="newMatch.awayLabel" class="input" />
            </div>
            <div class="field">
              <label class="label">Fase</label>
              <select v-model="newMatch.stage" class="input">
                <option value="round_32">16 avos</option>
                <option value="round_16">Oitavas</option>
                <option value="quarter">Quartas</option>
                <option value="semi">Semi</option>
                <option value="third_place">3º lugar</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Data/hora</label>
              <input v-model="newMatch.kickoffAt" class="input" type="datetime-local" />
            </div>
          </div>
          <button class="btn btn-primary" @click="createMatch">Criar partida</button>
        </div>

        <div class="match-list">
          <article v-for="match in knockoutMatches" :key="match.id" class="match-card">
            <div>
              <span class="badge" style="margin-bottom:0.5rem;display:inline-block">{{ stageLabels[match.stage] ?? match.stage }}</span>
              <div class="match-card__teams">
                <span>{{ match.home_team?.name ?? match.home_label ?? 'TBD' }}</span>
                <span class="match-card__vs">vs</span>
                <span>{{ match.away_team?.name ?? match.away_label ?? 'TBD' }}</span>
              </div>
              <div class="match-card__meta">{{ new Date(match.kickoff_at).toLocaleString('pt-BR') }}</div>
              <div class="match-card__meta" style="margin-top:0.25rem">
                Palpites: {{ lockStatusLabel(match) }}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.5rem;align-items:flex-end">
              <div class="score-inputs" v-if="match.status !== 'finished'">
                <input
                  type="number"
                  class="score-input"
                  min="0"
                  placeholder="0"
                  :value="resultInputs[match.id]?.home ?? ''"
                  @input="(e) => {
                    if (!resultInputs[match.id]) resultInputs[match.id] = { home: 0, away: 0 }
                    resultInputs[match.id].home = Number((e.target as HTMLInputElement).value)
                  }"
                />
                <span>×</span>
                <input
                  type="number"
                  class="score-input"
                  min="0"
                  placeholder="0"
                  :value="resultInputs[match.id]?.away ?? ''"
                  @input="(e) => {
                    if (!resultInputs[match.id]) resultInputs[match.id] = { home: 0, away: 0 }
                    resultInputs[match.id].away = Number((e.target as HTMLInputElement).value)
                  }"
                />
                <button
                  class="btn btn-primary"
                  style="padding:0.5rem 0.85rem;font-size:0.85rem"
                  @click="setResult(match.id, resultInputs[match.id]?.home ?? 0, resultInputs[match.id]?.away ?? 0)"
                >
                  Resultado
                </button>
              </div>
              <div v-else style="font-family:var(--font-display);font-weight:700;color:var(--gold)">
                {{ match.home_score }} – {{ match.away_score }}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:0.35rem;justify-content:flex-end">
                <button
                  class="btn btn-ghost"
                  style="padding:0.3rem 0.6rem;font-size:0.75rem"
                  :disabled="match.locked_override && !match.unlocked_override"
                  @click="setLockMode(match.id, 'locked')"
                >
                  Bloquear
                </button>
                <button
                  class="btn btn-ghost"
                  style="padding:0.3rem 0.6rem;font-size:0.75rem"
                  :disabled="match.unlocked_override"
                  @click="setLockMode(match.id, 'unlocked')"
                >
                  Desbloquear
                </button>
                <button
                  class="btn btn-ghost"
                  style="padding:0.3rem 0.6rem;font-size:0.75rem"
                  :disabled="!match.locked_override && !match.unlocked_override"
                  @click="setLockMode(match.id, 'auto')"
                >
                  Automático
                </button>
                <button
                  class="btn btn-ghost"
                  style="padding:0.3rem 0.6rem;font-size:0.75rem;color:var(--error,#f87171)"
                  @click="deleteMatch(match.id)"
                >
                  Excluir
                </button>
              </div>
            </div>
          </article>
        </div>
      </template>

      <!-- Groups tab -->
      <template v-if="tab === 'groups'">
        <div class="groups-grid">
          <div v-for="group in groups" :key="group.id" class="card">
            <h3 style="margin-bottom:0.75rem">Grupo {{ group.name }}</h3>
            <div class="field">
              <label class="label">1º lugar</label>
              <select v-model="groupResults[group.id].first" class="input">
                <option value="">—</option>
                <option v-for="t in teamsInGroup(group.id)" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="label">2º lugar</label>
              <select v-model="groupResults[group.id].second" class="input">
                <option value="">—</option>
                <option v-for="t in teamsInGroup(group.id)" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="label">3º lugar</label>
              <select v-model="groupResults[group.id].third" class="input">
                <option value="">—</option>
                <option v-for="t in teamsInGroup(group.id)" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;margin-bottom:0.75rem;cursor:pointer">
              <input type="checkbox" v-model="groupResults[group.id].advancing" />
              3º avança (entre os 8 melhores)
            </label>
            <button class="btn btn-primary" style="width:100%" @click="confirmGroup(group.id)">Confirmar</button>
          </div>
        </div>
      </template>

      <!-- Settings tab -->
      <template v-if="tab === 'settings'">
        <div class="card" style="max-width:400px">
          <div class="field">
            <label class="label">Artilheiro da Copa</label>
            <input v-model="topScorer" class="input" placeholder="Nome do jogador" />
          </div>
          <button class="btn btn-primary" @click="saveTopScorer">Definir artilheiro</button>
          <hr style="border:none;border-top:1px solid var(--border);margin:1.5rem 0" />
          <button class="btn btn-ghost" @click="recalculate">Recalcular todos os pontos</button>
        </div>
      </template>
    </template>
  </div>
</template>
