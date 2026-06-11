<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuthStore } from '../stores/auth'
import PoolNav from '../components/PoolNav.vue'
import AdminAnalysisPanel from '../components/AdminAnalysisPanel.vue'
import BolaoShareCard from '../components/BolaoShareCard.vue'
import { toFlagEmoji } from '../lib/flags'
import type { AnalysisGroup, AnalysisPick, AnalysisTeam } from '../lib/groupAnalysis'
import type { Member } from '../types'

const route = useRoute()
const auth = useAuthStore()
const api = useApi()

// ── members ──────────────────────────────────────────────────────────────────
const members = ref<Member[]>([])
const loading = ref(true)
const error = ref('')

const adminTab = ref<'members' | 'analysis' | 'share'>('members')
const poolName = ref('')

const picks = ref<AnalysisPick[]>([])
const groups = ref<AnalysisGroup[]>([])
const teams = ref<AnalysisTeam[]>([])
const picksLoading = ref(false)
const picksError = ref('')
const expandedMemberId = ref<string | null>(null)

const inviteUrl = `${window.location.origin}/b/${route.params.token}`

onMounted(async () => {
  try {
    const [membersData, poolData] = await Promise.all([
      api.admin.members(auth.token!),
      api.pools.detail(auth.token!).catch(() => null),
    ])
    members.value = membersData.members
    poolName.value = poolData?.pool?.name ?? auth.member?.username ?? 'Bolão'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar'
  } finally {
    loading.value = false
  }
  loadPicks()
})

async function loadPicks() {
  picksLoading.value = true
  picksError.value = ''
  try {
    const data = await api.admin.memberPicks(auth.token!)
    picks.value = data.picks ?? []
    groups.value = data.groups ?? []
    teams.value = data.teams ?? []
  } catch (e) {
    picksError.value = e instanceof Error ? e.message : 'Erro ao carregar palpites'
  } finally {
    picksLoading.value = false
  }
}

function toggleMember(id: string) {
  expandedMemberId.value = expandedMemberId.value === id ? null : id
}

function picksFor(memberId: string): AnalysisPick | undefined {
  return picks.value.find((p) => p.memberId === memberId)
}

function thirdForGroup(pick: AnalysisPick, groupName: string) {
  const third = pick.bestThirds.find((t) => t.group === groupName)
  if (!third) return null
  return { team: third.team, flag: third.flag ?? '' }
}

async function removeMember(memberId: string) {
  if (!confirm('Remover este membro?')) return
  try {
    await api.admin.removeMember(auth.token!, memberId)
    members.value = members.value.filter((m) => m.id !== memberId)
    picks.value = picks.value.filter((p) => p.memberId !== memberId)
    if (expandedMemberId.value === memberId) expandedMemberId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao remover'
  }
}

function copyLink() {
  navigator.clipboard.writeText(inviteUrl)
}

function statusBadge(memberId: string): { label: string; cls: string } {
  const p = picksFor(memberId)
  if (!p) return { label: '—', cls: 'badge-locked' }
  if (p.groupBets.length === 12 && p.bestThirds.length === 8) return { label: '✓ Completo', cls: 'badge-open' }
  if (p.groupBets.length > 0 || p.bestThirds.length > 0)
    return { label: `${p.groupBets.length}/12 grupos`, cls: 'badge-partial' }
  return { label: 'Sem apostas', cls: 'badge-locked' }
}
</script>

