import { describe, it, expect } from 'vitest'
import {
  averagePoolSimilarity,
  computeGroupConsensus,
  computePositionStats,
  memberSimilarity,
  simulateGroupStagePoints,
} from './groupAnalysis'
import type { AnalysisGroup, AnalysisPick, AnalysisTeam } from './groupAnalysis'

const teams: AnalysisTeam[] = [
  { id: 'br', name: 'Brasil', flag_code: 'br', group_id: 'g-c' },
  { id: 'ma', name: 'Marrocos', flag_code: 'ma', group_id: 'g-c' },
  { id: 'ar', name: 'Argentina', flag_code: 'ar', group_id: 'g-j' },
  { id: 'fr', name: 'França', flag_code: 'fr', group_id: 'g-i' },
]

const groups: AnalysisGroup[] = [
  { id: 'g-c', name: 'C', sort_order: 3 },
  { id: 'g-j', name: 'J', sort_order: 10 },
]

const picks: AnalysisPick[] = [
  {
    memberId: '1',
    username: 'alice',
    groupBets: [
      { group: 'C', groupId: 'g-c', sortOrder: 3, firstId: 'br', secondId: 'ma', first: 'Brasil', second: 'Marrocos' },
      { group: 'J', groupId: 'g-j', sortOrder: 10, firstId: 'ar', secondId: 'ma', first: 'Argentina', second: 'Marrocos' },
    ],
    bestThirds: [{ teamId: 'fr', team: 'França', group: 'I' }],
  },
  {
    memberId: '2',
    username: 'bob',
    groupBets: [
      { group: 'C', groupId: 'g-c', sortOrder: 3, firstId: 'br', secondId: 'ma', first: 'Brasil', second: 'Marrocos' },
      { group: 'J', groupId: 'g-j', sortOrder: 10, firstId: 'ar', secondId: 'fr', first: 'Argentina', second: 'França' },
    ],
    bestThirds: [{ teamId: 'fr', team: 'França', group: 'I' }],
  },
]

describe('memberSimilarity', () => {
  it('scores high when picks match', () => {
    const result = memberSimilarity(picks[0], picks[1])
    expect(result.matching).toBeGreaterThan(0)
    expect(result.pct).toBe(33)
  })
})

describe('averagePoolSimilarity', () => {
  it('returns average across pairs', () => {
    expect(averagePoolSimilarity(picks)).toBeGreaterThan(0)
  })
})

describe('computeGroupConsensus', () => {
  it('finds majority first-place pick', () => {
    const consensus = computeGroupConsensus(picks, groups, teams)
    const groupC = consensus.find((g) => g.group === 'C')
    expect(groupC?.firstLeader?.teamId).toBe('br')
    expect(groupC?.firstLeader?.pct).toBe(100)
  })
})

describe('computePositionStats', () => {
  it('ranks common picks first', () => {
    const stats = computePositionStats(picks, teams, 'first')
    expect(stats[0].team).toBe('Brasil')
    expect(stats[0].count).toBe(2)
  })
})

describe('simulateGroupStagePoints', () => {
  it('calculates partial points for a scenario', () => {
    const results = simulateGroupStagePoints(picks, {
      'g-c': { firstId: 'br', secondId: 'ma', thirdId: 'ma', advancingAsThird: false },
      'g-j': { firstId: 'ar', secondId: 'fr', thirdId: 'fr', advancingAsThird: true },
    })

    expect(results[0].total).toBeGreaterThan(0)
    expect(results.find((r) => r.username === 'alice')?.groupHits).toBeGreaterThan(0)
  })
})
