<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'
import PoolNav from '../components/PoolNav.vue'
import GroupCard from '../components/GroupCard.vue'
import type { Team, WcGroup } from '../types'

const auth = useAuthStore()
const api = useApi()

const groups = ref<WcGroup[]>([])
const teams = ref<Team[]>([])
const locked = ref(false)
const deadline = ref<string | null>(null)
const picks = ref<Record<string, { first: string | null; second: string | null; third: string | null }>>({})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await api.bets.groupStage(auth.token!)
    groups.value = data.groups
    teams.value = data.teams
    locked.value = data.locked
    deadline.value = data.deadline

    const initial: Record<string, { first: string | null; second: string | null; third: string | null }> = {}
    for (const g of data.groups) {
      initial[g.id] = { first: null, second: null, third: null }
    }
    const savedThirds = new Set((data.bestThirdBets ?? []).map((b: { team_id: string }) => b.team_id))

    for (const bet of data.groupBets) {
      initial[bet.group_id] = {
        first: bet.predicted_first,
        second: bet.predicted_second,
        third: initial[bet.group_id]?.third ?? null,
      }
    }

    for (const team of data.teams as Team[]) {
      if (savedThirds.has(team.id) && initial[team.group_id]) {
        initial[team.group_id].third = team.id
      }
    }

    picks.value = initial
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar'
  } finally {
    loading.value = false
  }
}

function teamsForGroup(groupId: string) {
  return teams.value.filter((t) => t.group_id === groupId)
}

function updateGroup(groupId: string, first: string | null, second: string | null, third: string | null) {
  const currentThird = picks.value[groupId]?.third ?? null
  const selectedThirdsOutsideGroup = selectedThirdIds.value.filter((teamId) => teamId !== currentThird)

  if (third && third !== currentThird && selectedThirdsOutsideGroup.length >= 8) {
    showToast('Você só pode escolher 8 terceiros colocados.')
    return
  }

  picks.value[groupId] = { first, second, third }
}

function randomizeGroup(groupId: string) {
  const groupTeams = [...teamsForGroup(groupId)]
  for (let i = groupTeams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [groupTeams[i], groupTeams[j]] = [groupTeams[j], groupTeams[i]]
  }
  const currentThird = picks.value[groupId]?.third ?? null
  const selectedThirdsOutsideGroup = selectedThirdIds.value.filter((teamId) => teamId !== currentThird)
  const nextThird = selectedThirdsOutsideGroup.length >= 8 ? currentThird : groupTeams[2].id

  if (!currentThird && selectedThirdsOutsideGroup.length >= 8) {
    showToast('Você só pode escolher 8 terceiros colocados.')
  }

  picks.value[groupId] = {
    first: groupTeams[0].id,
    second: groupTeams[1].id,
    third: nextThird,
  }
}

const allGroupsComplete = computed(() =>
  groups.value.every((g) => picks.value[g.id]?.first && picks.value[g.id]?.second),
)

const selectedThirdIds = computed(() =>
  Object.values(picks.value)
    .map((pick) => pick.third)
    .filter((id): id is string => !!id),
)

const thirdsComplete = computed(() => selectedThirdIds.value.length === 8)

function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 3200)
}

async function save() {
  if (!allGroupsComplete.value) {
    showToast('Complete todos os grupos com 1º e 2º colocados.')
    return
  }
  if (!thirdsComplete.value) {
    showToast('Escolha exatamente 8 terceiros colocados para avançar.')
    return
  }

  error.value = ''
  success.value = ''
  saving.value = true
  try {
    await api.bets.saveGroupStage(auth.token!, {
      groupBets: groups.value.map((g) => ({
        groupId: g.id,
        predictedFirst: picks.value[g.id].first,
        predictedSecond: picks.value[g.id].second,
      })),
      bestThirdTeamIds: selectedThirdIds.value,
    })
    success.value = 'Apostas salvas!'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

const deadlineLabel = computed(() => {
  if (!deadline.value) return null
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(deadline.value))
})
</script>

<template>
  <div class="page">
    <PoolNav />

    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.5rem">
      <div>
        <h1 class="page-title" style="margin-bottom:0">Grupos</h1>
        <p class="page-sub" style="margin-bottom:0">
          Aposte no 1º e 2º de cada grupo + os 8 melhores terceiros
        </p>
      </div>
      <span class="badge" :class="locked ? 'badge-locked' : 'badge-open'">
        {{ locked ? 'Travado' : 'Aberto' }}
      </span>
    </div>

    <p v-if="deadlineLabel && !locked" style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem">
      Prazo: {{ deadlineLabel }}
    </p>

    <div v-if="loading" style="color:var(--text-muted)">Carregando...</div>

    <template v-else>
      <div v-if="groups.length === 0" class="card empty-groups">
        <h2 style="font-size:1.1rem;margin-bottom:0.5rem">Nenhum grupo cadastrado</h2>
        <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem">
          Os dados da Copa ainda não foram inseridos no banco. Rode o seed no Supabase:
        </p>
        <code style="display:block;padding:0.75rem 1rem;background:var(--bg);border-radius:8px;font-size:0.85rem;color:var(--accent)">
          supabase db push
        </code>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-top:0.75rem">
          Ou execute o SQL de <code>supabase/migrations/002_seed_groups_teams.sql</code> no SQL Editor.
        </p>
      </div>

      <div v-else class="groups-grid">
        <GroupCard
          v-for="group in groups"
          :key="group.id"
          :group="group"
          :teams="teamsForGroup(group.id)"
          :first-id="picks[group.id]?.first ?? null"
          :second-id="picks[group.id]?.second ?? null"
          :third-id="picks[group.id]?.third ?? null"
          :locked="locked"
          @update="(f, s, t) => updateGroup(group.id, f, s, t)"
          @randomize="randomizeGroup(group.id)"
        />
      </div>

      <p v-if="groups.length > 0" class="third-count" :class="{ complete: thirdsComplete }">
        Terceiros escolhidos: {{ selectedThirdIds.length }}/8
      </p>

      <p v-if="error" class="error-msg">{{ error }}</p>
      <p v-if="success" class="success-msg">{{ success }}</p>

      <div class="sticky-save" v-if="!locked && groups.length > 0">
        <button class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Salvando...' : 'Salvar apostas' }}
        </button>
      </div>
    </template>

    <Transition name="toast">
      <div v-if="toast" class="toast">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>