<template>
  <div class="page">
    <PoolNav />

    <div class="admin-header">
      <div>
        <h1 class="page-title">Admin do bolão</h1>
        <p class="page-sub">Gerencie membros, compartilhe o convite e analise os palpites</p>
      </div>
      <div class="admin-tabs">
        <button class="admin-tab" :class="{ active: adminTab === 'members' }" @click="adminTab = 'members'">
          Membros
        </button>
        <button class="admin-tab admin-tab--analysis" :class="{ active: adminTab === 'analysis' }" @click="adminTab = 'analysis'">
          Análise de palpites
        </button>
        <button class="admin-tab admin-tab--share" :class="{ active: adminTab === 'share' }" @click="adminTab = 'share'">
          Compartilhar
        </button>
      </div>
    </div>

    <!-- invite link -->
    <div v-if="adminTab === 'members'" class="card" style="margin-bottom:1.5rem">
      <p style="margin-bottom:0.75rem;color:var(--text-muted);font-size:0.9rem">Link de convite</p>
      <div class="invite-box" style="margin:0">{{ inviteUrl }}</div>
      <button class="btn btn-ghost" style="margin-top:0.75rem" @click="copyLink">Copiar link</button>
    </div>

    <AdminAnalysisPanel
      v-if="adminTab === 'analysis'"
      :picks="picks"
      :groups="groups"
      :teams="teams"
      :loading="picksLoading || loading"
    />

    <BolaoShareCard
      v-else-if="adminTab === 'share'"
      :pool-name="poolName"
      :members="members"
      :picks="picks"
      :groups="groups"
      :teams="teams"
      :loading="picksLoading || loading"
    />

    <!-- members + picks -->
    <div v-else-if="loading" style="color:var(--text-muted)">Carregando...</div>

    <template v-else-if="adminTab === 'members'">
      <div class="admin-members">
        <div
          v-for="m in members"
          :key="m.id"
          class="member-block"
          :class="{ expanded: expandedMemberId === m.id }"
        >
          <!-- member header row -->
          <div class="member-row" @click="toggleMember(m.id)">
            <div class="member-info">
              <span class="member-username">{{ m.username }}</span>
              <span style="color:var(--text-muted);font-size:0.82rem">⚽ {{ m.top_scorer_pick }}</span>
              <span class="badge" :class="statusBadge(m.id).cls" style="font-size:0.72rem;padding:0.15rem 0.5rem">
                {{ picksLoading ? '…' : statusBadge(m.id).label }}
              </span>
            </div>
            <div class="member-actions" @click.stop>
              <button
                class="btn btn-ghost"
                style="padding:0.3rem 0.7rem;font-size:0.8rem"
                @click="toggleMember(m.id)"
              >
                {{ expandedMemberId === m.id ? 'Fechar' : 'Ver palpites' }}
              </button>
              <button
                v-if="m.id !== auth.member?.id"
                class="btn btn-ghost"
                style="padding:0.3rem 0.7rem;font-size:0.8rem;color:var(--error,#f87171)"
                @click="removeMember(m.id)"
              >
                Remover
              </button>
            </div>
          </div>

          <!-- expanded picks -->
          <Transition name="slide">
            <div v-if="expandedMemberId === m.id" class="picks-panel">
              <div v-if="picksLoading" style="color:var(--text-muted);padding:1rem">Carregando palpites...</div>
              <template v-else>
                <div v-if="!picksFor(m.id) || picksFor(m.id)!.groupBets.length === 0" class="picks-empty">
                  Nenhuma aposta salva ainda.
                </div>
                <template v-else>
                  <div class="picks-grid">
                    <div
                      v-for="gb in picksFor(m.id)!.groupBets"
                      :key="gb.group"
                      class="picks-group-card"
                    >
                      <div class="picks-group-name">Grupo {{ gb.group }}</div>
                      <div class="picks-row">
                        <span class="picks-pos">1º</span>
                        <span class="picks-flag">{{ toFlagEmoji(gb.firstFlag ?? '') }}</span>
                        <span class="picks-team">{{ gb.first }}</span>
                      </div>
                      <div class="picks-row">
                        <span class="picks-pos">2º</span>
                        <span class="picks-flag">{{ toFlagEmoji(gb.secondFlag ?? '') }}</span>
                        <span class="picks-team">{{ gb.second }}</span>
                      </div>
                      <div class="picks-row picks-row--third">
                        <span class="picks-pos">3º</span>
                        <template v-if="thirdForGroup(picksFor(m.id)!, gb.group)">
                          <span class="picks-flag">{{ toFlagEmoji(thirdForGroup(picksFor(m.id)!, gb.group)!.flag) }}</span>
                          <span class="picks-team">{{ thirdForGroup(picksFor(m.id)!, gb.group)!.team }}</span>
                        </template>
                        <span v-else style="color:var(--text-muted);font-size:0.78rem">—</span>
                      </div>
                    </div>
                  </div>

                  <div class="picks-thirds-section">
                    <p class="picks-thirds-title">8 melhores terceiros</p>
                    <div class="picks-thirds-list">
                      <span
                        v-for="t in picksFor(m.id)!.bestThirds"
                        :key="t.team"
                        class="picks-third-chip"
                      >
                        {{ toFlagEmoji(t.flag ?? '') }} {{ t.team }}
                      </span>
                      <span
                        v-for="i in Math.max(0, 8 - picksFor(m.id)!.bestThirds.length)"
                        :key="'empty-' + i"
                        class="picks-third-chip picks-third-chip--empty"
                      >—</span>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </Transition>
        </div>
      </div>

      <p v-if="error" class="error-msg">{{ error }}</p>
      <p v-if="picksError" class="error-msg">{{ picksError }}</p>
    </template>
  </div>
