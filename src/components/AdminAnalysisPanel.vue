<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  averagePoolSimilarity,
  computeCompletionStats,
  computeGroupConsensus,
  computePairSimilarities,
  computePositionStats,
  computeThirdVotes,
  countAdvancingThirds,
  countVotes,
  memberSimilarity,
  scenarioProgress,
  simulateGroupStagePoints,
  type AnalysisGroup,
  type AnalysisPick,
  type AnalysisTeam,
  type SimulationScenario,
} from '../lib/groupAnalysis'
import { toFlagEmoji } from '../lib/flags'

const props = defineProps<{
  picks: AnalysisPick[]
  groups: AnalysisGroup[]
  teams: AnalysisTeam[]
  loading: boolean
}>()

const analysisSection = ref<'overview' | 'groups' | 'matrix' | 'simulate'>('overview')
const scenario = ref<SimulationScenario>({})
const showRareOnly = ref(false)

const activePicks = computed(() => props.picks.filter((p) => p.groupBets.length > 0))

const completion = computed(() => computeCompletionStats(props.picks))
const avgSimilarity = computed(() => averagePoolSimilarity(activePicks.value))
const pairSimilarities = computed(() => computePairSimilarities(activePicks.value))
const groupConsensus = computed(() => computeGroupConsensus(activePicks.value, props.groups, props.teams))
const commonFirst = computed(() => computePositionStats(activePicks.value, props.teams, 'first').slice(0, 12))
const commonSecond = computed(() => computePositionStats(activePicks.value, props.teams, 'second').slice(0, 12))
const commonThirds = computed(() => computeThirdVotes(activePicks.value, props.teams).slice(0, 12))
const rarePicks = computed(() => {
  const all = [
    ...computePositionStats(activePicks.value, props.teams, 'first'),
    ...computePositionStats(activePicks.value, props.teams, 'second'),
    ...computePositionStats(activePicks.value, props.teams, 'third'),
  ]
  return all.filter((s) => s.count === 1)
})
const displayedRare = computed(() => (showRareOnly.value ? rarePicks.value : rarePicks.value.slice(0, 10)))

const sortedGroups = computed(() => [...props.groups].sort((a, b) => a.sort_order - b.sort_order))

const simulationResults = computed(() => {
  if (scenarioProgress(scenario.value, props.groups) < 100) return []
  if (countAdvancingThirds(scenario.value) !== 8) return []
  return simulateGroupStagePoints(activePicks.value, scenario.value)
})

const scenarioReady = computed(
  () => scenarioProgress(scenario.value, props.groups) === 100 && countAdvancingThirds(scenario.value) === 8,
)

const insights = computed(() => {
  const items: string[] = []
  const voters = activePicks.value.length
  if (voters === 0) return ['Nenhum palpite salvo ainda para analisar.']

  items.push(
    `${completion.value.complete} de ${completion.value.total} participantes completaram todos os 12 grupos e 8 terceiros.`,
  )
  items.push(`O bolão tem ${avgSimilarity.value}% de similaridade média entre os palpites.`)

  const highestConsensus = [...groupConsensus.value].sort((a, b) => b.consensusPct - a.consensusPct)[0]
  if (highestConsensus?.firstLeader) {
    items.push(
      `Grupo ${highestConsensus.group} é o mais consensual: ${highestConsensus.firstLeader.team} lidera com ${highestConsensus.firstLeader.pct}% dos votos no 1º lugar.`,
    )
  }

  if (rarePicks.value.length > 0) {
    const rare = rarePicks.value[0]
    items.push(
      `Palpite mais ousado: ${rare.team} como ${rare.position} no Grupo ${rare.group}, escolhido só por ${rare.voters[0]}.`,
    )
  }

  const topPair = pairSimilarities.value[0]
  if (topPair) {
    items.push(`${topPair.memberA} e ${topPair.memberB} têm os palpites mais parecidos (${topPair.pct}%).`)
  }

  const divergent = [...pairSimilarities.value].reverse()[0]
  if (divergent && divergent.pct < topPair.pct) {
    items.push(`${divergent.memberA} e ${divergent.memberB} divergem mais (${divergent.pct}% de similaridade).`)
  }

  return items
})

