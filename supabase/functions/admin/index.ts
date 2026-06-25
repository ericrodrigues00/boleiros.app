import { handleCors, json, error } from '../_shared/cors.ts'
import { hashPassword } from '../_shared/crypto.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { getMember } from '../_shared/auth.ts'
import { fetchPoolMemberPicks } from '../_shared/poolPicks.ts'

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
      const data = await fetchPoolMemberPicks(supabase, auth.poolId)
      return json(data)
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

    if (action === 'reset-member-password') {
      const { memberId, newPassword } = body
      if (!memberId) return error('memberId é obrigatório')
      if (!newPassword || newPassword.length < 6) {
        return error('Nova senha deve ter pelo menos 6 caracteres')
      }

      const { data: target } = await supabase
        .from('pool_members')
        .select('id, username')
        .eq('id', memberId)
        .eq('pool_id', auth.poolId)
        .maybeSingle()

      if (!target) return error('Membro não encontrado', 404)

      const memberPasswordHash = await hashPassword(newPassword)
      const { error: updateError } = await supabase
        .from('pool_members')
        .update({ member_password_hash: memberPasswordHash })
        .eq('id', memberId)

      if (updateError) return error(updateError.message, 500)
      return json({ ok: true, username: target.username })
    }

    return error('Ação inválida', 400)
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Erro interno', 500)
  }
})
