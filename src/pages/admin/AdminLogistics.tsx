import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminLogistics() {
  const [basePrice, setBasePrice] = useState<number>(5.00)
  const [pricePerKm, setPricePerKm] = useState<number>(1.50)
  const [savingSettings, setSavingSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    async function initializeLogisticsPanel() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!adminData) {
          setHasAccess(false)
          return
        }

        setHasAccess(true)

        const { data: config } = await supabase
          .from('app_settings')
          .select('meta_key, meta_value')
          .in('meta_key', ['delivery_base_price', 'delivery_price_per_km'])

        if (config) {
          const base = config.find(c => c.meta_key === 'delivery_base_price')?.meta_value
          const perKm = config.find(c => c.meta_key === 'delivery_price_per_km')?.meta_value
          if (base) setBasePrice(Number(base))
          if (perKm) setPricePerKm(Number(perKm))
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
    try {
      const updates = [
        { meta_key: 'delivery_base_price', meta_value: String(basePrice) },
        { meta_key: 'delivery_price_per_km', meta_value: String(pricePerKm) }
      ]

      const { error } = await supabase
        .from('app_settings')
        .upsert(updates, { onConflict: 'meta_key' })

      if (error) throw error
      alert('Logistics pricing updated successfully!')
    } catch (err: any) {
      alert(`Update failed: ${err.message}`)
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) return <div className="text-center pt-12 font-mono text-xs text-gray-400">Loading logistics configurations...</div>
  
  if (!hasAccess) return <div className="text-center pt-12 font-mono text-xs text-red-500">Access Denied: Administrative privileges required.</div>

  return (
    <div className="w-full max-w-3xl mx-auto pt-6 px-4 space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Logistics & Delivery</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage the Haversine pricing matrix and dispatch variables.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Dynamic Checkout Pricing</h2>
          <p className="text-[11px] text-gray-500 mt-1">Configure core cost multipliers applied to spherical distance calculations at the customer checkout screen.</p>
        </div>
        
        {/* 📱 MOBILE FIX: Grid changes fluidly from 1 to 2 columns based on screen width */}
        <form onSubmit={handleSaveLogisticsSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Base Delivery Price ($)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0" 
              value={basePrice} 
              onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)} 
              className="w-full text-sm font-bold text-gray-800 bg-white border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price Per Kilometer ($/km)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0" 
              value={pricePerKm} 
              onChange={(e) => setPricePerKm(parseFloat(e.target.value) || 0)} 
              className="w-full text-sm font-bold text-gray-800 bg-white border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            />
          </div>
          <div className="sm:col-span-2 pt-2">
            <button 
              type="submit" 
              disabled={savingSettings} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {savingSettings ? 'Syncing Configurations...' : 'Save Logistics Parameters'}
            </button>
          </div>
        </form>

        <div className="p-4 border border-blue-100 bg-blue-50 rounded-xl">
           <h3 className="text-[10px] font-black text-blue-800 uppercase mb-1">Live Calculation Example</h3>
           <p className="text-xs text-blue-900 font-mono break-all">
             A 10km delivery will cost: <strong>${(basePrice + (10 * pricePerKm)).toFixed(2)}</strong>
           </p>
        </div>
      </div>
    </div>
  )
}