<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AnalysisPick } from '../lib/groupAnalysis'
import type { KnockoutMatchInfo } from './MemberKnockoutPicks.vue'
import {
  buildKnockoutDailyReport,
  buildWhatsAppSummary,
  formatBrDayLabel,
  listMatchDays,
  shiftDayKey,
  todayBrDayKey,
} from '../lib/knockoutDailyAnalysis'

const props = defineProps<{
  poolName: string
  picks: AnalysisPick[]
  matches: KnockoutMatchInfo[]
  loading: boolean
}>()

const selectedDay = ref(todayBrDayKey())
const copied = ref(false)
const activeSlide = ref(0)

const availableDays = computed(() => {
  const fromMatches = listMatchDays(props.matches)
  const today = todayBrDayKey()
  const set = new Set([...fromMatches, today])
  return [...set].sort()
})

const report = computed(() =>
  buildKnockoutDailyReport(props.picks, props.matches, selectedDay.value),
)

const slides = computed(() => {
  const items: { id: string; label: string }[] = [{ id: 'intro', label: 'Intro' }]
  if (report.value.yesterdayMatches.length > 0) items.push({ id: 'yesterday', label: 'Ontem' })
  if (report.value.memberStats.some((m) => m.yesterdayPoints > 0)) items.push({ id: 'ranking', label: 'Ranking' })
  if (report.value.todayMatches.length > 0) items.push({ id: 'today', label: 'Hoje' })
  items.push({ id: 'stats', label: 'Stats' })
  return items
})

watch(availableDays, (days) => {
  if (days.length > 0 && !days.includes(selectedDay.value)) {
    selectedDay.value = days.includes(todayBrDayKey()) ? todayBrDayKey() : days[days.length - 1]
  }
})

function shiftDay(delta: number) {
  selectedDay.value = shiftDayKey(selectedDay.value, delta)
}

function pickEmoji(status: string) {
  if (status === 'exact') return '✨'
  if (status === 'result') return '🎯'
  if (status === 'miss') return '💨'
  if (status === 'pending') return '⏳'
  return '—'
}

