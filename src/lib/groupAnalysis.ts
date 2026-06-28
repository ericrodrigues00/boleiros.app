import { BEST_THIRD_POINTS, calculateGroupBetPoints } from './scoring'

export type AnalysisPick = {
  memberId: string
  username: string
  groupBets: {
    group: string
    groupId: string
    sortOrder: number
    firstId: string
    secondId: string
    first: string
    second: string
    firstFlag?: string
    secondFlag?: string
  }[]
  bestThirds: { teamId: string; team: string; flag?: string; group: string }[]
  matchPredictions?: { matchId: string; homeScore: number; awayScore: number }[]
}

export type AnalysisTeam = {
  id: string
  name: string
  flag_code: string
  group_id: string
}

export type AnalysisGroup = {
  id: string
  name: string
  sort_order: number
}

export type VoteCount = {
  teamId: string
  team: string
  flag: string
  count: number
  pct: number
}

export type GroupConsensus = {
  group: string
  groupId: string
  sortOrder: number
  totalVoters: number
  firstLeader: VoteCount | null
  secondLeader: VoteCount | null
  consensusPct: number
}

export type PairSimilarity = {
  memberA: string
  memberB: string
  memberAId: string
  memberBId: string
  pct: number
  matchingSlots: number
  totalSlots: number
}

export type PositionPickStat = {
  key: string
  group: string
  position: '1º' | '2º' | '3º'
  team: string
  flag: string
  count: number
  pct: number
  voters: string[]
}

export type SimulationScenario = Record<
  string,
  {
    firstId: string
    secondId: string
    thirdId: string
    advancingAsThird: boolean
  }
>

export type SimulationResult = {
  memberId: string
  username: string
  groupPoints: number
  thirdPoints: number
  total: number
  groupHits: number
  thirdHits: number
}

export type MemberSimilarityProfile = {
  memberId: string
  username: string
  avgSimilarityPct: number
  comparedWith: number
}

export type PlayerArchetypes = {
  safePlayer: MemberSimilarityProfile | null
  boldPlayer: MemberSimilarityProfile | null
}

function teamMeta(teamId: string, teams: AnalysisTeam[]) {
  const team = teams.find((t) => t.id === teamId)
  return {
    teamId,
    team: team?.name ?? '?',
    flag: team?.flag_code ?? '',
  }
}

export function memberSimilarity(a: AnalysisPick, b: AnalysisPick): { pct: number; matching: number; total: number } {
  let matching = 0
  let total = 0

  const betsB = new Map(b.groupBets.map((g) => [g.groupId, g]))
  for (const ga of a.groupBets) {
    const gb = betsB.get(ga.groupId)
    if (!ga.firstId || !ga.secondId || !gb?.firstId || !gb?.secondId) continue
    total += 2
    if (ga.firstId === gb.firstId) matching++
    if (ga.secondId === gb.secondId) matching++
  }

  if (a.bestThirds.length > 0 && b.bestThirds.length > 0) {
    total += 8
    const thirdsB = new Set(b.bestThirds.map((t) => t.teamId))
    for (const third of a.bestThirds) {
      if (thirdsB.has(third.teamId)) matching++
    }
  }

  if (total === 0) return { pct: 0, matching: 0, total: 0 }
  return { pct: Math.round((matching / total) * 100), matching, total }
}

export function computeMemberSimilarityProfiles(picks: AnalysisPick[]): MemberSimilarityProfile[] {
  const active = picks.filter((p) => p.groupBets.length > 0)
  if (active.length < 2) return []

  return active.map((pick) => {
    let sum = 0
    let count = 0
    for (const other of active) {
      if (other.memberId === pick.memberId) continue
      const { pct } = memberSimilarity(pick, other)
      sum += pct
      count++
    }
    return {
      memberId: pick.memberId,
      username: pick.username,
      avgSimilarityPct: count > 0 ? Math.round(sum / count) : 0,
      comparedWith: count,
    }
  })
}

