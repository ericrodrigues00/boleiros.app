import { handleCors, json, error } from '../_shared/cors.ts'
import { signToken } from '../_shared/crypto.ts'
import {
  calculateMatchPoints,
  calculateGroupBetPoints,
  BEST_THIRD_POINTS,
} from '../_shared/scoring.ts'
import { getAuthSecret, getServiceClient, getSuperadminPassword } from '../_shared/supabase.ts'
import { verifySuperadmin } from '../_shared/auth.ts'

async function recalculateMatchScores(supabase: ReturnType<typeof getServiceClient>, matchId: string) {
  const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single()
  if (!match || match.home_score == null || match.away_score == null) return

  const { data: predictions } = await supabase
    .from('match_predictions')
    .select('id, home_score, away_score')
    .eq('match_id', matchId)

  for (const pred of predictions ?? []) {
    const points = calculateMatchPoints(
      pred.home_score,
      pred.away_score,
      match.home_score,
      match.away_score,
    )
    await supabase.from('match_predictions').update({ points_earned: points }).eq('id', pred.id)
  }
}

async function recalculateGroupScores(supabase: ReturnType<typeof getServiceClient>, groupId: string) {
  const { data: result } = await supabase
    .from('group_results')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle()

  if (!result?.first_team_id || !result?.second_team_id) return

  const { data: groupBets } = await supabase
    .from('group_bets')
    .select('id, predicted_first, predicted_second')
    .eq('group_id', groupId)

  for (const bet of groupBets ?? []) {
    const points = calculateGroupBetPoints(
      bet.predicted_first,
      bet.predicted_second,
      result.first_team_id,
      result.second_team_id,
    )
    await supabase.from('group_bets').update({ points_earned: points }).eq('id', bet.id)
  }

}

