import { handleCors, json, error } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { getMember } from '../_shared/auth.ts'
import {
  isMatchLocked,
  isGroupStageLocked,
  getGroupStageDeadline,
  BEST_THIRD_POINTS,
} from '../_shared/scoring.ts'
import { fetchPoolMemberPicks } from '../_shared/poolPicks.ts'

const MAX_BEST_THIRDS = 8

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await getMember(req)
    if (!auth) return error('Não autenticado', 401)

    const body = req.method === 'GET' ? {} : await req.json()
    const action = body.action ?? (req.method === 'GET' ? 'group-stage' : null)
    const supabase = getServiceClient()

    if (action === 'group-stage') {
      const deadline = await getGroupStageDeadline(supabase)
      const locked = isGroupStageLocked(deadline)

      const [{ data: groups }, { data: teams }, { data: groupBets }, { data: bestThirds }] = await Promise.all([
        supabase.from('wc_groups').select('*').order('sort_order'),
        supabase.from('teams').select('*').order('name'),
        supabase.from('group_bets').select('*').eq('member_id', auth.memberId),
        supabase.from('best_third_bets').select('*').eq('member_id', auth.memberId),
      ])

      return json({
        locked,
        deadline: deadline?.toISOString() ?? null,
        groups: groups ?? [],
        teams: teams ?? [],
        groupBets: groupBets ?? [],
        bestThirdBets: bestThirds ?? [],
      })
    }

    if (action === 'save-group-stage') {
      const { groupBets, bestThirdTeamIds } = body
      const deadline = await getGroupStageDeadline(supabase)
      if (isGroupStageLocked(deadline)) {
        return error('Fase de grupos travada', 403)
      }

      if (!Array.isArray(groupBets) || groupBets.length === 0) {
        return error('Apostas de grupo são obrigatórias')
      }

      if (!Array.isArray(bestThirdTeamIds) || bestThirdTeamIds.length !== MAX_BEST_THIRDS) {
        return error(`Selecione exatamente ${MAX_BEST_THIRDS} melhores terceiros`)
      }

      const { data: teams } = await supabase.from('teams').select('id, group_id')
      const teamGroupMap = new Map((teams ?? []).map((t) => [t.id, t.group_id]))

      for (const bet of groupBets) {
        if (!bet.groupId || !bet.predictedFirst || !bet.predictedSecond) {
          return error('Cada grupo precisa de 1º e 2º colocados')
        }
        if (bet.predictedFirst === bet.predictedSecond) {
          return error('1º e 2º colocados devem ser diferentes')
        }
        const firstGroup = teamGroupMap.get(bet.predictedFirst)
        const secondGroup = teamGroupMap.get(bet.predictedSecond)
        if (firstGroup !== bet.groupId || secondGroup !== bet.groupId) {
          return error('Seleções devem pertencer ao grupo indicado')
        }
      }

      const uniqueThirds = new Set(bestThirdTeamIds)
      if (uniqueThirds.size !== MAX_BEST_THIRDS) {
        return error('Melhores terceiros devem ser seleções diferentes')
      }

      await supabase.from('group_bets').delete().eq('member_id', auth.memberId)
      await supabase.from('best_third_bets').delete().eq('member_id', auth.memberId)

      const groupRows = groupBets.map((bet: { groupId: string; predictedFirst: string; predictedSecond: string }) => ({
        member_id: auth.memberId,
        group_id: bet.groupId,
        predicted_first: bet.predictedFirst,
        predicted_second: bet.predictedSecond,
      }))

      const thirdRows = bestThirdTeamIds.map((teamId: string) => ({
        member_id: auth.memberId,
        team_id: teamId,
      }))

      const { error: gbError } = await supabase.from('group_bets').insert(groupRows)
      if (gbError) return error(gbError.message, 500)

      const { error: btError } = await supabase.from('best_third_bets').insert(thirdRows)
      if (btError) return error(btError.message, 500)

      return json({ ok: true })
    }

    if (action === 'matches') {
      const stage = body.stage ?? new URL(req.url).searchParams.get('stage') ?? 'knockout'

      let query = supabase.from('matches').select('*').order('kickoff_at')
      if (stage === 'knockout') {
        query = query.neq('stage', 'group')
      } else {
        query = query.eq('stage', 'group')
      }

      const [{ data: matches }, { data: predictions }, { data: teams }, { data: groups }] = await Promise.all([
        query,
        supabase.from('match_predictions').select('*').eq('member_id', auth.memberId),
        supabase.from('teams').select('id, name, flag_code'),
        supabase.from('wc_groups').select('id, name'),
      ])

      const teamMap = new Map((teams ?? []).map((t) => [t.id, t]))
      const groupMap = new Map((groups ?? []).map((g) => [g.id, g]))

      const enriched = (matches ?? []).map((match) => ({
        ...match,
        home_team: match.home_team_id ? teamMap.get(match.home_team_id) ?? null : null,
        away_team: match.away_team_id ? teamMap.get(match.away_team_id) ?? null : null,
        wc_group: match.group_id ? groupMap.get(match.group_id) ?? null : null,
        locked: isMatchLocked(match),
      }))

      return json({
        matches: enriched,
        predictions: predictions ?? [],
      })
    }

    if (action === 'save-match') {
      const { matchId, homeScore, awayScore } = body
      if (!matchId) return error('matchId é obrigatório')
      if (homeScore == null || awayScore == null) return error('Placar é obrigatório')
      if (homeScore < 0 || awayScore < 0 || homeScore > 20 || awayScore > 20) {
        return error('Placar inválido')
      }

      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()

      if (matchError || !match) return error('Partida não encontrada', 404)
      if (match.stage === 'group') return error('Use a tela de grupos para a fase de grupos', 400)
      if (isMatchLocked(match)) return error('Palpites travados para esta partida', 403)

      const { data: prediction, error: predError } = await supabase
        .from('match_predictions')
        .upsert(
          {
            member_id: auth.memberId,
            match_id: matchId,
            home_score: homeScore,
            away_score: awayScore,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'member_id,match_id' },
        )
        .select('*')
        .single()

      if (predError) return error(predError.message, 500)
      return json({ prediction })
    }

    if (action === 'pool-picks') {
      const data = await fetchPoolMemberPicks(supabase, auth.poolId)
      return json(data)
    }

    if (action === 'ranking') {
      const { data: rankings, error: rankError } = await supabase
        .from('pool_rankings')
        .select('*')
        .eq('pool_id', auth.poolId)
        .order('total_points', { ascending: false })
        .order('exact_score_count', { ascending: false })
        .order('top_scorer_correct', { ascending: false })

      if (rankError) return error(rankError.message, 500)
      return json({ rankings: rankings ?? [] })
    }

    return error('Ação inválida', 400)
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Erro interno', 500)
  }
})
