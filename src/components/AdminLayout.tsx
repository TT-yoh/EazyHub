import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminLayout() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [companyName, setCompanyName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      navigate('/login')
      return
    }

    const { data: adminData, error } = await supabase
      .from('admin_users')
      .select('role, company_id')
      .eq('id', user.id)
      .maybeSingle()

    if (error || !adminData) {
      navigate('/')
      return
    }

    setIsAdmin(true)
    
    if (adminData.company_id === 1) {
      setCompanyName('Mineazy')
    } else if (adminData.company_id === 2) {
      setCompanyName('Farmeazy')
    } else {
      setCompanyName('Super Admin')
    }
    
    setLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-800 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-gray-600 font-medium">Validating Credentials...</div>
        </div>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-800 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{companyName} Dashboard</h1>
          </div>
          <div className="flex gap-4 items-center font-medium text-sm flex-wrap">
            <Link to="/admin/orders" className="hover:text-blue-200 transition-colors">📦 Orders</Link>
            <Link to="/admin/products" className="hover:text-blue-200 transition-colors">📋 Products</Link>
            <Link to="/admin/upload" className="hover:text-blue-200 transition-colors">📤 Upload CSV</Link>
            <Link to="/" className="hover:text-blue-200 transition-colors">🛍️ View Store</Link>
            <Link to="/admin/users" className="hover:text-blue-200 transition-colors">👥 Users</Link>
            <button onClick={logout} className="bg-blue-900/50 hover:bg-blue-900 px-3 py-1.5 rounded-md transition-colors text-xs font-semibold">
              🚪 Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}