import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../hooks/useAdminAuth'

export default function SuperConsole() {
  const { isSuperAdmin, checking } = useAdminAuth()
  
  // States for creating a new branch admin user account
  const [targetId, setTargetId] = useState('')
  const [targetEmail, setTargetEmail] = useState('')
  const [adminRole, setAdminRole] = useState('manager')
  const [assignedCompany, setAssignedCompany] = useState('1')

  // States for adding an entire new Subsidiary
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanyShort, setNewCompanyShort] = useState('')
  const [newCompanyIcon, setNewCompanyIcon] = useState('')
  
  const [companies, setCompanies] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies()
    }
  }, [isSuperAdmin])

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('id', { ascending: true })
    if (data) setCompanies(data)
  }

  // Assigns an administrative row privilege schema rule to an existing Auth identity
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('Processing configuration change...')

    const { error } = await supabase.from('admin_users').insert([{
      id: targetId.trim(),
      email: targetEmail.trim(),
      role: adminRole,
      company_id: adminRole === 'super_admin' ? null : parseInt(assignedCompany)
    }])

    if (error) {
      setMsg(`System error fault: ${error.message}`)
    } else {
      setMsg('🎉 New Administrator record mapped and authorized successfully!')
      setTargetId('')
      setTargetEmail('')
    }
  }

  // Dynamically introduces a new branch corporate line operation matrix instantly
  const handleAddNewCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('Registering business node operations...')

    const { error } = await supabase.from('companies').insert([{
      name: newCompanyName,
      short_name: newCompanyShort,
      icon: newCompanyIcon
    }])

    if (error) {
      setMsg(`Execution exception: ${error.message}`)
    } else {
      setMsg('🏢 New Corporate Node activated globally!')
      setNewCompanyName('')
      setNewCompanyShort('')
      setNewCompanyIcon('')
      fetchCompanies()
    }
  }

  if (checking) return <div className="p-6 text-xs font-bold text-gray-400">Reading security roles...</div>
  if (!isSuperAdmin) return <div className="p-6 text-xs text-red-500 font-bold">⚠️ Access Denied: Requires Super Admin clearances.</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Super Admin Master Command</h1>
        <p className="text-xs text-gray-400 mt-1">Deploy administration personnel settings configuration nodes and subsidiary lines.</p>
      </div>

      {msg && <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs font-bold">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* FORM A: PROMOTING AN ADMIN */}
        <form onSubmit={handleCreateAdmin} className="bg-white border rounded-2xl p-5 space-y-4 shadow-sm">
          <h2 className="font-black text-sm text-gray-800 border-b pb-2">➕ Authorize New Admin Personnel</h2>
          
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase">User Auth UUID String</label>
            <input 
              type="text" required value={targetId} onChange={e => setTargetId(e.target.value)}
              placeholder="e.g. b3c816db-5db9-4673..."
              className="w-full mt-1 border text-xs p-2.5 rounded-xl bg-gray-50 font-mono outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase">Admin Identification Email Address</label>
            <input 
              type="email" required value={targetEmail} onChange={e => setTargetEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full mt-1 border text-xs p-2.5 rounded-xl bg-gray-50 outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Clearance Rank</label>
              <select value={adminRole} onChange={e => setAdminRole(e.target.value)} className="w-full mt-1 border text-xs p-2.5 rounded-xl bg-white font-bold">
                <option value="manager">Manager Staff</option>
                <option value="super_admin">Super Admin (Global)</option>
              </select>
            </div>

            {adminRole !== 'super_admin' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Tenant Scope Lock</label>
                <select value={assignedCompany} onChange={e => setAssignedCompany(e.target.value)} className="w-full mt-1 border text-xs p-2.5 rounded-xl bg-white font-bold">
                  {companies.map(c => <option key={c.id} value={c.id}>{c.short_name}</option>)}
                </select>
              </div>
            )}
          </div>

          <button type="submit" className="w-full bg-gray-900 text-white font-bold text-xs p-3 rounded-xl hover:bg-black transition-colors">
            Deploy Admin Privileges Node
          </button>
        </form>

        {/* FORM B: CREATING A NEW COMPANY TERMINAL */}
        <form onSubmit={handleAddNewCompany} className="bg-white border rounded-2xl p-5 space-y-4 shadow-sm">
          <h2 className="font-black text-sm text-gray-800 border-b pb-2">🏢 Initialize New Subsidiary Line</h2>
          
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase">Full Legal Business Name</label>
            <input 
              type="text" required value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
              placeholder="e.g. Logistixeazy Fleet Lines"
              className="w-full mt-1 border text-xs p-2.5 rounded-xl bg-gray-50 outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Short Handle Name</label>
              <input 
                type="text" required value={newCompanyShort} onChange={e => setNewCompanyShort(e.target.value)}
                placeholder="Logistixeazy"
                className="w-full mt-1 border text-xs p-2.5 rounded-xl bg-gray-50 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Interface System Emoji Symbol</label>
              <input 
                type="text" required value={newCompanyIcon} onChange={e => setNewCompanyIcon(e.target.value)}
                placeholder="e.g. 📦 or ✈️"
                className="w-full mt-1 border text-xs p-2.5 rounded-xl bg-gray-50 text-center outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white font-bold text-xs p-3 rounded-xl hover:bg-blue-700 transition-colors">
            Spawn Corporate Entity Node
          </button>
        </form>

      </div>
    </div>
  )
}