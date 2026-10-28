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
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('role, company_id')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return defaultAdmin

    return {
      isAdmin: true,
      isSuperAdmin: data.role === 'super_admin',
      role: data.role,
      companyId: data.company_id,
    }
  } catch (err) {
    console.error('Error fetching admin profile:', err)
    return defaultAdmin
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState<AdminProfile>(defaultAdmin)

  const refreshAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAdmin(defaultAdmin)
        return
      }
      setAdmin(await fetchAdminProfile(user.id))
    } catch (err) {
      console.error('Error refreshing admin profile:', err)
      setAdmin(defaultAdmin)
    }
  }

  useEffect(() => {
    let mounted = true

    // Safety timeout: Never let the app hang on "Loading EazyHub..." for more than 2.5 seconds
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 2500)

    async function initSession() {
      try {
        const { data: { session: initial } } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(initial)
        if (initial?.user) {
          const profile = await fetchAdminProfile(initial.user.id)
          if (!mounted) return
          setAdmin(profile)
        }
      } catch (err) {
        console.error('Error initializing session:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!mounted) return
      setSession(next)
      if (next?.user) {
        try {
          const profile = await fetchAdminProfile(next.user.id)
          if (mounted) setAdmin(profile)
        } catch (err) {
          console.error('Error in onAuthStateChange:', err)
        }
      } else {
        setAdmin(defaultAdmin)
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
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
