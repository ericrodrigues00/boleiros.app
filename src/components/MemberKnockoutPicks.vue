<script setup lang="ts">
import { computed } from 'vue'
import { calculateMatchPoints } from '../lib/scoring'
import type { AnalysisPick } from '../lib/groupAnalysis'

export type KnockoutMatchInfo = {
  id: string
  stage: string
  stageLabel: string
  stageOrder: number
  kickoffAt: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  status: string
}

const props = defineProps<{
  pick: AnalysisPick
  matches: KnockoutMatchInfo[]
}>()

const predMap = computed(() => new Map(props.pick.matchPredictions?.map((p) => [p.matchId, p]) ?? []))

const grouped = computed(() => {
  const map = new Map<string, KnockoutMatchInfo[]>()
  for (const m of props.matches) {
    if (!map.has(m.stageLabel)) map.set(m.stageLabel, [])
    map.get(m.stageLabel)!.push(m)
  }
  return map
})

function predictionFor(matchId: string) {
  return predMap.value.get(matchId)
}

function isExact(match: KnockoutMatchInfo, pred: { homeScore: number; awayScore: number }) {
  return match.homeScore != null && match.awayScore != null &&
    pred.homeScore === match.homeScore && pred.awayScore === match.awayScore
}

function isResultCorrect(match: KnockoutMatchInfo, pred: { homeScore: number; awayScore: number }) {
  if (match.homeScore == null || match.awayScore == null) return false
  return calculateMatchPoints(pred.homeScore, pred.awayScore, match.homeScore, match.awayScore) >= 5
}
</script>

<template>
  <div v-if="matches.length === 0" class="knockout-empty">
    Nenhuma partida do mata-mata cadastrada.
  </div>

  <div v-else class="knockout-picks">
    <section v-for="[stage, stageMatches] in grouped" :key="stage" class="knockout-stage">
      <h4 class="knockout-stage-title">{{ stage }}</h4>
      <div class="knockout-match-list">
        <div
          v-for="match in stageMatches"
          :key="match.id"
          class="knockout-match"
          :class="{
            'knockout-match--exact': predictionFor(match.id) && isExact(match, predictionFor(match.id)!),
            'knockout-match--result': predictionFor(match.id) && !isExact(match, predictionFor(match.id)!) && isResultCorrect(match, predictionFor(match.id)!),
          }"
        >
          <div class="knockout-match-teams">
            <span>{{ match.home }}</span>
            <span class="knockout-vs">vs</span>
            <span>{{ match.away }}</span>
          </div>
          <div v-if="predictionFor(match.id)" class="knockout-pred">
            {{ predictionFor(match.id)!.homeScore }} × {{ predictionFor(match.id)!.awayScore }}
          </div>
          <div v-else class="knockout-pred knockout-pred--empty">—</div>
          <div v-if="match.status === 'finished' && match.homeScore != null" class="knockout-result">
            Real: {{ match.homeScore }}–{{ match.awayScore }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.knockout-empty {
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.knockout-picks {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.knockout-stage-title {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.knockout-match-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.knockout-match {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.65rem;
  background: var(--card-bg, #1a1a1a);
  border: 2px solid var(--border, #2a2a2a);
  border-radius: 8px;
  font-size: 0.82rem;
}

.knockout-match--exact {
  border-color: var(--accent, #c8f542);
  background: rgba(200, 245, 66, 0.12);
}

.knockout-match--result {
  border-color: rgba(200, 245, 66, 0.45);
  background: rgba(200, 245, 66, 0.06);
}

.knockout-match-teams {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.knockout-match-teams span:first-child,
.knockout-match-teams span:last-child {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.knockout-vs {
  color: var(--text-muted);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.knockout-pred {
  font-family: var(--font-display, monospace);
  font-weight: 700;
  color: var(--gold, #fbbf24);
  white-space: nowrap;
}

.knockout-pred--empty {
  color: var(--text-muted);
  font-weight: 400;
}

.knockout-result {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
}

@media (max-width: 600px) {
  .knockout-match {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
</style>
