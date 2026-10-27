import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { createAdminClient, createUserClient } from '../_shared/supabaseAdmin.ts'
import { requireSuperAdmin, requireUser } from '../_shared/auth.ts'

type Action =
  | { action: 'grant_admin'; userId: string; email?: string; role: string; companyId?: number | null }
  | { action: 'revoke_admin'; userId: string }
  | { action: 'create_company'; name: string; short_name: string; icon?: string }
  | { action: 'update_customer'; userId: string; name?: string; phone?: string; location?: string }

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const authHeader = req.headers.get('Authorization')
    const userClient = createUserClient(authHeader)
    const user = await requireUser(userClient)
    const admin = createAdminClient()
    await requireSuperAdmin(admin, user.id)

    const payload = (await req.json()) as Action

    switch (payload.action) {
      case 'grant_admin': {
        const { error } = await admin.from('admin_users').upsert({
          id: payload.userId,
          email: payload.email ?? null,
          role: payload.role,
          company_id: payload.companyId ?? null,
        })
        if (error) throw error
        return jsonResponse({ success: true })
      }
      case 'revoke_admin': {
        const { error } = await admin.from('admin_users').delete().eq('id', payload.userId)
        if (error) throw error
        return jsonResponse({ success: true })
      }
      case 'create_company': {
        const { error } = await admin.from('companies').insert({
          name: payload.name,
          short_name: payload.short_name,
          icon: payload.icon ?? '',
        })
        if (error) throw error
        return jsonResponse({ success: true })
      }
      case 'update_customer': {
        const { error } = await admin.from('customers').update({
          name: payload.name,
          phone: payload.phone,
          location: payload.location,
          updated_at: new Date().toISOString(),
        }).eq('id', payload.userId)
        if (error) throw error
        return jsonResponse({ success: true })
      }
      default:
        return jsonResponse({ success: false, error: 'Unknown action' }, 400)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin action failed'
    const status =
      message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 400
    return jsonResponse({ success: false, error: message }, status)
  }
})
