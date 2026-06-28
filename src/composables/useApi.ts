const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string

type FnName = 'auth' | 'pools' | 'bets' | 'admin' | 'superadmin'

interface ApiOptions {
  method?: string
  body?: Record<string, unknown>
  token?: string | null
  superadminToken?: string | null
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function callFunction(fn: FnName, options: ApiOptions = {}) {
  const { method = 'POST', body, token, superadminToken } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (superadminToken) headers['X-Superadmin-Token'] = superadminToken

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  })

  const data = await res.json()
  if (!res.ok) throw new ApiError(data.error ?? 'Erro na requisição', res.status)
  return data
}

export function useApi() {
  return {
    auth: {
      register: (payload: Record<string, unknown>) => callFunction('auth', { body: { action: 'register', ...payload } }),
      login: (payload: Record<string, unknown>) => callFunction('auth', { body: { action: 'login', ...payload } }),
      me: (token: string) => callFunction('auth', { body: { action: 'me' }, token }),
    },
    pools: {
      create: (payload: Record<string, unknown>) => callFunction('pools', { body: { action: 'create', ...payload } }),
      get: (inviteToken: string) => callFunction('pools', { body: { action: 'get', inviteToken } }),
      detail: (token: string) => callFunction('pools', { body: { action: 'detail' }, token }),
    },
    bets: {
      groupStage: (token: string) => callFunction('bets', { body: { action: 'group-stage' }, token }),
      saveGroupStage: (token: string, payload: Record<string, unknown>) =>
        callFunction('bets', { body: { action: 'save-group-stage', ...payload }, token }),
      matches: (token: string, stage = 'knockout') =>
        callFunction('bets', { body: { action: 'matches', stage }, token }),
      saveMatch: (token: string, payload: Record<string, unknown>) =>
        callFunction('bets', { body: { action: 'save-match', ...payload }, token }),
      ranking: (token: string) => callFunction('bets', { body: { action: 'ranking' }, token }),
      poolPicks: (token: string) => callFunction('bets', { body: { action: 'pool-picks' }, token }),
    },
    admin: {
      members: (token: string) => callFunction('admin', { body: { action: 'members' }, token }),
      memberPicks: (token: string) => callFunction('admin', { body: { action: 'member-picks' }, token }),
      removeMember: (token: string, memberId: string) =>
        callFunction('admin', { body: { action: 'remove-member', memberId }, token }),
      resetMemberPassword: (token: string, memberId: string, newPassword: string) =>
        callFunction('admin', { body: { action: 'reset-member-password', memberId, newPassword }, token }),
    },
    superadmin: {
      login: (password: string) => callFunction('superadmin', { body: { action: 'login', password } }),
      matches: (token: string) => callFunction('superadmin', { body: { action: 'matches' }, superadminToken: token }),
      teams: (token: string) => callFunction('superadmin', { body: { action: 'teams' }, superadminToken: token }),
      groupResults: (token: string) => callFunction('superadmin', { body: { action: 'group-results' }, superadminToken: token }),
      createMatch: (token: string, payload: Record<string, unknown>) =>
        callFunction('superadmin', { body: { action: 'create-match', ...payload }, superadminToken: token }),
      updateMatch: (token: string, payload: Record<string, unknown>) =>
        callFunction('superadmin', { body: { action: 'update-match', ...payload }, superadminToken: token }),
      deleteMatch: (token: string, matchId: string) =>
        callFunction('superadmin', { body: { action: 'delete-match', matchId }, superadminToken: token }),
      matchResult: (token: string, payload: Record<string, unknown>) =>
        callFunction('superadmin', { body: { action: 'match-result', ...payload }, superadminToken: token }),
      confirmGroup: (token: string, payload: Record<string, unknown>) =>
        callFunction('superadmin', { body: { action: 'confirm-group', ...payload }, superadminToken: token }),
      setTopScorer: (token: string, player: string) =>
        callFunction('superadmin', { body: { action: 'set-top-scorer', player }, superadminToken: token }),
      recalculate: (token: string) =>
        callFunction('superadmin', { body: { action: 'recalculate' }, superadminToken: token }),
    },
  }
}
