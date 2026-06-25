<script setup lang="ts">
import { computed } from 'vue'
import { toFlagEmoji } from '../lib/flags'
import {
  hasAnyGroupResults,
  isFirstCorrect,
  isSecondCorrect,
  isThirdAdvancing,
  type GroupResult,
} from '../lib/pickCorrectness'
import type { AnalysisPick } from '../lib/groupAnalysis'

const props = defineProps<{
  pick: AnalysisPick
  groupResults?: GroupResult[]
}>()

const results = computed(() => props.groupResults ?? [])
const showCorrectness = computed(() => hasAnyGroupResults(results.value))

function thirdForGroup(groupName: string) {
  const third = props.pick.bestThirds.find((t) => t.group === groupName)
  if (!third) return null
  return { team: third.team, flag: third.flag ?? '', teamId: third.teamId }
}
</script>

<template>
  <div>
    <p v-if="showCorrectness" class="correctness-legend">
      Contorno verde = palpite acertado
    </p>

    <div class="picks-grid">
      <div v-for="gb in pick.groupBets" :key="gb.group" class="picks-group-card">
        <div class="picks-group-name">Grupo {{ gb.group }}</div>
        <div
          class="picks-row"
          :class="{ 'picks-row--correct': showCorrectness && isFirstCorrect(gb.groupId, gb.firstId, results) }"
        >
          <span class="picks-pos">1º</span>
          <span class="picks-flag">{{ toFlagEmoji(gb.firstFlag ?? '') }}</span>
          <span class="picks-team">{{ gb.first }}</span>
        </div>
        <div
          class="picks-row"
          :class="{ 'picks-row--correct': showCorrectness && isSecondCorrect(gb.groupId, gb.secondId, results) }"
        >
          <span class="picks-pos">2º</span>
          <span class="picks-flag">{{ toFlagEmoji(gb.secondFlag ?? '') }}</span>
          <span class="picks-team">{{ gb.second }}</span>
        </div>
        <div
          class="picks-row picks-row--third"
          :class="{
            'picks-row--correct':
              showCorrectness &&
              thirdForGroup(gb.group) &&
              isThirdAdvancing(thirdForGroup(gb.group)!.teamId, results),
          }"
        >
          <span class="picks-pos">3º</span>
          <template v-if="thirdForGroup(gb.group)">
            <span class="picks-flag">{{ toFlagEmoji(thirdForGroup(gb.group)!.flag) }}</span>
            <span class="picks-team">{{ thirdForGroup(gb.group)!.team }}</span>
          </template>
          <span v-else class="picks-empty-pos">—</span>
        </div>
      </div>
    </div>

    <div class="picks-thirds-section">
      <p class="picks-thirds-title">8 melhores terceiros</p>
      <div class="picks-thirds-list">
        <span
          v-for="t in pick.bestThirds"
          :key="t.teamId"
          class="picks-third-chip"
          :class="{ 'picks-third-chip--correct': showCorrectness && isThirdAdvancing(t.teamId, results) }"
        >
          {{ toFlagEmoji(t.flag ?? '') }} {{ t.team }}
        </span>
        <span
          v-for="i in Math.max(0, 8 - pick.bestThirds.length)"
          :key="'empty-' + i"
          class="picks-third-chip picks-third-chip--empty"
        >—</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.correctness-legend {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 0.65rem;
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
  padding: 0.2rem 0.35rem;
  margin: 0 -0.35rem;
  font-size: 0.82rem;
  border-radius: 6px;
  border: 2px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.picks-row--correct {
  border-color: var(--accent, #c8f542);
  background: rgba(200, 245, 66, 0.1);
  box-shadow: 0 0 0 1px rgba(200, 245, 66, 0.15);
}

.picks-row--third {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.picks-row--third.picks-row--correct {
  color: var(--text);
}

.picks-pos {
  font-size: 0.7rem;
  font-weight: 700;
  width: 1.4rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.picks-row--correct .picks-pos {
  color: var(--accent);
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

.picks-empty-pos {
  color: var(--text-muted);
  font-size: 0.78rem;
}

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
  border: 2px solid var(--border, #2a2a2a);
  border-radius: 20px;
  padding: 0.2rem 0.65rem;
  font-size: 0.8rem;
  white-space: nowrap;
  transition: border-color 0.15s, background 0.15s;
}

.picks-third-chip--correct {
  border-color: var(--accent, #c8f542);
  background: rgba(200, 245, 66, 0.12);
  box-shadow: 0 0 0 1px rgba(200, 245, 66, 0.15);
}

.picks-third-chip--empty {
  color: var(--text-muted);
  border-style: dashed;
}
</style>
