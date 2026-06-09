import { describe, it, expect } from 'vitest'
import {
  calculateMatchPoints,
  calculateGroupBetPoints,
  isMatchLocked,
  sortRankings,
} from './scoring'

describe('calculateMatchPoints', () => {
  it('awards 5 for correct result', () => {
    expect(calculateMatchPoints(2, 1, 3, 0)).toBe(5)
  })

  it('awards 10 for exact score', () => {
    expect(calculateMatchPoints(2, 1, 2, 1)).toBe(10)
  })

  it('awards 0 for wrong result', () => {
    expect(calculateMatchPoints(0, 1, 2, 0)).toBe(0)
  })
})

describe('calculateGroupBetPoints', () => {
  it('awards 5 per correct position', () => {
    expect(calculateGroupBetPoints('a', 'b', 'a', 'c')).toBe(5)
    expect(calculateGroupBetPoints('a', 'b', 'a', 'b')).toBe(10)
  })
})

describe('isMatchLocked', () => {
  it('locks 10 min before kickoff', () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    expect(isMatchLocked({ kickoff_at: future, locked_override: false, status: 'scheduled' })).toBe(true)
  })
})

describe('sortRankings', () => {
  it('sorts by points then exact scores then top scorer', () => {
    const sorted = sortRankings([
      { pool_id: 'p', member_id: '1', username: 'b', top_scorer_pick: 'Jogador B', total_points: 10, group_points: 0, best_third_points: 0, match_points: 10, exact_score_count: 1, top_scorer_correct: false },
      { pool_id: 'p', member_id: '2', username: 'a', top_scorer_pick: 'Jogador A', total_points: 10, group_points: 0, best_third_points: 0, match_points: 10, exact_score_count: 2, top_scorer_correct: false },
    ])
    expect(sorted[0].member_id).toBe('2')
  })
})
