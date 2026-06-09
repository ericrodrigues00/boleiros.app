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
  status: string
}): boolean {
  if (match.locked_override) return true
  if (match.status === 'finished' || match.status === 'live') return true
  const lockTime = new Date(match.kickoff_at).getTime() - PREDICTION_LOCK_MINUTES * 60 * 1000
  return Date.now() >= lockTime
}

export async function getGroupStageDeadline(supabase: ReturnType<typeof import('./supabase.ts').getServiceClient>) {
  const { data } = await supabase
    .from('tournament_settings')
    .select('value')
    .eq('key', 'group_stage_deadline')
    .maybeSingle()

  if (data?.value?.kickoff) return new Date(data.value.kickoff as string)

  const { data: firstMatch } = await supabase
    .from('matches')
    .select('kickoff_at')
    .eq('stage', 'group')
    .order('kickoff_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return firstMatch ? new Date(firstMatch.kickoff_at) : null
}

export function isGroupStageLocked(deadline: Date | null): boolean {
  if (!deadline) return false
  return Date.now() >= deadline.getTime()
}