</template>

<style scoped>
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.admin-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.admin-tab {
  padding: 0.6rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.admin-tab.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(200, 245, 66, 0.08);
}

.admin-tab--analysis.active {
  background: linear-gradient(135deg, rgba(200, 245, 66, 0.2), rgba(232, 196, 104, 0.12));
  color: var(--text);
  border-color: var(--gold);
}

.admin-tab--share.active {
  background: linear-gradient(135deg, rgba(232, 196, 104, 0.25), rgba(200, 245, 66, 0.12));
  color: var(--gold);
  border-color: var(--gold);
}

/* ── member blocks ──────────────────────────────────────────────────────────── */
.admin-members {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.member-block {
  background: var(--card-bg, #1a1a1a);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.member-block.expanded {
  border-color: var(--accent, #a3e635);
}

.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  user-select: none;
}

.member-row:hover {
  background: rgba(255,255,255,0.03);
}

.member-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.member-username {
  font-weight: 600;
  font-size: 0.95rem;
}

.member-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

/* ── picks panel ──────────────────────────────────────────────────────────── */
.picks-panel {
  border-top: 1px solid var(--border, #2a2a2a);
  padding: 1rem;
  background: rgba(0,0,0,0.2);
}

.picks-empty {
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.picks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.picks-group-card {
  background: var(--card-bg, #1a1a1a);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
}

.picks-group-name {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent, #a3e635);
  margin-bottom: 0.4rem;
}

.picks-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0;
  font-size: 0.82rem;
}

.picks-row--third {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.picks-pos {
  font-size: 0.7rem;
  font-weight: 700;
  width: 1.4rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.picks-flag {
  font-size: 1rem;
  flex-shrink: 0;
}

.picks-team {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── thirds ──────────────────────────────────────────────────────────────── */
.picks-thirds-section {
  border-top: 1px solid var(--border, #2a2a2a);
  padding-top: 0.75rem;
}

.picks-thirds-title {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.picks-thirds-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.picks-third-chip {
  background: var(--card-bg, #1a1a1a);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 20px;
  padding: 0.2rem 0.65rem;
  font-size: 0.8rem;
  white-space: nowrap;
}

.picks-third-chip--empty {
  color: var(--text-muted);
  border-style: dashed;
}

/* partial badge */
.badge-partial {
  background: rgba(251,191,36,0.15);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.3);
}

/* ── slide transition ──────────────────────────────────────────────────────── */
.slide-enter-active,
.slide-leave-active {
  transition: max-height 0.3s ease, opacity 0.2s ease;
  overflow: hidden;
  max-height: 800px;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
