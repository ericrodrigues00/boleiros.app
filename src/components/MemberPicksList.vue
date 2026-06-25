<script setup lang="ts">
import { computed, ref } from 'vue'
import MemberPickGrid from './MemberPickGrid.vue'
import { hasAnyGroupResults, type GroupResult } from '../lib/pickCorrectness'
import type { AnalysisPick } from '../lib/groupAnalysis'

type MemberRow = {
  id: string
  username: string
  top_scorer_pick: string
}

const props = defineProps<{
  members: MemberRow[]
  picks: AnalysisPick[]
  groupResults?: GroupResult[]
  loading: boolean
  highlightMemberId?: string | null
}>()

const expandedMemberId = ref<string | null>(null)
const showCorrectness = computed(() => hasAnyGroupResults(props.groupResults ?? []))

function toggleMember(id: string) {
  expandedMemberId.value = expandedMemberId.value === id ? null : id
}

function picksFor(memberId: string): AnalysisPick | undefined {
  return props.picks.find((p) => p.memberId === memberId)
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
  <div v-if="loading" style="color:var(--text-muted)">Carregando palpites...</div>

  <div v-else class="member-picks">
    <p v-if="showCorrectness" class="correctness-legend">
      Palpites com contorno verde foram acertados na fase de grupos.
    </p>

    <div
      v-for="m in members"
      :key="m.id"
      class="member-block"
      :class="{ expanded: expandedMemberId === m.id, me: m.id === highlightMemberId }"
    >
      <div class="member-row" @click="toggleMember(m.id)">
        <div class="member-info">
          <span class="member-username">
            {{ m.username }}
            <span v-if="m.id === highlightMemberId" class="member-you">você</span>
          </span>
          <span style="color:var(--text-muted);font-size:0.82rem">⚽ {{ m.top_scorer_pick }}</span>
          <span class="badge" :class="statusBadge(m.id).cls" style="font-size:0.72rem;padding:0.15rem 0.5rem">
            {{ statusBadge(m.id).label }}
          </span>
        </div>
        <button
          class="btn btn-ghost"
          style="padding:0.3rem 0.7rem;font-size:0.8rem"
          @click.stop="toggleMember(m.id)"
        >
          {{ expandedMemberId === m.id ? 'Fechar' : 'Ver palpites' }}
        </button>
      </div>

      <Transition name="slide">
        <div v-if="expandedMemberId === m.id" class="picks-panel">
          <div v-if="!picksFor(m.id) || picksFor(m.id)!.groupBets.length === 0" class="picks-empty">
            Nenhuma aposta salva ainda.
          </div>
          <MemberPickGrid
            v-else
            :pick="picksFor(m.id)!"
            :group-results="groupResults"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.member-picks {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.correctness-legend {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
  padding: 0.5rem 0.75rem;
  border-left: 2px solid var(--accent);
  background: rgba(200, 245, 66, 0.05);
  border-radius: 0 8px 8px 0;
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

.member-block.me {
  border-color: rgba(200, 245, 66, 0.35);
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

.member-you {
  font-size: 0.72rem;
  color: var(--accent);
  margin-left: 0.35rem;
  font-weight: 500;
}

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

.badge-partial {
  background: rgba(251,191,36,0.15);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.3);
}

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
