import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface AdminData {
  isAdmin: boolean
  isSuperAdmin: boolean // 🌟 New flag for master access privileges
  role: string | null
  companyId: number | null 
  checking: boolean
}

export function useAdminAuth() {
  const [authData, setAuthData] = useState<AdminData>({
    isAdmin: false,
    isSuperAdmin: false,
    role: null,
    companyId: null,
    checking: true,
  })

  useEffect(() => {
    async function verifyAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAuthData({ isAdmin: false, isSuperAdmin: false, role: null, companyId: null, checking: false })
        return
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('role', 'company_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!error && data) {
        setAuthData({
          isAdmin: true,
          isSuperAdmin: data.role === 'super_admin', // 🌟 Evaluates to true if user is global boss
          role: data.role,
          companyId: data.company_id, 
          checking: false,
        })
      } else {
        setAuthData({ isAdmin: false, isSuperAdmin: false, role: null, companyId: null, checking: false })
      }
    }
    verifyAdmin()
  }, [])

  return authData
}