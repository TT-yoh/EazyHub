import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export async function requireUser(supabase: SupabaseClient): Promise<User> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Error('Unauthorized')
  }
  return data.user
}

export async function requireSuperAdmin(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from('admin_users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data || data.role !== 'super_admin') {
    throw new Error('Forbidden: super admin required')
  }
}

export async function requireAnyAdmin(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from('admin_users')
    .select('role, company_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    throw new Error('Forbidden: admin required')
  }
  return data
}
