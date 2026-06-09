import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}

export function getAuthSecret(): string {
  const secret = Deno.env.get('AUTH_SECRET')
  if (!secret) throw new Error('AUTH_SECRET not configured')
  return secret
}

export function getSuperadminPassword(): string {
  const pwd = Deno.env.get('SUPERADMIN_PASSWORD')
  if (!pwd) throw new Error('SUPERADMIN_PASSWORD not configured')
  return pwd
}
