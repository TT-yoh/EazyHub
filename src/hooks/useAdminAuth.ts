import { useSession } from '../context/SessionContext'

/** @deprecated Prefer useSession().admin — kept for existing admin pages. */
export function useAdminAuth() {
  const { admin, loading } = useSession()
  return {
    isAdmin: admin.isAdmin,
    isSuperAdmin: admin.isSuperAdmin,
    role: admin.role,
    companyId: admin.companyId,
    checking: loading,
  }
}