function teamsInGroup(groupId: string) {
  return props.teams.filter((t) => t.group_id === groupId)
}

function initScenario() {
  const next: SimulationScenario = {}
  for (const group of sortedGroups.value) {
    next[group.id] = scenario.value[group.id] ?? {
      firstId: '',
      secondId: '',
      thirdId: '',
      advancingAsThird: false,
    }
  }
  scenario.value = next
}

function pickForMember(memberId: string, groupId: string) {
  const pick = props.picks.find((p) => p.memberId === memberId)
  return pick?.groupBets.find((g) => g.groupId === groupId)
}

function thirdForMember(memberId: string, groupName: string) {
  const pick = props.picks.find((p) => p.memberId === memberId)
  return pick?.bestThirds.find((t) => t.group === groupName)
}

watch(
  () => props.groups,
  () => initScenario(),
  { immediate: true },
)
</script>

<template>
  <div class="analysis">
    <div v-if="loading" class="analysis-loading">Carregando dados para análise...</div>

    <template v-else-if="activePicks.length === 0">
      <div class="card analysis-empty">
        <h2>Sem palpites para analisar</h2>
        <p>Assim que os participantes salvarem apostas na fase de grupos, os gráficos e insights aparecem aqui.</p>
      </div>
    </template>

    <template v-else>
      <div class="analysis-nav">
        <button class="analysis-nav__btn" :class="{ active: analysisSection === 'overview' }" @click="analysisSection = 'overview'">
          Visão geral
        </button>
        <button class="analysis-nav__btn" :class="{ active: analysisSection === 'groups' }" @click="analysisSection = 'groups'">
          Por grupo
        </button>
        <button class="analysis-nav__btn" :class="{ active: analysisSection === 'matrix' }" @click="analysisSection = 'matrix'">
          Planilha
        </button>
        <button
          class="analysis-nav__btn analysis-nav__btn--accent"
          :class="{ active: analysisSection === 'simulate' }"
          @click="analysisSection = 'simulate'; initScenario()"
        >
          Simular cenário
        </button>
      </div>

      <template v-if="analysisSection === 'overview'">
        <div class="stats-grid">
          <article class="stat-card">
            <span class="stat-card__label">Participantes com palpites</span>
            <strong class="stat-card__value">{{ completion.withAny }}/{{ completion.total }}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-card__label">Apostas completas</span>
            <strong class="stat-card__value">{{ completion.complete }}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-card__label">Similaridade média</span>
            <strong class="stat-card__value">{{ avgSimilarity }}%</strong>
          </article>
          <article class="stat-card">
            <span class="stat-card__label">Média de grupos / terceiros</span>
            <strong class="stat-card__value">{{ completion.avgGroups }} / {{ completion.avgThirds }}</strong>
          </article>
        </div>

        <section class="card analysis-block">
          <h2>Insights do bolão</h2>
          <ul class="insights-list">
            <li v-for="(item, i) in insights" :key="i">{{ item }}</li>
          </ul>
        </section>

        <div class="analysis-columns">
          <section class="card analysis-block">
            <h2>Palpites mais comuns (1º lugar)</h2>
            <div class="bar-list">
              <div v-for="item in commonFirst" :key="item.key" class="bar-row">
                <div class="bar-row__meta">
                  <span>{{ toFlagEmoji(item.flag) }} {{ item.team }}</span>
                  <span class="bar-row__sub">Grupo {{ item.group }}</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill bar-fill--accent" :style="{ width: `${item.pct}%` }" />
                </div>
                <span class="bar-pct">{{ item.count }} · {{ item.pct }}%</span>
              </div>
            </div>
          </section>

          <section class="card analysis-block">
            <h2>Palpites mais comuns (2º lugar)</h2>
            <div class="bar-list">
              <div v-for="item in commonSecond" :key="item.key" class="bar-row">
                <div class="bar-row__meta">
                  <span>{{ toFlagEmoji(item.flag) }} {{ item.team }}</span>
                  <span class="bar-row__sub">Grupo {{ item.group }}</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill bar-fill--gold" :style="{ width: `${item.pct}%` }" />
                </div>
                <span class="bar-pct">{{ item.count }} · {{ item.pct }}%</span>
              </div>
            </div>
          </section>
        </div>

        <section class="card analysis-block">
          <h2>8 melhores terceiros mais escolhidos</h2>
          <div class="bar-list">
            <div v-for="item in commonThirds" :key="item.teamId" class="bar-row">
              <div class="bar-row__meta">
                <span>{{ toFlagEmoji(item.flag) }} {{ item.team }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill bar-fill--accent" :style="{ width: `${item.pct}%` }" />
              </div>
              <span class="bar-pct">{{ item.count }} · {{ item.pct }}%</span>
            </div>
          </div>
        </section>

        <section class="card analysis-block">
          <div class="analysis-block__header">
            <h2>Palpites mais incomuns</h2>
            <button class="btn btn-ghost" style="padding:0.35rem 0.75rem;font-size:0.8rem" @click="showRareOnly = !showRareOnly">
              {{ showRareOnly ? 'Ver menos' : `Ver todos (${rarePicks.length})` }}
            </button>
          </div>
          <div class="rare-grid">
            <article v-for="item in displayedRare" :key="item.key" class="rare-card">
              <span class="rare-card__pos">{{ item.position }} · Grupo {{ item.group }}</span>
              <strong>{{ toFlagEmoji(item.flag) }} {{ item.team }}</strong>
              <span class="rare-card__who">Só {{ item.voters.join(', ') }}</span>
            </article>
          </div>
        </section>

        <section class="card analysis-block">
          <h2>Quem mais se parece</h2>
          <div class="pair-list">
            <div v-for="pair in pairSimilarities.slice(0, 8)" :key="`${pair.memberAId}-${pair.memberBId}`" class="pair-row">
              <span>{{ pair.memberA }} × {{ pair.memberB }}</span>
              <div class="pair-bar">
                <div class="bar-fill bar-fill--accent" :style="{ width: `${pair.pct}%` }" />
              </div>
              <span class="bar-pct">{{ pair.pct }}%</span>
            </div>
          </div>
        </section>
      </template>

      <template v-if="analysisSection === 'groups'">
        <div class="groups-analysis">
          <article v-for="group in groupConsensus" :key="group.groupId" class="card group-analysis-card">
            <header class="group-analysis-card__head">
              <h3>Grupo {{ group.group }}</h3>
              <span class="consensus-badge">{{ group.consensusPct }}% consenso</span>
            </header>
            <p class="group-analysis-card__sub">{{ group.totalVoters }} participante(s) apostaram neste grupo</p>

            <div class="group-leaders">
              <div v-if="group.firstLeader">
                <span class="label">1º mais votado</span>
                <strong>{{ toFlagEmoji(group.firstLeader.flag) }} {{ group.firstLeader.team }}</strong>
                <span class="muted">{{ group.firstLeader.count }} votos ({{ group.firstLeader.pct }}%)</span>
              </div>
              <div v-if="group.secondLeader">
                <span class="label">2º mais votado</span>
                <strong>{{ toFlagEmoji(group.secondLeader.flag) }} {{ group.secondLeader.team }}</strong>
                <span class="muted">{{ group.secondLeader.count }} votos ({{ group.secondLeader.pct }}%)</span>
              </div>
            </div>

            <div class="mini-chart">
              <div class="mini-chart__title">Distribuição do 1º lugar</div>
              <div
                v-for="vote in countVotes(activePicks, group.groupId, 'firstId', teams).slice(0, 4)"
                :key="vote.teamId"
                class="bar-row bar-row--compact"
              >
                <span>{{ toFlagEmoji(vote.flag) }} {{ vote.team }}</span>
                <div class="bar-track"><div class="bar-fill bar-fill--accent" :style="{ width: `${vote.pct}%` }" /></div>
                <span class="bar-pct">{{ vote.pct }}%</span>
              </div>
            </div>
          </article>
        </div>
      </template>

      <template v-if="analysisSection === 'matrix'">
        <section class="card analysis-block">
          <h2>Planilha de palpites</h2>
          <p class="analysis-block__sub">Visão completa de 1º e 2º colocados por participante e grupo.</p>
          <div class="matrix-wrap">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th v-for="pick in activePicks" :key="pick.memberId">{{ pick.username }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="group in sortedGroups" :key="group.id">
                  <td class="matrix-group">{{ group.name }}</td>
                  <td v-for="pick in activePicks" :key="`${group.id}-${pick.memberId}`">
                    <div class="matrix-cell">
                      <template v-if="pickForMember(pick.memberId, group.id)">
                        <span>1º {{ pickForMember(pick.memberId, group.id)!.first }}</span>
                        <span class="muted">2º {{ pickForMember(pick.memberId, group.id)!.second }}</span>
                        <span v-if="thirdForMember(pick.memberId, group.name)" class="muted">
                          3º {{ thirdForMember(pick.memberId, group.name)!.team }}
                        </span>
                      </template>
                      <span v-else class="muted">—</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card analysis-block">
          <h2>Matriz de similaridade</h2>
          <div class="matrix-wrap">
            <table class="matrix-table matrix-table--similarity">
              <thead>
                <tr>
                  <th></th>
                  <th v-for="pick in activePicks" :key="`h-${pick.memberId}`">{{ pick.username }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in activePicks" :key="`r-${row.memberId}`">
                  <th>{{ row.username }}</th>
                  <td
                    v-for="col in activePicks"
                    :key="`${row.memberId}-${col.memberId}`"
                    :class="['sim-cell', row.memberId === col.memberId ? 'sim-cell--self' : '']"
                    :style="row.memberId !== col.memberId ? { '--sim': `${memberSimilarity(row, col).pct}%` } : undefined"
                  >
                    {{ row.memberId === col.memberId ? '—' : `${memberSimilarity(row, col).pct}%` }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="analysisSection === 'simulate'">
        <section class="card analysis-block">
          <h2>Simular pontuação da fase de grupos</h2>
          <p class="analysis-block__sub">
            Defina a classificação de cada grupo e marque exatamente 8 terceiros colocados que avançam.
            O sistema calcula quantos pontos cada participante faria nesse cenário.
          </p>
          <p class="simulate-progress">
            Grupos preenchidos: {{ scenarioProgress(scenario, groups) }}% ·
            Terceiros avançando: {{ countAdvancingThirds(scenario) }}/8
          </p>
        </section>

        <div class="simulate-grid">
          <article v-for="group in sortedGroups" :key="group.id" class="card simulate-card">
            <h3>Grupo {{ group.name }}</h3>
            <div class="field">
              <label class="label">1º lugar</label>
              <select v-model="scenario[group.id].firstId" class="input">
                <option value="">—</option>
                <option v-for="t in teamsInGroup(group.id)" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="label">2º lugar</label>
              <select v-model="scenario[group.id].secondId" class="input">
                <option value="">—</option>
                <option v-for="t in teamsInGroup(group.id)" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="label">3º lugar</label>
              <select v-model="scenario[group.id].thirdId" class="input">
                <option value="">—</option>
                <option v-for="t in teamsInGroup(group.id)" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <label class="simulate-check">
              <input type="checkbox" v-model="scenario[group.id].advancingAsThird" />
              Este 3º avança entre os 8 melhores
            </label>
          </article>
        </div>

        <section v-if="scenarioReady" class="card analysis-block">
          <h2>Ranking simulado</h2>
          <table class="simulate-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jogador</th>
                <th>Pontos</th>
                <th>Grupos</th>
                <th>Terceiros</th>
                <th>Acertos 1º/2º</th>
                <th>Acertos 3º</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in simulationResults" :key="row.memberId">
                <td>{{ i + 1 }}</td>
                <td><strong>{{ row.username }}</strong></td>
                <td class="sim-total">{{ row.total }}</td>
                <td>{{ row.groupPoints }}</td>
                <td>{{ row.thirdPoints }}</td>
                <td>{{ row.groupHits }}</td>
                <td>{{ row.thirdHits }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p v-else class="simulate-hint">
          Preencha todos os 12 grupos e marque exatamente 8 terceiros avançando para ver o ranking simulado.
        </p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.analysis { display: flex; flex-direction: column; gap: 1rem; }
.analysis-loading, .analysis-empty { color: var(--text-muted); }
.analysis-empty h2 { margin-bottom: 0.5rem; }

.analysis-nav {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.analysis-nav__btn {
  padding: 0.55rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.analysis-nav__btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(200, 245, 66, 0.08);
}

.analysis-nav__btn--accent.active {
  background: var(--accent);
  color: var(--bg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
}

.stat-card__label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.stat-card__value {
  font-family: var(--font-display);
  font-size: 1.5rem;
}

.analysis-block { padding: 1.25rem; }
.analysis-block h2 { font-size: 1.05rem; margin-bottom: 0.75rem; }
.analysis-block__header { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
.analysis-block__header h2 { margin: 0; }
.analysis-block__sub { color: var(--text-muted); font-size: 0.88rem; margin-bottom: 0.75rem; }

.analysis-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.insights-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.insights-list li {
  padding-left: 1rem;
  border-left: 2px solid var(--accent);
  color: var(--text-muted);
  font-size: 0.92rem;
}

.bar-list { display: flex; flex-direction: column; gap: 0.65rem; }
.bar-row {
  display: grid;
  grid-template-columns: minmax(140px, 1.4fr) 1fr auto;
  gap: 0.65rem;
  align-items: center;
  font-size: 0.85rem;
}
.bar-row--compact { grid-template-columns: minmax(100px, 1fr) 1fr auto; }
.bar-row__meta { display: flex; flex-direction: column; gap: 0.1rem; }
.bar-row__sub { color: var(--text-muted); font-size: 0.75rem; }
.bar-track {
  height: 8px;
  background: var(--bg);
  border-radius: 999px;
  overflow: hidden;
}
.bar-fill { height: 100%; border-radius: 999px; min-width: 2px; }
.bar-fill--accent { background: var(--accent); }
.bar-fill--gold { background: var(--gold); }
.bar-pct { color: var(--text-muted); font-size: 0.78rem; white-space: nowrap; }

.rare-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.6rem;
}
.rare-card {
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.rare-card__pos { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; }
.rare-card__who { font-size: 0.78rem; color: var(--gold); }

.pair-list { display: flex; flex-direction: column; gap: 0.55rem; }
.pair-row {
  display: grid;
  grid-template-columns: minmax(140px, 1.2fr) 1fr auto;
  gap: 0.65rem;
  align-items: center;
  font-size: 0.85rem;
}
.pair-bar { height: 8px; background: var(--bg); border-radius: 999px; overflow: hidden; }

.groups-analysis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}
.group-analysis-card { padding: 1rem; }
.group-analysis-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}
.group-analysis-card__sub { color: var(--text-muted); font-size: 0.82rem; margin-bottom: 0.75rem; }
.consensus-badge {
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(200, 245, 66, 0.12);
  color: var(--accent);
}
.group-leaders {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 0.85rem;
}
.group-leaders strong { display: block; margin: 0.15rem 0; }
.muted { color: var(--text-muted); font-size: 0.8rem; }
.mini-chart__title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.45rem;
}

.matrix-wrap { overflow-x: auto; }
.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.matrix-table th,
.matrix-table td {
  border: 1px solid var(--border);
  padding: 0.45rem 0.55rem;
  text-align: left;
  vertical-align: top;
}
.matrix-table th {
  background: var(--bg);
  color: var(--text-muted);
  font-weight: 600;
}
.matrix-group {
  font-weight: 700;
  background: rgba(200, 245, 66, 0.06);
}
.matrix-cell {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 110px;
}
.sim-cell {
  text-align: center;
  background: linear-gradient(90deg, rgba(200, 245, 66, 0.18) var(--sim, 0%), transparent var(--sim, 0%));
}
.sim-cell--self { background: var(--bg); color: var(--text-muted); }

.simulate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}
.simulate-card { padding: 1rem; }
.simulate-card h3 { margin-bottom: 0.75rem; font-size: 0.95rem; }
.simulate-check {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: var(--text-muted);
  cursor: pointer;
}
.simulate-progress {
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 600;
}
.simulate-hint {
  color: var(--text-muted);
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem;
}
.simulate-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.simulate-table th,
.simulate-table td {
  border-bottom: 1px solid var(--border);
  padding: 0.55rem 0.65rem;
  text-align: left;
}
.sim-total {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--accent);
}
</style>
