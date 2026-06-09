import { handleCors, json, error } from '../_shared/cors.ts'
import { hashPassword, signToken, generateInviteToken } from '../_shared/crypto.ts'
import { getAuthSecret, getServiceClient } from '../_shared/supabase.ts'
import { getMember } from '../_shared/auth.ts'

function validateUsername(username: string): string | null {
  if (!username || username.length < 3 || username.length > 20) {
    return 'Username deve ter entre 3 e 20 caracteres'
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username só pode conter letras, números e _'
  }
  return null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = req.method === 'GET' ? {} : await req.json()
    const action = body.action ?? (req.method === 'GET' ? 'get' : null)
    const supabase = getServiceClient()
    const secret = getAuthSecret()

    if (action === 'create') {
      const { name, poolPassword, memberPassword, password, username, topScorerPick } = body
      const resolvedPoolPassword = poolPassword ?? password
      if (!name?.trim()) return error('Nome do bolão é obrigatório')
      if (!resolvedPoolPassword || resolvedPoolPassword.length < 4) return error('Senha do bolão deve ter pelo menos 4 caracteres')
      if (!memberPassword || memberPassword.length < 6) return error('Senha pessoal deve ter pelo menos 6 caracteres')
      const usernameErr = validateUsername(username)
      if (usernameErr) return error(usernameErr)
      if (!topScorerPick?.trim()) return error('Artilheiro é obrigatório')

      const inviteToken = generateInviteToken()
      const passwordHash = await hashPassword(resolvedPoolPassword)
      const memberPasswordHash = await hashPassword(memberPassword)

      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .insert({
          name: name.trim(),
          invite_token: inviteToken,
          pool_password_hash: passwordHash,
        })
        .select('id, name, invite_token, created_at')
        .single()

      if (poolError) return error(poolError.message, 500)

      const { data: member, error: memberError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          username: username.toLowerCase(),
          member_password_hash: memberPasswordHash,
          role: 'admin',
          top_scorer_pick: topScorerPick.trim(),
        })
        .select('id, pool_id, username, role, top_scorer_pick, joined_at')
        .single()

      if (memberError) return error(memberError.message, 500)

      const token = await signToken({
        type: 'member',
        memberId: member.id,
        poolId: member.pool_id,
        username: member.username,
        role: member.role,
      }, secret)

      return json({ pool, member, token })
    }

    if (action === 'get') {
      const inviteToken = body.inviteToken ?? new URL(req.url).searchParams.get('token')
      if (!inviteToken) return error('Token de convite é obrigatório')

      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select('id, name, invite_token, created_at')
        .eq('invite_token', inviteToken)
        .single()

      if (poolError || !pool) return error('Bolão não encontrado', 404)

      const { count } = await supabase
        .from('pool_members')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', pool.id)

      return json({ pool: { ...pool, memberCount: count ?? 0 } })
    }

    if (action === 'detail') {
      const auth = await getMember(req)
      if (!auth) return error('Não autenticado', 401)

      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select('id, name, invite_token, created_at')
        .eq('id', auth.poolId)
        .single()

      if (poolError || !pool) return error('Bolão não encontrado', 404)

      const [{ data: member }, { data: rankings }] = await Promise.all([
        supabase
          .from('pool_members')
          .select('id, username, role, top_scorer_pick, joined_at')
          .eq('id', auth.memberId)
          .single(),
        supabase
          .from('pool_rankings')
          .select('*')
          .eq('pool_id', auth.poolId)
          .order('total_points', { ascending: false })
          .order('exact_score_count', { ascending: false }),
      ])

      return json({ pool, member, rankings: rankings ?? [] })
    }

    return error('Ação inválida', 400)
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Erro interno', 500)
  }
})
