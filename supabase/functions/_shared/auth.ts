import { verifyToken } from './crypto.ts'
import { getAuthSecret } from './supabase.ts'

export interface MemberAuth {
  memberId: string
  poolId: string
  username: string
  role: 'admin' | 'member'
}

export async function getMember(req: Request): Promise<MemberAuth | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const payload = await verifyToken(authHeader.slice(7), getAuthSecret())
  if (!payload?.memberId || payload.type !== 'member') return null
  return {
    memberId: payload.memberId as string,
    poolId: payload.poolId as string,
    username: payload.username as string,
    role: payload.role as 'admin' | 'member',
  }
}

export async function verifySuperadmin(req: Request): Promise<boolean> {
  const token = req.headers.get('X-Superadmin-Token')
  if (!token) return false
  const payload = await verifyToken(token, getAuthSecret())
  return payload?.type === 'superadmin'
}