async function copySummary() {
  const text = buildWhatsAppSummary(report.value, props.poolName)
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

function scrollToSlide(i: number) {
  activeSlide.value = i
  const el = document.getElementById(`rewind-slide-${slides.value[i]?.id}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="rewind">
    <div v-if="loading" class="rewind-loading">Carregando replay do dia...</div>

    <div v-else-if="matches.length === 0" class="card rewind-empty">
      <h2>Sem jogos do mata-mata</h2>
      <p>Cadastre partidas no superadmin para gerar o replay diário.</p>
    </div>

    <template v-else>
      <div class="rewind-toolbar">
        <div class="rewind-date-nav">
          <button class="rewind-nav-btn" @click="shiftDay(-1)">←</button>
          <div class="rewind-date">
            <span class="rewind-date__label">{{ formatBrDayLabel(selectedDay) }}</span>
            <select v-model="selectedDay" class="rewind-date__select">
              <option v-for="d in availableDays" :key="d" :value="d">{{ formatBrDayLabel(d) }}</option>
            </select>
          </div>
          <button class="rewind-nav-btn" @click="shiftDay(1)">→</button>
        </div>
        <button class="btn btn-primary rewind-copy" @click="copySummary">
          {{ copied ? 'Copiado!' : 'Copiar p/ WhatsApp' }}
        </button>
      </div>

      <div class="rewind-dots">
        <button
          v-for="(slide, i) in slides"
          :key="slide.id"
          class="rewind-dot"
          :class="{ active: activeSlide === i }"
          @click="scrollToSlide(i)"
        />
      </div>

      <div class="rewind-track" @scroll.passive="() => {}">
        <!-- INTRO -->
        <section id="rewind-slide-intro" class="rewind-slide rewind-slide--intro">
          <div class="rewind-slide__glow" />
          <p class="rewind-kicker">Seu bolão em números</p>
          <h2 class="rewind-title">{{ poolName }}</h2>
          <p class="rewind-subtitle">Replay do mata-mata</p>
          <p class="rewind-day">{{ report.dayLabel }}</p>
          <div class="rewind-intro-stats">
            <div class="rewind-stat-bubble">
              <strong>{{ report.todayMatches.length }}</strong>
              <span>jogos hoje</span>
            </div>
            <div class="rewind-stat-bubble rewind-stat-bubble--gold">
              <strong>{{ report.totalExactScores }}</strong>
              <span>exatos ontem</span>
            </div>
            <div class="rewind-stat-bubble rewind-stat-bubble--pink">
              <strong>{{ report.totalYesterdayPoints }}</strong>
              <span>pts ontem</span>
            </div>
          </div>
          <ul v-if="report.highlights.length" class="rewind-highlights">
            <li v-for="(h, i) in report.highlights.slice(0, 3)" :key="i">{{ h }}</li>
          </ul>
        </section>

        <!-- YESTERDAY -->
        <section
          v-if="report.yesterdayMatches.length > 0"
          id="rewind-slide-yesterday"
          class="rewind-slide rewind-slide--yesterday"
        >
          <div class="rewind-slide__glow rewind-slide__glow--purple" />
          <p class="rewind-kicker">Ontem no bolão</p>
          <h2 class="rewind-title">Como foi?</h2>
          <p v-if="report.yesterdayLabel" class="rewind-subtitle">{{ report.yesterdayLabel }}</p>

          <article v-for="match in report.yesterdayMatches" :key="match.matchId" class="rewind-match">
            <header class="rewind-match__head">
              <span class="rewind-match__stage">{{ match.stageLabel }}</span>
              <span class="rewind-match__time">{{ match.kickoffTime }}</span>
            </header>
            <div class="rewind-match__teams">
              <span>{{ match.home }}</span>
              <span class="rewind-match__score">
                <template v-if="match.finished">{{ match.homeScore }} × {{ match.awayScore }}</template>
                <template v-else>vs</template>
              </span>
              <span>{{ match.away }}</span>
            </div>
            <div class="rewind-picks">
              <div
                v-for="p in match.predictions"
                :key="p.memberId"
                class="rewind-pick"
                :class="`rewind-pick--${p.status}`"
              >
                <span class="rewind-pick__user">{{ p.username }}</span>
                <span v-if="p.status !== 'no_pick'" class="rewind-pick__score">
                  {{ pickEmoji(p.status) }} {{ p.homeScore }}×{{ p.awayScore }}
                  <span v-if="p.points != null" class="rewind-pick__pts">+{{ p.points }}</span>
                </span>
                <span v-else class="rewind-pick__miss">sem palpite</span>
              </div>
            </div>
            <p v-if="match.exactHeroes.length" class="rewind-exact-hero">
              ✨ Placar exato: {{ match.exactHeroes.join(', ') }}
            </p>
          </article>
        </section>

        <!-- RANKING -->
        <section
          v-if="report.memberStats.some((m) => m.yesterdayPoints > 0)"
          id="rewind-slide-ranking"
          class="rewind-slide rewind-slide--ranking"
        >
          <div class="rewind-slide__glow rewind-slide__glow--gold" />
          <p class="rewind-kicker">Ranking do dia anterior</p>
          <h2 class="rewind-title">Quem brilhou?</h2>

          <div class="rewind-podium">
            <div
              v-for="(m, i) in report.memberStats.filter((x) => x.yesterdayPoints > 0).slice(0, 5)"
              :key="m.memberId"
              class="rewind-podium__item"
              :class="{ 'rewind-podium__item--first': i === 0 }"
            >
              <span class="rewind-podium__rank">#{{ i + 1 }}</span>
              <div class="rewind-podium__info">
                <strong>{{ m.username }}</strong>
                <span>{{ m.yesterdayPoints }} pts · {{ m.exactCount }} exato(s) · {{ m.resultCount }} resultado(s)</span>
              </div>
            </div>
          </div>
        </section>

        <!-- TODAY -->
        <section
          v-if="report.todayMatches.length > 0"
          id="rewind-slide-today"
          class="rewind-slide rewind-slide--today"
        >
          <div class="rewind-slide__glow rewind-slide__glow--green" />
          <p class="rewind-kicker">Hoje tem jogo</p>
          <h2 class="rewind-title">Palpites do dia</h2>
          <p class="rewind-subtitle">Manda no grupo antes da bola rolar</p>

          <article v-for="match in report.todayMatches" :key="match.matchId" class="rewind-match">
            <header class="rewind-match__head">
              <span class="rewind-match__stage">{{ match.stageLabel }}</span>
              <span class="rewind-match__time">{{ match.kickoffTime }}</span>
            </header>
            <div class="rewind-match__teams">
              <span>{{ match.home }}</span>
              <span class="rewind-match__vs">vs</span>
              <span>{{ match.away }}</span>
            </div>

            <div v-if="match.topPrediction" class="rewind-consensus">
              <span>Consenso do bolão</span>
              <strong>{{ match.topPrediction.home }} × {{ match.topPrediction.away }}</strong>
              <span>{{ match.topPrediction.count }} votos ({{ match.topPrediction.pct }}%)</span>
            </div>

            <div class="rewind-picks">
              <div
                v-for="p in match.predictions"
                :key="p.memberId"
                class="rewind-pick"
                :class="{ 'rewind-pick--outlier': match.topPrediction && p.homeScore != null && (p.homeScore !== match.topPrediction.home || p.awayScore !== match.topPrediction.away) }"
              >
                <span class="rewind-pick__user">{{ p.username }}</span>
                <span v-if="p.status !== 'no_pick'" class="rewind-pick__score">{{ p.homeScore }}×{{ p.awayScore }}</span>
                <span v-else class="rewind-pick__miss">⚠️ faltando</span>
              </div>
            </div>
          </article>
        </section>

        <!-- STATS -->
        <section id="rewind-slide-stats" class="rewind-slide rewind-slide--stats">
          <div class="rewind-slide__glow rewind-slide__glow--pink" />
          <p class="rewind-kicker">Estatísticas extras</p>
          <h2 class="rewind-title">Curiosidades</h2>

          <div class="rewind-fact-grid">
            <article v-if="report.boldestPick" class="rewind-fact rewind-fact--bold">
              <span class="rewind-fact__emoji">🎲</span>
              <strong>Mais ousado</strong>
              <p>{{ report.boldestPick.username }} foi contra o consenso em {{ report.boldestPick.match }} ({{ report.boldestPick.score }})</p>
            </article>
            <article v-if="report.consensusKing" class="rewind-fact rewind-fact--safe">
              <span class="rewind-fact__emoji">🤝</span>
              <strong>Mais consensual</strong>
              <p>{{ report.consensusKing.username }} apostou o placar mais popular ({{ report.consensusKing.score }})</p>
            </article>
            <article class="rewind-fact">
              <span class="rewind-fact__emoji">📊</span>
              <strong>Cobertura hoje</strong>
              <p>
                {{ report.todayMatches.reduce((s, m) => s + m.pickCount, 0) }} palpites registrados em
                {{ report.todayMatches.length }} jogo(s)
              </p>
            </article>
            <article class="rewind-fact">
              <span class="rewind-fact__emoji">⚠️</span>
              <strong>Atenção</strong>
              <p>
                {{ report.memberStats.filter((m) => m.todayMissing > 0).length }} participante(s) ainda não completaram os palpites de hoje
              </p>
            </article>
          </div>

          <button class="btn btn-primary rewind-copy-bottom" @click="copySummary">
            {{ copied ? '✓ Copiado!' : 'Copiar resumo para o grupo' }}
          </button>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rewind {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rewind-loading,
.rewind-empty {
  color: var(--text-muted);
  padding: 1.5rem;
}

.rewind-empty h2 {
  margin-bottom: 0.5rem;
}

.rewind-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
  align-items: center;
}

.rewind-date-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rewind-nav-btn {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  font-size: 1rem;
}

.rewind-nav-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.rewind-date {
  position: relative;
}

.rewind-date__label {
  display: none;
}

.rewind-date__select {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.5rem 1rem;
  color: var(--text);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
}

.rewind-copy {
  font-size: 0.85rem;
  padding: 0.55rem 1rem;
}

.rewind-dots {
  display: flex;
  gap: 0.35rem;
  justify-content: center;
}

.rewind-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--border);
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s, background 0.2s;
}

.rewind-dot.active {
  background: var(--accent);
  transform: scale(1.25);
}

.rewind-track {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  scroll-snap-type: y proximity;
}

.rewind-slide {
  position: relative;
  border-radius: 24px;
  padding: 2rem 1.5rem;
  overflow: hidden;
  scroll-snap-align: start;
  min-height: 420px;
  animation: rewindIn 0.6s ease both;
}

@keyframes rewindIn {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.rewind-slide__glow {
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.45;
  pointer-events: none;
  top: -80px;
  right: -60px;
  background: #c8f542;
}

.rewind-slide__glow--purple { background: #a855f7; }
.rewind-slide__glow--gold { background: #e8c468; top: auto; bottom: -60px; left: -40px; }
.rewind-slide__glow--green { background: #22c55e; }
.rewind-slide__glow--pink { background: #ec4899; right: auto; left: -40px; }

.rewind-slide--intro {
  background: linear-gradient(145deg, #1a1030 0%, #0f1419 45%, #1a2a10 100%);
  border: 1px solid rgba(200, 245, 66, 0.2);
}

.rewind-slide--yesterday {
  background: linear-gradient(145deg, #2a1040 0%, #151c26 50%, #1a1030 100%);
  border: 1px solid rgba(168, 85, 247, 0.25);
}

.rewind-slide--ranking {
  background: linear-gradient(145deg, #2a2010 0%, #151c26 50%, #1a1808 100%);
  border: 1px solid rgba(232, 196, 104, 0.25);
}

.rewind-slide--today {
  background: linear-gradient(145deg, #0a2818 0%, #151c26 50%, #102a18 100%);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.rewind-slide--stats {
  background: linear-gradient(145deg, #2a1020 0%, #151c26 50%, #281018 100%);
  border: 1px solid rgba(236, 72, 153, 0.25);
}

.rewind-kicker {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 0.5rem;
  position: relative;
}

.rewind-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 6vw, 2.75rem);
  font-weight: 800;
  line-height: 1.05;
  margin-bottom: 0.35rem;
  position: relative;
}

.rewind-subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  position: relative;
}

.rewind-day {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--accent);
  margin-bottom: 1.25rem;
  position: relative;
  text-transform: capitalize;
}

.rewind-intro-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 1.25rem;
  position: relative;
}

.rewind-stat-bubble {
  flex: 1;
  min-width: 90px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.rewind-stat-bubble strong {
  font-family: var(--font-display);
  font-size: 1.75rem;
  color: var(--accent);
}

.rewind-stat-bubble span {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rewind-stat-bubble--gold strong { color: var(--gold); }
.rewind-stat-bubble--pink strong { color: #f472b6; }

.rewind-highlights {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  position: relative;
}

.rewind-highlights li {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.75);
  padding-left: 0.85rem;
  border-left: 2px solid var(--accent);
}

.rewind-match {
  position: relative;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 1rem;
  margin-top: 1rem;
}

.rewind-match__head {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.rewind-match__teams {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  margin-bottom: 0.85rem;
  flex-wrap: wrap;
}

.rewind-match__score {
  font-size: 1.35rem;
  color: var(--gold);
}

.rewind-match__vs {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.rewind-consensus {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  background: rgba(200, 245, 66, 0.1);
  border: 1px solid rgba(200, 245, 66, 0.25);
  border-radius: 12px;
  padding: 0.55rem 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 0.82rem;
}

.rewind-consensus strong {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--accent);
}

.rewind-picks {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.rewind-pick {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0.65rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 0.85rem;
}

.rewind-pick--exact {
  background: rgba(200, 245, 66, 0.15);
  border: 1px solid rgba(200, 245, 66, 0.35);
}

.rewind-pick--result {
  background: rgba(232, 196, 104, 0.12);
  border: 1px solid rgba(232, 196, 104, 0.3);
}

.rewind-pick--miss {
  opacity: 0.65;
}

.rewind-pick--outlier {
  border: 1px dashed rgba(236, 72, 153, 0.45);
}

.rewind-pick__user {
  font-weight: 600;
}

.rewind-pick__score {
  font-family: var(--font-display);
  font-weight: 700;
}

.rewind-pick__pts {
  color: var(--accent);
  font-size: 0.78rem;
  margin-left: 0.35rem;
}

.rewind-pick__miss {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.rewind-exact-hero {
  margin-top: 0.65rem;
  font-size: 0.82rem;
  color: var(--accent);
}

.rewind-podium {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 1rem;
  position: relative;
}

.rewind-podium__item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.rewind-podium__item--first {
  background: linear-gradient(90deg, rgba(232, 196, 104, 0.2), rgba(232, 196, 104, 0.05));
  border-color: rgba(232, 196, 104, 0.4);
  transform: scale(1.02);
}

.rewind-podium__rank {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--gold);
  min-width: 2rem;
}

.rewind-podium__info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.rewind-podium__info span {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.rewind-fact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
  position: relative;
}

.rewind-fact {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.rewind-fact__emoji {
  font-size: 1.5rem;
}

.rewind-fact strong {
  font-family: var(--font-display);
}

.rewind-fact p {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.45;
}

.rewind-fact--bold {
  border-color: rgba(236, 72, 153, 0.35);
}

.rewind-fact--safe {
  border-color: rgba(200, 245, 66, 0.35);
}

.rewind-copy-bottom {
  margin-top: 1.5rem;
  width: 100%;
  position: relative;
}
</style>
