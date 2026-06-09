<script setup lang="ts">
import type { Team, WcGroup } from '../types'

const props = defineProps<{
  group: WcGroup
  teams: Team[]
  firstId: string | null
  secondId: string | null
  thirdId: string | null
  locked: boolean
}>()

const emit = defineEmits<{
  update: [firstId: string | null, secondId: string | null, thirdId: string | null]
  randomize: []
}>()

function toFlagEmoji(code: string): string {
  if (code === 'gb-sct') return '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}'
  if (code === 'gb-eng') return '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'
  const base = code.split('-')[0].toUpperCase()
  return [...base].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')
}

function selectPosition(teamId: string, position: 1 | 2 | 3) {
  if (props.locked) return
  const wasSelected =
    (position === 1 && props.firstId === teamId) ||
    (position === 2 && props.secondId === teamId) ||
    (position === 3 && props.thirdId === teamId)

  let first = props.firstId
  let second = props.secondId
  let third = props.thirdId

  if (first === teamId) first = null
  if (second === teamId) second = null
  if (third === teamId) third = null

  if (wasSelected) {
    emit('update', first, second, third)
    return
  }

  if (position === 1) {
    first = teamId
  } else if (position === 2) {
    second = teamId
  } else {
    third = teamId
  }

  emit('update', first, second, third)
}

function getRowClass(teamId: string): string {
  if (props.firstId === teamId) return 'row-first'
  if (props.secondId === teamId) return 'row-second'
  if (props.thirdId === teamId) return 'row-third'
  return ''
}

function isSelected(teamId: string, position: 1 | 2 | 3): boolean {
  if (position === 1) return props.firstId === teamId
  if (position === 2) return props.secondId === teamId
  return props.thirdId === teamId
}

function posClass(position: 1 | 2 | 3): string {
  if (position === 1) return 'pos-first'
  if (position === 2) return 'pos-second'
  return 'pos-third'
}
</script>

<template>
  <article class="group-card">
    <header class="group-card__header">
      <h3>Grupo {{ group.name }}</h3>
    </header>

    <div class="group-card__cols">
      <span>Seleção</span>
      <span class="group-card__pos-label">Posição: <strong>1º</strong> <strong>2º</strong> <strong>3º</strong></span>
    </div>

    <div
      v-for="team in teams"
      :key="team.id"
      class="group-card__row"
      :class="getRowClass(team.id)"
    >
      <span class="group-card__team">
        <span class="flag-emoji">{{ toFlagEmoji(team.flag_code) }}</span>
        <span class="team-name">{{ team.name }}</span>
      </span>
      <div class="group-card__positions">
        <button
          v-for="pos in ([1, 2, 3] as const)"
          :key="pos"
          type="button"
          class="pos-btn"
          :class="[posClass(pos), { active: isSelected(team.id, pos) }]"
          :disabled="locked"
          @click="selectPosition(team.id, pos)"
          :aria-label="`${pos}º lugar`"
        />
      </div>
    </div>

    <footer class="group-card__footer" v-if="!locked">
      <button
        type="button"
        class="group-card__shuffle-btn"
        @click="emit('randomize')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 3 21 3 21 8"/>
          <line x1="4" y1="20" x2="21" y2="3"/>
          <polyline points="21 16 21 21 16 21"/>
          <line x1="15" y1="15" x2="21" y2="21"/>
          <line x1="4" y1="4" x2="9" y2="9"/>
        </svg>
        SORTEIO ALEATÓRIO
      </button>
    </footer>
  </article>
</template>