export function computePlayerArchetypes(picks: AnalysisPick[]): PlayerArchetypes {
  const profiles = computeMemberSimilarityProfiles(picks)
  if (profiles.length === 0) return { safePlayer: null, boldPlayer: null }

  const sorted = [...profiles].sort((a, b) => b.avgSimilarityPct - a.avgSimilarityPct)
  const safePlayer = sorted[0]
  const boldPlayer = sorted.length > 1 ? sorted[sorted.length - 1] : null

  if (boldPlayer && safePlayer.memberId === boldPlayer.memberId) {
    return { safePlayer, boldPlayer: null }
  }

  return { safePlayer, boldPlayer }
}

export function computePairSimilarities(picks: AnalysisPick[]): PairSimilarity[] {
  const pairs: PairSimilarity[] = []
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const { pct, matching, total } = memberSimilarity(picks[i], picks[j])
      pairs.push({
        memberA: picks[i].username,
        memberB: picks[j].username,
        memberAId: picks[i].memberId,
        memberBId: picks[j].memberId,
        pct,
        matchingSlots: matching,
        totalSlots: total,
      })
    }
  }
  return pairs.sort((a, b) => b.pct - a.pct)
}

export function averagePoolSimilarity(picks: AnalysisPick[]): number {
  const pairs = computePairSimilarities(picks)
  if (pairs.length === 0) return 0
  return Math.round(pairs.reduce((sum, p) => sum + p.pct, 0) / pairs.length)
}

