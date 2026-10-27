import { supabase } from './supabase'

export async function invokeAdminAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-action', { body })
  if (error) throw error
  if (data && data.success === false) {
    throw new Error(data.error || 'Admin action failed')
  }
  return data
}
