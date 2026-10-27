import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AdminProfile {
  isAdmin: boolean
  isSuperAdmin: boolean
  role: string | null
  companyId: number | null
}

interface SessionContextValue {
  session: Session | null
  loading: boolean
  admin: AdminProfile
  refreshAdmin: () => Promise<void>
  setAdminLive: (patch: Partial<AdminProfile>) => void
}

const defaultAdmin: AdminProfile = {
  isAdmin: false,
  isSuperAdmin: false,
  role: null,
  companyId: null,
}

const SessionContext = createContext<SessionContextValue | null>(null)

async function fetchAdminProfile(userId: string): Promise<AdminProfile> {
  const { data } = await supabase
    .from('admin_users')
    .select('role, company_id')
    .eq('id', userId)
    .maybeSingle()

  if (!data) return defaultAdmin

  return {
    isAdmin: true,
    isSuperAdmin: data.role === 'super_admin',
    role: data.role,
    companyId: data.company_id,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState<AdminProfile>(defaultAdmin)

  const refreshAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAdmin(defaultAdmin)
      return
    }
    setAdmin(await fetchAdminProfile(user.id))
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: initial } }) => {
      setSession(initial)
      if (initial?.user) {
        setAdmin(await fetchAdminProfile(initial.user.id))
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      if (next?.user) {
        setAdmin(await fetchAdminProfile(next.user.id))
      } else {
        setAdmin(defaultAdmin)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const setAdminLive = (patch: Partial<AdminProfile>) => {
    setAdmin((prev) => ({ ...prev, ...patch }))
  }

  return (
    <SessionContext.Provider value={{ session, loading, admin, refreshAdmin, setAdminLive }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
