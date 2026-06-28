import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

interface User {
  id: string; email: string; phone: string; name: string; location: string; created_at: string; is_admin: boolean; role: string;
}

interface ModalSettings {
  isOpen: boolean; title: string; message: string; confirmButtonText: string; onConfirm: () => void;
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
  
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingTable, setClearingTable] = useState<string | null>(null)

  const [modal, setModal] = useState<ModalSettings>({
    isOpen: false, title: '', message: '', confirmButtonText: '', onConfirm: () => {},
  })

  useEffect(() => { 
    verifyAndFetchUsers() 
  }, [])

  // ⚡ BLAZING FAST PARALLEL FETCH ENGINE
  const verifyAndFetchUsers = async () => {
    setLoading(true)
    try {
      // 1. Get User ID (Must happen first)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/login')

      // 2. Fire Admin Check, Customers List, and Roles List SIMULTANEOUSLY
      const [adminRes, customersRes, rolesRes] = await Promise.all([
        supabase.from('admin_users').select('company_id').eq('id', user.id).maybeSingle(),
        supabase.from('customers').select('id, email, phone, name, location, created_at').order('created_at', { ascending: false }),
        supabase.from('admin_users').select('id, role')
      ])

      if (!adminRes.data) {
        toast.error('Access Denied: Administrative privileges required.')
        return navigate('/admin/orders')
      }

      setCurrentCompanyId(adminRes.data.company_id)
      setIsAuthorized(true)

      const adminIds = new Set(rolesRes.data?.map(a => a.id) || [])
      const adminRoles: Record<string, string> = {}
      rolesRes.data?.forEach(a => { adminRoles[a.id] = a.role })

      const usersWithAdmin = (customersRes.data || []).map((customer: any) => ({
        id: customer.id,
        email: customer.email || '',
        phone: customer.phone || '',
        name: customer.name || '',
        location: customer.location || '',
        created_at: customer.created_at,
        is_admin: adminIds.has(customer.id),
        role: adminRoles[customer.id] || 'customer'
      }))

      setUsers(usersWithAdmin)
    } catch (error) {
      console.error("Fast Fetch Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateUser = async (user: User) => {
    await supabase.from('customers').update({ name: user.name, phone: user.phone, location: user.location, updated_at: new Date().toISOString() }).eq('id', user.id)

    if (user.is_admin) {
      const { data: existing } = await supabase.from('admin_users').select('id').eq('id', user.id).maybeSingle()
      const companyId = user.role === 'mineazy_admin' ? 1 : user.role === 'farmeazy_admin' ? 2 : user.role === 'super_admin' ? 3 : null
      if (!existing) await supabase.from('admin_users').insert({ id: user.id, role: user.role, company_id: companyId })
      else await supabase.from('admin_users').update({ role: user.role, company_id: companyId }).eq('id', user.id)
    } else {
      await supabase.from('admin_users').delete().eq('id', user.id)
    }

    toast.success('User clearance modified successfully.')
    setEditingUser(null)
    verifyAndFetchUsers() 
  }

  const executeUserAccountDelete = async (targetUser: User) => {
    setDeletingId(targetUser.id)
    try {
      if (targetUser.is_admin) await supabase.from('admin_users').delete().eq('id', targetUser.id)
      const { error } = await supabase.from('customers').delete().eq('id', targetUser.id)
      if (error) throw error
      toast.success('User identity successfully removed.')
      setUsers(prev => prev.filter(u => u.id !== targetUser.id))
    } catch (err: any) {
      toast.error(`Purge Failed: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteUserAccount = (targetUser: User) => {
    setModal({
      isOpen: true, title: 'Delete User Account', message: `Are you completely sure you want to permanently erase the user account record for "${targetUser.name || targetUser.email}"?`, confirmButtonText: '🗑️ Delete User', onConfirm: () => executeUserAccountDelete(targetUser)
    })
  }

  const executeTableClear = async (table: 'order_items' | 'payments' | 'orders' | 'customers') => {
    setClearingTable(table)
    const runToast = toast.loading(`Emptying table: public.${table}...`)
    try {
      if (table === 'order_items' || table === 'payments') {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error) throw error
      } else if (table === 'orders') {
        const { error } = await supabase.from('orders').delete().neq('status', 'completely_impossible_status_string')
        if (error) throw error
      } else if (table === 'customers') {
        const { data: { user: currentAdmin } } = await supabase.auth.getUser()
        if (!currentAdmin) throw new Error("Session timed out.")
        await supabase.from('admin_users').delete().neq('id', currentAdmin.id)
        const { error } = await supabase.from('customers').delete().neq('id', currentAdmin.id)
        if (error) throw error
      }
      toast.success(`Table public.${table} successfully cleared!`, { id: runToast })
      verifyAndFetchUsers()
    } catch (err: any) {
      toast.error(`Database Rejected Wipe: ${err.message}`, { id: runToast })
    } finally {
      setClearingTable(null)
    }
  }

  const handleClearSpecificTable = (table: 'order_items' | 'payments' | 'orders' | 'customers') => {
    let warningMessage = ''
    if (table === 'order_items') warningMessage = "Wipe all individual line-items inside 'order_items'?"
    if (table === 'payments') warningMessage = "Wipe all records inside 'payments'?"
    if (table === 'orders') warningMessage = "Wipe all rows inside 'orders'?"
    if (table === 'customers') warningMessage = "Wipe all customer profile datasets except your active Super Admin session?"
    setModal({ isOpen: true, title: 'Database Security Confirmation', message: warningMessage, confirmButtonText: '💥 Confirm Purge', onConfirm: () => executeTableClear(table) })
  }

  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="text-center py-12 text-gray-500 font-medium">Verifying security clearance...</div>
  if (!isAuthorized) return null

  const isSuperAdmin = currentCompanyId === 3

  return (
    <div className="pb-16 w-full max-w-6xl mx-auto px-4 pt-6 relative">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{isSuperAdmin ? 'Identity & System Maintenance' : 'Customer Contact Directory'}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{isSuperAdmin ? 'Manage clearance records and handle isolated database testing routines.' : 'Search and view registered customer fulfillment addresses and phone numbers.'}</p>
      </div>

      {isSuperAdmin && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3.5">🎯 Isolated Database Table Maintenance Tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button type="button" onClick={() => handleClearSpecificTable('order_items')} disabled={clearingTable !== null || modal.isOpen} className="p-3 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 border border-gray-200/60 hover:border-red-200 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 shadow-xs">
              <span className="text-sm">📦</span> {clearingTable === 'order_items' ? 'Clearing...' : 'Clear Order Items'}
            </button>
            <button type="button" onClick={() => handleClearSpecificTable('payments')} disabled={clearingTable !== null || modal.isOpen} className="p-3 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 border border-gray-200/60 hover:border-red-200 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 shadow-xs">
              <span className="text-sm">💳</span> {clearingTable === 'payments' ? 'Clearing...' : 'Clear Paynow Logs'}
            </button>
            <button type="button" onClick={() => handleClearSpecificTable('orders')} disabled={clearingTable !== null || modal.isOpen} className="p-3 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 border border-gray-200/60 hover:border-red-200 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 shadow-xs">
              <span className="text-sm">📝</span> {clearingTable === 'orders' ? 'Clearing...' : 'Clear Orders Table'}
            </button>
            <button type="button" onClick={() => handleClearSpecificTable('customers')} disabled={clearingTable !== null || modal.isOpen} className="p-3 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 border border-gray-200/60 hover:border-red-200 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 shadow-xs">
              <span className="text-sm">👥</span> {clearingTable === 'customers' ? 'Clearing...' : 'Clear Customers'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center px-1">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">User Registration Accounts</span>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg font-mono">{filteredUsers.length} Match</span>
      </div>
      <div className="mb-6">
        <input type="text" placeholder="🔍 Search users by profile name, registration email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-sm" />
      </div>

      <div className="bg-transparent sm:bg-white sm:rounded-xl sm:border sm:border-gray-100 sm:shadow-sm overflow-hidden w-full">
        <table className="w-full border-collapse">
          <thead className="hidden sm:table-header-group">
            <tr className="bg-gray-50/70 border-b text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
              <th className="px-5 py-3.5">Name</th>
              <th className="px-5 py-3.5">Email</th>
              <th className="px-5 py-3.5">Phone Line</th>
              <th className="px-5 py-3.5">Fulfillment Bounds</th>
              <th className="px-5 py-3.5">Clearance Role</th>
              {isSuperAdmin && <th className="px-5 py-3.5 text-center">Operation Triggers</th>}
            </tr>
          </thead>
          <tbody className="grid grid-cols-2 gap-2.5 p-0.5 sm:p-0 sm:table-row-group divide-y sm:divide-y divide-gray-100 text-sm text-gray-700">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="flex flex-col sm:table-row bg-white border border-gray-200 sm:border-0 rounded-2xl p-3 sm:p-0 hover:bg-gray-50/50 justify-between h-full gap-2 relative shadow-xs sm:shadow-none">
                {editingUser?.id === user.id && isSuperAdmin ? (
                  <>
                    <td className="p-0 sm:px-5 sm:py-3 flex flex-col sm:table-cell w-full"><input type="text" value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className="border rounded-lg px-2 py-1.5 text-xs w-full bg-gray-50 focus:outline-none" /></td>
                    <td className="p-0 sm:px-5 sm:py-3 flex flex-col sm:table-cell w-full text-gray-400 text-xs truncate"><span className="truncate block mt-1 sm:mt-0">{user.email}</span></td>
                    <td className="p-0 sm:px-5 sm:py-3 flex flex-col sm:table-cell w-full"><input type="tel" value={editingUser.phone} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} className="border rounded-lg px-2 py-1.5 text-xs w-full font-mono bg-gray-50 focus:outline-none" /></td>
                    <td className="p-0 sm:px-5 sm:py-3 flex flex-col sm:table-cell w-full"><input type="text" value={editingUser.location || ''} onChange={(e) => setEditingUser({ ...editingUser, location: e.target.value })} className="border rounded-lg px-2 py-1.5 text-xs w-full bg-gray-50 focus:outline-none" /></td>
                    <td className="p-0 sm:px-5 sm:py-3 flex flex-col sm:table-cell w-full">
                      <select value={editingUser.is_admin ? editingUser.role : 'customer'} onChange={(e) => setEditingUser({ ...editingUser, is_admin: e.target.value !== 'customer', role: e.target.value })} className="border rounded-lg px-2 py-1.5 text-xs font-bold cursor-pointer w-full bg-gray-50 focus:outline-none">
                        <option value="customer">Customer Access</option>
                        <option value="mineazy_admin">Mineazy Admin</option>
                        <option value="farmeazy_admin">Farmeazy Admin</option>
                        <option value="super_admin">Super Global Admin</option>
                      </select>
                    </td>
                    <td className="p-0 sm:px-5 sm:py-3 flex flex-col sm:table-cell text-center w-full mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-gray-100 sm:border-0">
                      <div className="flex gap-1 w-full">
                        <button onClick={() => updateUser(editingUser)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-xs font-bold shadow-sm">Save</button>
                        <button onClick={() => setEditingUser(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-1.5 rounded-lg text-xs font-bold">Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-0 sm:px-5 sm:py-4 flex flex-col items-start sm:table-cell w-full"><span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Name:</span><span className="font-bold text-gray-900 truncate block">{user.name || '-'}</span></td>
                    <td className="p-0 sm:px-5 sm:py-4 flex flex-col items-start sm:table-cell w-full min-w-0"><span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Email:</span><span className="text-gray-500 text-[11px] sm:text-sm truncate block font-medium" title={user.email}>{user.email}</span></td>
                    <td className="p-0 sm:px-5 sm:py-4 flex flex-col items-start sm:table-cell w-full"><span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Phone:</span><span className="font-mono text-xs text-gray-600 truncate block">{user.phone || '-'}</span></td>
                    <td className="p-0 sm:px-5 sm:py-4 flex flex-col items-start sm:table-cell w-full min-w-0"><span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Location:</span><span className="text-xs text-gray-500 truncate block" title={user.location}>{user.location || '-'}</span></td>
                    <td className="p-0 sm:px-5 sm:py-4 flex flex-col items-start sm:table-cell w-full"><span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Clearance:</span><span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-block ${user.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : user.role === 'mineazy_admin' ? 'bg-blue-50 text-blue-700 border-blue-100' : user.role === 'farmeazy_admin' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500'}`}>{user.role === 'super_admin' ? 'Super' : user.role === 'mineazy_admin' ? 'Mineazy' : user.role === 'farmeazy_admin' ? 'Farmeazy' : 'Customer'}</span></td>
                    {isSuperAdmin && (
                      <td className="p-0 sm:px-5 sm:py-4 flex flex-col sm:table-cell text-center w-full mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-gray-100 sm:border-0">
                        <div className="flex sm:flex-row gap-2 sm:gap-4 justify-center items-stretch sm:items-center">
                          <button onClick={() => setEditingUser(user)} disabled={clearingTable !== null || modal.isOpen} className="flex-1 sm:flex-none text-blue-600 text-xs font-black hover:underline bg-blue-50 sm:bg-transparent border border-blue-100 sm:border-0 py-2 sm:py-0 rounded-xl">Edit</button>
                          <button onClick={() => handleDeleteUserAccount(user)} disabled={clearingTable !== null || deletingId === user.id || modal.isOpen} className="flex-1 sm:flex-none text-red-600 text-xs font-black hover:underline bg-red-50 sm:bg-transparent border border-red-100 sm:border-0 py-2 sm:py-0 rounded-xl">{deletingId === user.id ? 'Purging...' : 'Delete'}</button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity">
          <div className="bg-white border border-gray-100 rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 transform scale-100 transition-all duration-200">
            <div className="flex items-center gap-2.5 text-red-600"><span className="text-lg">⚠️</span><h3 className="text-sm font-black uppercase tracking-wider text-gray-900">{modal.title}</h3></div>
            <p className="text-xs text-gray-500 font-medium leading-relaxed">{modal.message}</p>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition-all">Cancel</button>
              <button type="button" onClick={() => { modal.onConfirm(); setModal(prev => ({ ...prev, isOpen: false })) }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs">{modal.confirmButtonText}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}