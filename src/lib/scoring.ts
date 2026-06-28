export const GROUP_POSITION_POINTS = 5
export const BEST_THIRD_POINTS = 5
export const MATCH_RESULT_POINTS = 5
export const MATCH_EXACT_POINTS = 5
export const PREDICTION_LOCK_MINUTES = 10

export function getOutcome(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

export function calculateMatchPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  let points = 0
  if (getOutcome(predictedHome, predictedAway) === getOutcome(actualHome, actualAway)) {
    points += MATCH_RESULT_POINTS
  }
  if (predictedHome === actualHome && predictedAway === actualAway) {
    points += MATCH_EXACT_POINTS
  }
  return points
}

export function calculateGroupBetPoints(
  predictedFirst: string,
  predictedSecond: string,
  actualFirst: string | null,
  actualSecond: string | null,
): number {
  let points = 0
  if (actualFirst && predictedFirst === actualFirst) points += GROUP_POSITION_POINTS
  if (actualSecond && predictedSecond === actualSecond) points += GROUP_POSITION_POINTS
  return points
}

export function isMatchLocked(match: {
  kickoff_at: string
  locked_override: boolean
  unlocked_override?: boolean
  status: string
}): boolean {
  if (match.status === 'finished' || match.status === 'live') return true
  if (match.unlocked_override) return false
  if (match.locked_override) return true
  const lockTime = new Date(match.kickoff_at).getTime() - PREDICTION_LOCK_MINUTES * 60 * 1000
  return Date.now() >= lockTime
}

export function isGroupStageLocked(deadline: string | null): boolean {
  if (!deadline) return false
  return Date.now() >= new Date(deadline).getTime()
}

export function getLockCountdown(kickoffAt: string): number {
  const lockTime = new Date(kickoffAt).getTime() - PREDICTION_LOCK_MINUTES * 60 * 1000
  return Math.max(0, lockTime - Date.now())
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Travado'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m ${secs}s`
}

export function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

import type { RankingEntry } from '../types'

export function sortRankings(entries: RankingEntry[]): RankingEntry[] {
  return [...entries].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    if (b.exact_score_count !== a.exact_score_count) return b.exact_score_count - a.exact_score_count
    if (b.top_scorer_correct !== a.top_scorer_correct) {
      return Number(b.top_scorer_correct) - Number(a.top_scorer_correct)
    }
    return a.username.localeCompare(b.username)
  })
}
