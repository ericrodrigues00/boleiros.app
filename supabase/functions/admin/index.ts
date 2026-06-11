import { handleCors, json, error } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { getMember } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await getMember(req)
    if (!auth) return error('Não autenticado', 401)
    if (auth.role !== 'admin') return error('Acesso restrito ao admin do bolão', 403)

    const body = req.method === 'GET' ? {} : await req.json()
    const action = body.action ?? (req.method === 'GET' ? 'members' : null)
    const supabase = getServiceClient()

    if (action === 'members') {
      const { data: members, error: memError } = await supabase
        .from('pool_members')
        .select('id, username, role, top_scorer_pick, joined_at')
        .eq('pool_id', auth.poolId)
        .order('joined_at')

      if (memError) return error(memError.message, 500)
      return json({ members: members ?? [] })
    }

    if (action === 'member-picks') {
      const { data: members } = await supabase
        .from('pool_members')
        .select('id, username')
        .eq('pool_id', auth.poolId)

      if (!members || members.length === 0) return json({ picks: [] })

      const memberIds = members.map((m) => m.id)

      const [{ data: groupBets }, { data: thirdBets }, { data: teams }, { data: groups }] =
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

      return json({
        picks: Array.from(picksMap.values()),
        groups: (groups ?? []).map((g) => ({ id: g.id, name: g.name, sort_order: g.sort_order })),
        teams: (teams ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          flag_code: t.flag_code,
          group_id: t.group_id,
        })),
      })
    }

    if (action === 'remove-member') {
      const { memberId } = body
      if (!memberId) return error('memberId é obrigatório')
      if (memberId === auth.memberId) return error('Você não pode remover a si mesmo')

      const { data: target } = await supabase
        .from('pool_members')
        .select('id, role')
        .eq('id', memberId)
        .eq('pool_id', auth.poolId)
        .maybeSingle()

      if (!target) return error('Membro não encontrado', 404)

      const { error: delError } = await supabase
        .from('pool_members')
        .delete()
        .eq('id', memberId)

      if (delError) return error(delError.message, 500)
      return json({ ok: true })
    }

    return error('Ação inválida', 400)
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Erro interno', 500)
  }
})
