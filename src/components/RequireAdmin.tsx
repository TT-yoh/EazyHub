import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function RequireAdmin() {
  const { session, admin, loading } = useSession()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !admin.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
