import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface User {
  id: string; email: string; phone: string; name: string; location: string; created_at: string; is_admin: boolean; role: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data: customers } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    const { data: admins } = await supabase.from('admin_users').select('id, role')

    const adminIds = new Set(admins?.map(a => a.id) || [])
    const adminRoles: Record<string, string> = {}
    admins?.forEach(a => { adminRoles[a.id] = a.role })

    const usersWithAdmin = (customers || []).map((customer: any) => ({
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
    setLoading(false)
  }

  const updateUser = async (user: User) => {
    await supabase.from('customers').update({ name: user.name, phone: user.phone, location: user.location, updated_at: new Date().toISOString() }).eq('id', user.id)

    if (user.is_admin) {
      const { data: existing } = await supabase.from('admin_users').select('id').eq('id', user.id).maybeSingle()
      const companyId = user.role === 'mineazy_admin' ? 1 : user.role === 'farmeazy_admin' ? 2 : null
      
      if (!existing) {
        await supabase.from('admin_users').insert({ id: user.id, role: user.role, company_id: companyId })
      } else {
        await supabase.from('admin_users').update({ role: user.role, company_id: companyId }).eq('id', user.id)
      }
    } else {
      await supabase.from('admin_users').delete().eq('id', user.id)
    }

    alert('User clearance modified successfully.')
    setEditingUser(null)
    fetchUsers()
  }

  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="text-center py-12 text-gray-500">Parsing directory entries...</div>

  return (
    <div className="pb-16">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Identity Management</h1>
        <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md border">{users.length} Users Indexed</span>
      </div>
      <div className="mb-6">
        <input type="text" placeholder="🔍 Search users by profile name, registration email, or contact numbers..." value={search} onChange={(e) => setSearch(e.target.value)} className="input w-full shadow-sm text-sm" />
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full min-w-[850px] border-collapse">
          <thead>
            <tr className="bg-gray-50/70 border-b text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
              <th className="px-5 py-3.5">Identifier</th>
              <th className="px-5 py-3.5">Email</th>
              <th className="px-5 py-3.5">Phone Line</th>
              <th className="px-5 py-3.5">Fulfillment Bounds</th>
              <th className="px-5 py-3.5">Clearance Role</th>
              <th className="px-5 py-3.5 text-center">Operation Triggers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50">
                {editingUser?.id === user.id ? (
                  <>
                    <td className="px-5 py-3"><input type="text" value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className="input text-xs py-1.5 w-40" /></td>
                    <td className="px-5 py-3 text-gray-400">{user.email}</td>
                    <td className="px-5 py-3"><input type="tel" value={editingUser.phone} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} className="input text-xs py-1.5 w-36 font-mono" /></td>
                    <td className="px-5 py-3"><input type="text" value={editingUser.location || ''} onChange={(e) => setEditingUser({ ...editingUser, location: e.target.value })} className="input text-xs py-1.5 w-44" /></td>
                    <td className="px-5 py-3">
                      <select value={editingUser.is_admin ? editingUser.role : 'customer'} onChange={(e) => setEditingUser({ ...editingUser, is_admin: e.target.value !== 'customer', role: e.target.value })} className="border rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none">
                        <option value="customer">Customer Access</option>
                        <option value="mineazy_admin">Mineazy Admin</option>
                        <option value="farmeazy_admin">Farmeazy Admin</option>
                        <option value="super_admin">Super Global Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => updateUser(editingUser)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">Save</button>
                        <button onClick={() => setEditingUser(null)} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold">Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-4 font-bold text-gray-900">{user.name || '-'}</td>
                    <td className="px-5 py-4 text-gray-500">{user.email}</td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-600">{user.phone || '-'}</td>
                    <td className="px-5 py-4 text-xs text-gray-500 max-w-[180px] truncate">{user.location || '-'}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                        user.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                        user.role === 'mineazy_admin' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        user.role === 'farmeazy_admin' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500'
                      }`}>{user.role}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => setEditingUser(user)} className="text-blue-600 text-xs font-bold hover:underline">Edit Profile</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}