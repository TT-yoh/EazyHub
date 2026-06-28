import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

export default function AdminLogistics() {
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  // Mineazy States
  const [mBase, setMBase] = useState<number>(15.00)
  const [mKm, setMKm] = useState<number>(2.50)

  // Farmeazy States
  const [fBase, setFBase] = useState<number>(5.00)
  const [fKm, setFKm] = useState<number>(1.00)

  useEffect(() => {
    async function initializeLogisticsPanel() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id, company_id')
          .eq('id', user.id)
          .maybeSingle()

        if (!adminData) {
          setHasAccess(false)
          return
        }

        setHasAccess(true)
        setCurrentCompanyId(adminData.company_id)

        // ⭐ FETCH THE CURRENT LIVE PRICES FROM THE DATABASE
        const { data: config } = await supabase
          .from('app_settings')
          .select('meta_key, meta_value')
          .in('meta_key', [
            'mineazy_base_price', 'mineazy_price_per_km',
            'farmeazy_base_price', 'farmeazy_price_per_km'
          ])

        if (config) {
          // Find the exact values and update the visual input boxes
          const mBaseVal = config.find(c => c.meta_key === 'mineazy_base_price')?.meta_value
          const mKmVal = config.find(c => c.meta_key === 'mineazy_price_per_km')?.meta_value
          const fBaseVal = config.find(c => c.meta_key === 'farmeazy_base_price')?.meta_value
          const fKmVal = config.find(c => c.meta_key === 'farmeazy_price_per_km')?.meta_value
          
          if (mBaseVal) setMBase(Number(mBaseVal))
          if (mKmVal) setMKm(Number(mKmVal))
          if (fBaseVal) setFBase(Number(fBaseVal))
          if (fKmVal) setFKm(Number(fKmVal))
        }

      } catch (err) {
        console.error('Initialization failure:', err)
      } finally {
        setLoading(false)
      }
    }
    initializeLogisticsPanel()
  }, [])

  const handleSaveLogisticsSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    const saveToast = toast.loading('Syncing delivery configurations to database...')

    try {
      const updates = []

      // ⭐ ONLY UPDATE THE PRICES FOR THE COMPANY THEY HAVE CLEARANCE FOR
      if (currentCompanyId === 1 || currentCompanyId === 3) {
        updates.push({ meta_key: 'mineazy_base_price', meta_value: String(mBase) })
        updates.push({ meta_key: 'mineazy_price_per_km', meta_value: String(mKm) })
      }
      
      if (currentCompanyId === 2 || currentCompanyId === 3) {
        updates.push({ meta_key: 'farmeazy_base_price', meta_value: String(fBase) })
        updates.push({ meta_key: 'farmeazy_price_per_km', meta_value: String(fKm) })
      }

      // Upsert overwrites the old price with the new price
      const { error } = await supabase
        .from('app_settings')
        .upsert(updates, { onConflict: 'meta_key' })

      if (error) throw error
      toast.success('Logistics pricing updated successfully! Checkout will now use these rates.', { id: saveToast })
    } catch (err: any) {
      toast.error(`Update failed: ${err.message}`, { id: saveToast })
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) return <div className="text-center pt-12 font-mono text-xs text-gray-400">Loading current logistics configurations...</div>
  if (!hasAccess) return <div className="text-center pt-12 font-mono text-xs text-red-500">Access Denied: Administrative privileges required.</div>

  const isMineazyAdmin = currentCompanyId === 1;
  const isFarmeazyAdmin = currentCompanyId === 2;
  const isSuperAdmin = currentCompanyId === 3;

  return (
    <div className="w-full max-w-4xl mx-auto pt-6 px-4 space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Logistics & Delivery</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage the pricing matrix and dispatch variables for your division.</p>
      </div>

      <form onSubmit={handleSaveLogisticsSettings} className="space-y-6">
        
        {/* ⛏️ MINEAZY PANEL */}
        {(isMineazyAdmin || isSuperAdmin) && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 sm:p-6">
            <div className="mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-sm font-black text-blue-800 uppercase tracking-wide">⛏️ Mineazy Heavy Dispatch</h2>
                <p className="text-[11px] text-gray-500 mt-1">Configure baseline pricing for heavy equipment hauling and flatbed trucks.</p>
              </div>
              <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">Live DB Sync Active</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-blue-50/50 p-4 rounded-xl border border-blue-50">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Base Delivery Price ($)</label>
                <input 
                  type="number" step="0.01" min="0" 
                  value={mBase} onChange={(e) => setMBase(parseFloat(e.target.value) || 0)} 
                  className="w-full text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price Per Kilometer ($/km)</label>
                <input 
                  type="number" step="0.01" min="0" 
                  value={mKm} onChange={(e) => setMKm(parseFloat(e.target.value) || 0)} 
                  className="w-full text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-500" 
                />
              </div>
            </div>
            <div className="mt-4 p-3 border border-blue-100 bg-blue-50 rounded-xl text-[10px] font-black text-blue-800 uppercase">
              10km Example Route Cost: ${(mBase + (10 * mKm)).toFixed(2)}
            </div>
          </div>
        )}

        {/* 🚜 FARMEAZY PANEL */}
        {(isFarmeazyAdmin || isSuperAdmin) && (
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 sm:p-6">
            <div className="mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-sm font-black text-green-800 uppercase tracking-wide">🚜 Farmeazy Agri Dispatch</h2>
                <p className="text-[11px] text-gray-500 mt-1">Configure baseline pricing for lightweight agricultural tools, seeds, and local delivery.</p>
              </div>
              <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">Live DB Sync Active</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-green-50/50 p-4 rounded-xl border border-green-50">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Base Delivery Price ($)</label>
                <input 
                  type="number" step="0.01" min="0" 
                  value={fBase} onChange={(e) => setFBase(parseFloat(e.target.value) || 0)} 
                  className="w-full text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-green-500" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price Per Kilometer ($/km)</label>
                <input 
                  type="number" step="0.01" min="0" 
                  value={fKm} onChange={(e) => setFKm(parseFloat(e.target.value) || 0)} 
                  className="w-full text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-green-500" 
                />
              </div>
            </div>
            <div className="mt-4 p-3 border border-green-100 bg-green-50 rounded-xl text-[10px] font-black text-green-800 uppercase">
              10km Example Route Cost: ${(fBase + (10 * fKm)).toFixed(2)}
            </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={savingSettings} 
          className="w-full bg-gray-900 hover:bg-black text-white text-xs font-bold px-5 py-4 rounded-xl transition-all shadow-sm disabled:opacity-50"
        >
          {savingSettings ? 'Syncing Configurations...' : '💾 Save Current Logistics Parameters'}
        </button>

      </form>
    </div>
  )
}