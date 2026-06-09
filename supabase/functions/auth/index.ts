import { handleCors, json, error } from '../_shared/cors.ts'
import { hashPassword, verifyPassword, signToken } from '../_shared/crypto.ts'
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
    const action = req.method === 'GET' ? 'me' : body.action
    const supabase = getServiceClient()
    const secret = getAuthSecret()

    if (action === 'register') {
      const { inviteToken, username, poolPassword, memberPassword, topScorerPick } = body
      if (!inviteToken || !username || !poolPassword || !memberPassword || !topScorerPick?.trim()) {
        return error('Token, username, senha do bolão, senha pessoal e artilheiro são obrigatórios')
      }
      const usernameErr = validateUsername(username)
      if (usernameErr) return error(usernameErr)
      if (poolPassword.length < 4) return error('Senha do bolão deve ter pelo menos 4 caracteres')
      if (memberPassword.length < 6) return error('Senha pessoal deve ter pelo menos 6 caracteres')

      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select('id, pool_password_hash')
        .eq('invite_token', inviteToken)
        .single()

      if (poolError || !pool) return error('Bolão não encontrado', 404)

      const valid = await verifyPassword(poolPassword, pool.pool_password_hash)
      if (!valid) return error('Senha do bolão incorreta', 401)

      const memberPasswordHash = await hashPassword(memberPassword)
      const { data: member, error: memberError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          username: username.toLowerCase(),
          member_password_hash: memberPasswordHash,
          role: 'member',
          top_scorer_pick: topScorerPick.trim(),
        })
        .select('id, pool_id, username, role, top_scorer_pick, joined_at')
        .single()

      if (memberError) {
        if (memberError.code === '23505') return error('Username já existe neste bolão', 409)
        return error(memberError.message, 500)
      }

      const token = await signToken({
        type: 'member',
        memberId: member.id,
        poolId: member.pool_id,
        username: member.username,
        role: member.role,
      }, secret)

      return json({ member, token })
    }

    if (action === 'login') {
      const { inviteToken, username, memberPassword } = body
      if (!inviteToken || !username || !memberPassword) {
        return error('Token, username e senha pessoal são obrigatórios')
      }

      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select('id')
        .eq('invite_token', inviteToken)
        .single()

      if (poolError || !pool) return error('Bolão não encontrado', 404)

      const { data: member, error: memberError } = await supabase
        .from('pool_members')
        .select('id, pool_id, username, role, top_scorer_pick, member_password_hash, joined_at')
        .eq('pool_id', pool.id)
        .eq('username', username.toLowerCase())
        .single()

      if (memberError || !member) return error('Usuário não encontrado neste bolão', 401)
      if (!member.member_password_hash) {
        return error('Esta conta ainda não tem senha pessoal. Crie uma nova conta ou peça ao admin para remover seu usuário antigo.', 401)
      }

      const valid = await verifyPassword(memberPassword, member.member_password_hash)
      if (!valid) return error('Senha pessoal incorreta', 401)

      const token = await signToken({
        type: 'member',
        memberId: member.id,
        poolId: member.pool_id,
        username: member.username,
        role: member.role,
      }, secret)

      return json({ member, token })
    }

    if (action === 'me') {
      const auth = await getMember(req)
      if (!auth) return error('Não autenticado', 401)

      const { data: member, error: memberError } = await supabase
        .from('pool_members')
        .select('id, pool_id, username, role, top_scorer_pick, joined_at')
        .eq('id', auth.memberId)
        .single()

      if (memberError || !member) return error('Membro não encontrado', 404)
      return json({ member })
    }

    return error('Ação inválida', 400)
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Erro interno', 500)
  }
})
