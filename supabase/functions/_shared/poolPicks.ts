import type { getServiceClient } from './supabase.ts'

type SupabaseClient = ReturnType<typeof getServiceClient>

export async function fetchPoolMemberPicks(supabase: SupabaseClient, poolId: string) {
  const { data: members } = await supabase
    .from('pool_members')
    .select('id, username, top_scorer_pick')
    .eq('pool_id', poolId)
    .order('joined_at')

  if (!members || members.length === 0) {
    return { picks: [], groups: [], teams: [], members: [], groupResults: [] }
  }

  const memberIds = members.map((m) => m.id)

  const [{ data: groupBets }, { data: thirdBets }, { data: teams }, { data: groups }, { data: groupResults }] =
    await Promise.all([
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
  }

  const picksMap = new Map<string, MemberPick>()

  for (const m of members) {
    picksMap.set(m.id, { memberId: m.id, username: m.username, groupBets: [], bestThirds: [] })
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
  }
}
