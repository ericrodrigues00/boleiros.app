import type { getServiceClient } from './supabase.ts'

type SupabaseClient = ReturnType<typeof getServiceClient>

const STAGE_ORDER: Record<string, number> = {
  round_32: 1,
  round_16: 2,
  quarter: 3,
  semi: 4,
  third_place: 5,
  final: 6,
}

const STAGE_LABELS: Record<string, string> = {
  round_32: '16 avos',
  round_16: 'Oitavas',
  quarter: 'Quartas',
  semi: 'Semi',
  third_place: '3º lugar',
  final: 'Final',
}

export type KnockoutMatchInfo = {
  id: string
  stage: string
  stageLabel: string
  stageOrder: number
  kickoffAt: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  status: string
}

export async function fetchPoolMemberPicks(supabase: SupabaseClient, poolId: string) {
  const { data: members } = await supabase
    .from('pool_members')
    .select('id, username, top_scorer_pick')
    .eq('pool_id', poolId)
    .order('joined_at')

  if (!members || members.length === 0) {
    return { picks: [], groups: [], teams: [], members: [], groupResults: [], knockoutMatches: [] }
  }

  const memberIds = members.map((m) => m.id)

  const [
    { data: groupBets },
    { data: thirdBets },
    { data: teams },
    { data: groups },
    { data: groupResults },
    { data: knockoutMatchesRaw },
    { data: matchPredictions },
  ] = await Promise.all([
      supabase
        .from('group_bets')
        .select('member_id, group_id, predicted_first, predicted_second')
        .in('member_id', memberIds),
      supabase
        .from('best_third_bets')
        .select('member_id, team_id')
        .in('member_id', memberIds),
      supabase.from('teams').select('id, name, flag_code, group_id'),
      supabase.from('wc_groups').select('id, name, sort_order').order('sort_order'),
      supabase
        .from('group_results')
        .select('group_id, first_team_id, second_team_id, third_team_id, advancing_as_third'),
      supabase.from('matches').select('*').neq('stage', 'group').order('kickoff_at'),
      supabase
        .from('match_predictions')
        .select('member_id, match_id, home_score, away_score')
        .in('member_id', memberIds),
    ])

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]))
  const groupMap = new Map((groups ?? []).map((g) => [g.id, g]))

  type MemberPick = {
    memberId: string
    username: string
    groupBets: {
      group: string
      groupId: string
      sortOrder: number
      first: string
      firstId: string
      firstFlag: string
      second: string
      secondId: string
      secondFlag: string
    }[]
    bestThirds: { team: string; teamId: string; flag: string; group: string }[]
    matchPredictions: { matchId: string; homeScore: number; awayScore: number }[]
  }

  const knockoutMatches: KnockoutMatchInfo[] = (knockoutMatchesRaw ?? [])
    .map((match) => ({
      id: match.id,
      stage: match.stage,
      stageLabel: STAGE_LABELS[match.stage] ?? match.stage,
      stageOrder: STAGE_ORDER[match.stage] ?? 99,
      kickoffAt: match.kickoff_at,
      home: match.home_team_id
        ? (teamMap.get(match.home_team_id)?.name ?? '?')
        : (match.home_label ?? 'TBD'),
      away: match.away_team_id
        ? (teamMap.get(match.away_team_id)?.name ?? '?')
        : (match.away_label ?? 'TBD'),
      homeScore: match.home_score,
      awayScore: match.away_score,
      status: match.status,
    }))
    .sort((a, b) => a.stageOrder - b.stageOrder || a.kickoffAt.localeCompare(b.kickoffAt))

  const predictionsByMember = new Map<string, { matchId: string; homeScore: number; awayScore: number }[]>()
  for (const pred of matchPredictions ?? []) {
    if (!predictionsByMember.has(pred.member_id)) {
      predictionsByMember.set(pred.member_id, [])
    }
    predictionsByMember.get(pred.member_id)!.push({
      matchId: pred.match_id,
      homeScore: pred.home_score,
      awayScore: pred.away_score,
    })
  }

  const picksMap = new Map<string, MemberPick>()

  for (const m of members) {
    picksMap.set(m.id, {
      memberId: m.id,
      username: m.username,
      groupBets: [],
      bestThirds: [],
      matchPredictions: predictionsByMember.get(m.id) ?? [],
    })
  }

  for (const bet of groupBets ?? []) {
    const entry = picksMap.get(bet.member_id)
    if (!entry) continue
    const grp = groupMap.get(bet.group_id)
    const first = teamMap.get(bet.predicted_first)
    const second = teamMap.get(bet.predicted_second)
    entry.groupBets.push({
      group: grp?.name ?? '?',
      groupId: bet.group_id,
      sortOrder: grp?.sort_order ?? 0,
      first: first?.name ?? '?',
      firstId: bet.predicted_first,
      firstFlag: first?.flag_code ?? '',
      second: second?.name ?? '?',
      secondId: bet.predicted_second,
      secondFlag: second?.flag_code ?? '',
    })
  }

  for (const bet of thirdBets ?? []) {
    const entry = picksMap.get(bet.member_id)
    if (!entry) continue
    const team = teamMap.get(bet.team_id)
    const grp = team ? groupMap.get(team.group_id) : null
    entry.bestThirds.push({
      team: team?.name ?? '?',
      teamId: bet.team_id,
      flag: team?.flag_code ?? '',
      group: grp?.name ?? '?',
    })
  }

  for (const entry of picksMap.values()) {
    entry.groupBets.sort((a, b) => a.sortOrder - b.sortOrder)
    entry.bestThirds.sort((a, b) => a.group.localeCompare(b.group))
  }

  return {
    picks: Array.from(picksMap.values()),
    groups: (groups ?? []).map((g) => ({ id: g.id, name: g.name, sort_order: g.sort_order })),
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      flag_code: t.flag_code,
      group_id: t.group_id,
    })),
    members: members.map((m) => ({
      id: m.id,
      username: m.username,
      top_scorer_pick: m.top_scorer_pick,
    })),
    groupResults: (groupResults ?? []).map((r) => ({
      groupId: r.group_id,
      firstTeamId: r.first_team_id,
      secondTeamId: r.second_team_id,
      thirdTeamId: r.third_team_id,
      advancingAsThird: r.advancing_as_third,
    })),
    knockoutMatches,
  }
}
