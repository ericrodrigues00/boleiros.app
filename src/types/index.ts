export interface Pool {
  id: string
  name: string
  invite_token: string
  created_at: string
  memberCount?: number
}

export interface Member {
  id: string
  pool_id: string
  username: string
  role: 'admin' | 'member'
  top_scorer_pick: string
  joined_at: string
}

export interface WcGroup {
  id: string
  name: string
  sort_order: number
}

export interface Team {
  id: string
  name: string
  flag_code: string
  group_id: string
}

export interface GroupBet {
  id?: string
  member_id?: string
  group_id: string
  predicted_first: string
  predicted_second: string
  points_earned?: number
}

export interface BestThirdBet {
  id?: string
  member_id?: string
  team_id: string
  points_earned?: number
}

export interface Match {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  home_label: string | null
  away_label: string | null
  stage: string
  group_id: string | null
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'finished'
  locked_override: boolean
  unlocked_override?: boolean
  locked?: boolean
  home_team?: Team | null
  away_team?: Team | null
  wc_group?: WcGroup | null
}

export interface MatchPrediction {
  id: string
  member_id: string
  match_id: string
  home_score: number
  away_score: number
  points_earned: number
}

export interface RankingEntry {
  pool_id: string
  member_id: string
  username: string
  top_scorer_pick: string
  total_points: number
  group_points: number
  best_third_points: number
  match_points: number
  exact_score_count: number
  top_scorer_correct: boolean
}