export function countVotes(
  picks: AnalysisPick[],
  groupId: string,
  position: 'firstId' | 'secondId',
  teams: AnalysisTeam[],
): VoteCount[] {
  const counts = new Map<string, number>()
  let total = 0

  for (const pick of picks) {
    const bet = pick.groupBets.find((g) => g.groupId === groupId)
    const teamId = bet?.[position]
    if (!teamId) continue
    total++
    counts.set(teamId, (counts.get(teamId) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([teamId, count]) => ({
      ...teamMeta(teamId, teams),
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

export function computeGroupConsensus(
  picks: AnalysisPick[],
  groups: AnalysisGroup[],
  teams: AnalysisTeam[],
): GroupConsensus[] {
  return [...groups]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((group) => {
      const firstVotes = countVotes(picks, group.id, 'firstId', teams)
      const secondVotes = countVotes(picks, group.id, 'secondId', teams)
      const totalVoters = picks.filter((p) => p.groupBets.some((g) => g.groupId === group.id)).length
      const firstLeader = firstVotes[0] ?? null
      const secondLeader = secondVotes[0] ?? null
      const consensusValues = [firstLeader?.pct ?? 0, secondLeader?.pct ?? 0].filter((v) => v > 0)
      const consensusPct =
        consensusValues.length > 0
          ? Math.round(consensusValues.reduce((a, b) => a + b, 0) / consensusValues.length)
          : 0

      return {
        group: group.name,
        groupId: group.id,
        sortOrder: group.sort_order,
        totalVoters,
        firstLeader,
        secondLeader,
        consensusPct,
      }
    })
}

export function computePositionStats(
  picks: AnalysisPick[],
  teams: AnalysisTeam[],
  position: 'first' | 'second' | 'third',
): PositionPickStat[] {
  const stats = new Map<string, PositionPickStat>()

  for (const pick of picks) {
    if (position === 'third') {
      for (const third of pick.bestThirds) {
        const key = `3º|${third.teamId}`
        const existing = stats.get(key)
        if (existing) {
          existing.count++
          existing.voters.push(pick.username)
        } else {
          stats.set(key, {
            key,
            group: third.group,
            position: '3º',
            team: third.team,
            flag: third.flag ?? teamMeta(third.teamId, teams).flag,
            count: 1,
            pct: 0,
            voters: [pick.username],
          })
        }
      }
      continue
    }

    const field = position === 'first' ? 'firstId' : 'secondId'
    const label = position === 'first' ? '1º' : '2º'
    const nameField = position === 'first' ? 'first' : 'second'
    const flagField = position === 'first' ? 'firstFlag' : 'secondFlag'

    for (const bet of pick.groupBets) {
      const teamId = bet[field]
      if (!teamId) continue
      const key = `${bet.group}|${label}|${teamId}`
      const existing = stats.get(key)
      if (existing) {
        existing.count++
        existing.voters.push(pick.username)
      } else {
        stats.set(key, {
          key,
          group: bet.group,
          position: label,
          team: bet[nameField],
          flag: bet[flagField] ?? teamMeta(teamId, teams).flag,
          count: 1,
          pct: 0,
          voters: [pick.username],
        })
      }
    }
  }

  const totalVoters = picks.filter((p) => p.groupBets.length > 0).length || 1
  return [...stats.values()]
    .map((s) => ({ ...s, pct: Math.round((s.count / totalVoters) * 100) }))
    .sort((a, b) => b.count - a.count)
}

export function computeThirdVotes(picks: AnalysisPick[], teams: AnalysisTeam[]): VoteCount[] {
  const counts = new Map<string, number>()
  let totalPicks = 0

  for (const pick of picks) {
    for (const third of pick.bestThirds) {
      totalPicks++
      counts.set(third.teamId, (counts.get(third.teamId) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([teamId, count]) => ({
      ...teamMeta(teamId, teams),
      count,
      pct: totalPicks > 0 ? Math.round((count / totalPicks) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

export function computeCompletionStats(picks: AnalysisPick[]) {
  const withAny = picks.filter((p) => p.groupBets.length > 0 || p.bestThirds.length > 0).length
  const complete = picks.filter((p) => p.groupBets.length === 12 && p.bestThirds.length === 8).length
  const avgGroups =
    picks.length > 0 ? Math.round((picks.reduce((s, p) => s + p.groupBets.length, 0) / picks.length) * 10) / 10 : 0
  const avgThirds =
    picks.length > 0 ? Math.round((picks.reduce((s, p) => s + p.bestThirds.length, 0) / picks.length) * 10) / 10 : 0

  return { withAny, complete, avgGroups, avgThirds, total: picks.length }
}

export function simulateGroupStagePoints(
  picks: AnalysisPick[],
  scenario: SimulationScenario,
): SimulationResult[] {
  const advancingThirds = new Set(
    Object.values(scenario)
      .filter((g) => g.advancingAsThird && g.thirdId)
      .map((g) => g.thirdId),
  )

  return picks
    .map((pick) => {
      let groupPoints = 0
      let groupHits = 0
      let thirdPoints = 0
      let thirdHits = 0

      for (const bet of pick.groupBets) {
        const result = scenario[bet.groupId]
        if (!result?.firstId || !result?.secondId) continue

        const pts = calculateGroupBetPoints(bet.firstId, bet.secondId, result.firstId, result.secondId)
        groupPoints += pts
        if (bet.firstId === result.firstId) groupHits++
        if (bet.secondId === result.secondId) groupHits++
      }

      for (const third of pick.bestThirds) {
        if (advancingThirds.has(third.teamId)) {
          thirdPoints += BEST_THIRD_POINTS
          thirdHits++
        }
      }

      return {
        memberId: pick.memberId,
        username: pick.username,
        groupPoints,
        thirdPoints,
        total: groupPoints + thirdPoints,
        groupHits,
        thirdHits,
      }
    })
    .sort((a, b) => b.total - a.total || b.groupHits - a.groupHits || a.username.localeCompare(b.username))
}

export function scenarioProgress(scenario: SimulationScenario, groups: AnalysisGroup[]): number {
  if (groups.length === 0) return 0
  const filled = groups.filter((g) => {
    const s = scenario[g.id]
    return s?.firstId && s?.secondId && s?.thirdId
  }).length
  return Math.round((filled / groups.length) * 100)
}

export function countAdvancingThirds(scenario: SimulationScenario): number {
  return Object.values(scenario).filter((g) => g.advancingAsThird).length
}