async function recalculateAllBestThirds(supabase: ReturnType<typeof getServiceClient>) {
  const { data: advancing } = await supabase
    .from('group_results')
    .select('third_team_id')
    .eq('advancing_as_third', true)
    .not('third_team_id', 'is', null)

  const advancingThirds = new Set((advancing ?? []).map((r) => r.third_team_id))
  if (advancingThirds.size === 0) return

  const { data: allThirdBets } = await supabase.from('best_third_bets').select('id, team_id')

  for (const bet of allThirdBets ?? []) {
    const points = advancingThirds.has(bet.team_id) ? BEST_THIRD_POINTS : 0
    await supabase.from('best_third_bets').update({ points_earned: points }).eq('id', bet.id)
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = req.method === 'GET' ? {} : await req.json()
    const action = body.action ?? (req.method === 'GET' ? 'matches' : null)
    const supabase = getServiceClient()
    const secret = getAuthSecret()

    if (action === 'login') {
      const { password } = body
      if (password !== getSuperadminPassword()) return error('Senha inválida', 401)
      const token = await signToken({ type: 'superadmin', sub: 'superadmin' }, secret, 60 * 60 * 8)
      return json({ token })
    }

    if (!(await verifySuperadmin(req))) return error('Não autorizado', 401)

    if (action === 'matches') {
      const [{ data: matches, error: dbError }, { data: teams }, { data: groups }] = await Promise.all([
        supabase.from('matches').select('*').order('kickoff_at'),
        supabase.from('teams').select('id, name, flag_code'),
        supabase.from('wc_groups').select('id, name'),
      ])

      if (dbError) return error(dbError.message, 500)

      const teamMap = new Map((teams ?? []).map((t) => [t.id, t]))
      const groupMap = new Map((groups ?? []).map((g) => [g.id, g]))

      const enriched = (matches ?? []).map((match) => ({
        ...match,
        home_team: match.home_team_id ? teamMap.get(match.home_team_id) ?? null : null,
        away_team: match.away_team_id ? teamMap.get(match.away_team_id) ?? null : null,
        wc_group: match.group_id ? groupMap.get(match.group_id) ?? null : null,
      }))

      return json({ matches: enriched })
    }

    if (action === 'teams') {
      const [{ data: groups }, { data: teams }] = await Promise.all([
        supabase.from('wc_groups').select('*').order('sort_order'),
        supabase.from('teams').select('*').order('name'),
      ])
      return json({ groups: groups ?? [], teams: teams ?? [] })
    }

    if (action === 'group-results') {
      const { data: results } = await supabase
        .from('group_results')
        .select(`
          *,
          first_team:teams!group_results_first_team_id_fkey(id, name),
          second_team:teams!group_results_second_team_id_fkey(id, name),
          third_team:teams!group_results_third_team_id_fkey(id, name)
        `)

      return json({ results: results ?? [] })
    }

    if (action === 'create-match') {
      const { homeTeamId, awayTeamId, homeLabel, awayLabel, stage, groupId, kickoffAt } = body
      if (!stage || !kickoffAt) return error('Fase e horário são obrigatórios')
      if (!homeTeamId && !homeLabel) return error('Time da casa é obrigatório')
      if (!awayTeamId && !awayLabel) return error('Time visitante é obrigatório')

      const { data: match, error: dbError } = await supabase
        .from('matches')
        .insert({
          home_team_id: homeTeamId ?? null,
          away_team_id: awayTeamId ?? null,
          home_label: homeLabel?.trim() ?? null,
          away_label: awayLabel?.trim() ?? null,
          stage,
          group_id: groupId ?? null,
          kickoff_at: kickoffAt,
        })
        .select('*')
        .single()

      if (dbError) return error(dbError.message, 500)
      return json({ match })
    }

    if (action === 'update-match') {
      const { matchId, kickoffAt, status, lockedOverride, unlockedOverride, homeTeamId, awayTeamId, homeLabel, awayLabel } = body
      if (!matchId) return error('matchId é obrigatório')

      const updates: Record<string, unknown> = {}
      if (kickoffAt != null) updates.kickoff_at = kickoffAt
      if (status != null) updates.status = status
      if (lockedOverride != null) updates.locked_override = lockedOverride
      if (unlockedOverride != null) updates.unlocked_override = unlockedOverride
      if (homeTeamId !== undefined) updates.home_team_id = homeTeamId
      if (awayTeamId !== undefined) updates.away_team_id = awayTeamId
      if (homeLabel !== undefined) updates.home_label = homeLabel
      if (awayLabel !== undefined) updates.away_label = awayLabel

      const { data: match, error: dbError } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', matchId)
        .select('*')
        .single()

      if (dbError) return error(dbError.message, 500)
      return json({ match })
    }

    if (action === 'delete-match') {
      const { matchId } = body
      if (!matchId) return error('matchId é obrigatório')

      const { data: match, error: fetchError } = await supabase
        .from('matches')
        .select('stage')
        .eq('id', matchId)
        .single()

      if (fetchError || !match) return error('Partida não encontrada', 404)
      if (match.stage === 'group') return error('Não é possível excluir partidas da fase de grupos', 400)

      const { error: dbError } = await supabase.from('matches').delete().eq('id', matchId)
      if (dbError) return error(dbError.message, 500)
      return json({ ok: true })
    }

    if (action === 'match-result') {
      const { matchId, homeScore, awayScore, status } = body
      if (!matchId || homeScore == null || awayScore == null) {
        return error('matchId e placar são obrigatórios')
      }

      const { data: match, error: dbError } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: status ?? 'finished',
        })
        .eq('id', matchId)
        .select('*')
        .single()

      if (dbError) return error(dbError.message, 500)

      await recalculateMatchScores(supabase, matchId)
      return json({ match })
    }

    if (action === 'confirm-group') {
      const { groupId, firstTeamId, secondTeamId, thirdTeamId, advancingAsThird } = body
      if (!groupId || !firstTeamId || !secondTeamId || !thirdTeamId) {
        return error('Grupo e as três posições são obrigatórios')
      }

      const { error: upsertError } = await supabase
        .from('group_results')
        .upsert({
          group_id: groupId,
          first_team_id: firstTeamId,
          second_team_id: secondTeamId,
          third_team_id: thirdTeamId,
          advancing_as_third: advancingAsThird ?? false,
          confirmed_at: new Date().toISOString(),
        })

      if (upsertError) return error(upsertError.message, 500)

      await recalculateGroupScores(supabase, groupId)
      await recalculateAllBestThirds(supabase)

      return json({ ok: true })
    }

    if (action === 'set-top-scorer') {
      const { player } = body
      if (!player?.trim()) return error('Nome do artilheiro é obrigatório')

      const { error: upsertError } = await supabase
        .from('tournament_settings')
        .upsert({
          key: 'top_scorer',
          value: { player: player.trim() },
          updated_at: new Date().toISOString(),
        })

      if (upsertError) return error(upsertError.message, 500)
      return json({ ok: true })
    }

    if (action === 'recalculate') {
      const { data: finishedMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'finished')
        .not('home_score', 'is', null)

      for (const m of finishedMatches ?? []) {
        await recalculateMatchScores(supabase, m.id)
      }

      const { data: groups } = await supabase.from('group_results').select('group_id')
      for (const g of groups ?? []) {
        await recalculateGroupScores(supabase, g.group_id)
      }
      await recalculateAllBestThirds(supabase)

      return json({ ok: true })
    }

    return error('Ação inválida', 400)
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Erro interno', 500)
  }
})
