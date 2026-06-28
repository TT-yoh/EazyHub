import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import { calculateHistoricalDeliveryBreakdown } from '../../utils/pricing'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export default function AdminOrders() {
  const navigate = useNavigate()
  
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [viewFilter, setViewFilter] = useState<'all' | number>('all')
  const [dashboardMode, setDashboardMode] = useState<'list' | 'map'>('list')

  const [rawOrders, setRawOrders] = useState<any[]>([])
  const [masterOrders, setMasterOrders] = useState<any[]>([])
  const [displayedOrders, setDisplayedOrders] = useState<any[]>([])
  
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  
  const observerRef = useRef<IntersectionObserver | null>(null)
  const pageSize = 20

  // ⚡ BLAZING FAST COMBINED INIT (Auth + Data in one shot)
  const initializeDashboard = useCallback(async (isSilentRefresh = false) => {
    if (!isSilentRefresh) setAuthLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/login')

      // Fetch admin role AND all 3 order tables SIMULTANEOUSLY + settings
      const [adminRes, ordersRes, itemsRes, productsRes, settingsRes] = await Promise.all([
        supabase.from('admin_users').select('company_id').eq('id', user.id).maybeSingle(),
        supabase.from('orders').select('id, order_number, status, payment_status, total_amount, delivery_fee, delivery_lat, delivery_lng, payment_method, created_at, customers(name, phone, email)').order('created_at', { ascending: false }),
        supabase.from('order_items').select('order_id, product_id, quantity, price_at_time'),
        supabase.from('products').select('id, company'),
        supabase.from('app_settings').select('meta_key, meta_value').in('meta_key', ['mineazy_base_price', 'mineazy_price_per_km', 'farmeazy_base_price', 'farmeazy_price_per_km'])
      ])

      if (!adminRes.data) {
        toast.error("Unauthorized Access.")
        return navigate('/')
      }

      const mBase = settingsRes.data?.find(r => r.meta_key === 'mineazy_base_price')?.meta_value
      const mKm = settingsRes.data?.find(r => r.meta_key === 'mineazy_price_per_km')?.meta_value
      const fBase = settingsRes.data?.find(r => r.meta_key === 'farmeazy_base_price')?.meta_value
      const fKm = settingsRes.data?.find(r => r.meta_key === 'farmeazy_price_per_km')?.meta_value
      
      const logisticsConfig = {
        mineazy: { basePrice: mBase ? Number(mBase) : 15.00, pricePerKm: mKm ? Number(mKm) : 2.50 },
        farmeazy: { basePrice: fBase ? Number(fBase) : 5.00, pricePerKm: fKm ? Number(fKm) : 1.00 }
      }

      const activeCompany = adminRes.data.company_id
      setCurrentCompanyId(activeCompany)

      // Map Products
      const productCompanyMap: Record<string, number> = {}
      if (productsRes.data) productsRes.data.forEach(p => { productCompanyMap[p.id] = Number(p.company) })

      // Filter Orders
      const secureOrders = (ordersRes.data || []).map(order => {
        const itemsInThisOrder = (itemsRes.data || []).filter(item => item.order_id === order.id)
        const extractedCompanies = itemsInThisOrder.map(item => productCompanyMap[item.product_id]).filter(id => id === 1 || id === 2) 
        const involvedCompanies = Array.from(new Set(extractedCompanies))
        
        // Calculate Branch specific data
        const hasMineazy = involvedCompanies.includes(1)
        const hasFarmeazy = involvedCompanies.includes(2)
        
        const breakdown = calculateHistoricalDeliveryBreakdown(order.delivery_fee, order.delivery_lat, order.delivery_lng, hasMineazy, hasFarmeazy, logisticsConfig)
        
        let branchValue = order.total_amount + (order.delivery_fee || 0)
        
        if (activeCompany !== 3) {
          const branchItems = itemsInThisOrder.filter(item => productCompanyMap[item.product_id] === activeCompany)
          const branchSubtotal = branchItems.reduce((sum, item) => sum + ((item.price_at_time || 0) * (item.quantity || 1)), 0)
          const branchDeliveryFee = activeCompany === 1 ? breakdown.mineazyFee : breakdown.farmeazyFee
          branchValue = branchSubtotal + branchDeliveryFee
        }

        return { ...order, involvedCompanies, branchValue }
      }).filter(order => {
        if (activeCompany === 3) return true
        return order.involvedCompanies.includes(activeCompany)
      })

      setRawOrders(secureOrders)
    } catch (err: any) {
      console.error("Order Engine Crash:", err)
    } finally {
      if (!isSilentRefresh) setAuthLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    initializeDashboard()
  }, [initializeDashboard])

  // Realtime Live Refresh
  useEffect(() => {
    if (currentCompanyId === null) return
    const orderChannel = supabase.channel('admin_orders_feed').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
      if (payload.eventType === 'INSERT') toast.success(`🔔 New Order Alert: ${payload.new.order_number}`, { duration: 6000, position: 'top-right', style: { background: '#2563eb', color: '#ffffff', fontWeight: 'bold' } })
      setTimeout(() => { initializeDashboard(true) }, 1500)
    }).subscribe()
    return () => { supabase.removeChannel(orderChannel) }
  }, [currentCompanyId, initializeDashboard])

  // Filters & Search
  useEffect(() => {
    if (rawOrders.length === 0) { setMasterOrders([]); setDisplayedOrders([]); return }
    let filtered = [...rawOrders]
    if (currentCompanyId === 3 && viewFilter !== 'all') filtered = filtered.filter(order => order.involvedCompanies.includes(viewFilter))
    if (search.trim() !== '') {
      const q = search.toLowerCase()
      filtered = filtered.filter(order => (order.order_number || '').toLowerCase().includes(q) || (order.customers?.name || '').toLowerCase().includes(q) || (order.customers?.phone || '').toLowerCase().includes(q))
    }
    setMasterOrders(filtered)
    setPage(0)
    setDisplayedOrders(filtered.slice(0, pageSize))
    setHasMore(filtered.length > pageSize)
  }, [rawOrders, currentCompanyId, viewFilter, search])

  // Pagination
  const loadMore = useCallback(() => {
    if (!hasMore) return
    const nextPage = page + 1
    const nextOrders = masterOrders.slice(0, (nextPage + 1) * pageSize)
    setDisplayedOrders(nextOrders)
    setPage(nextPage)
    setHasMore(masterOrders.length > nextOrders.length)
  }, [page, masterOrders, hasMore])

  const lastOrderRef = useCallback((node: HTMLDivElement) => {
    if (authLoading) return
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(entries => { if (entries[0].isIntersecting && hasMore) loadMore() })
    if (node) observerRef.current.observe(node)
  }, [authLoading, hasMore, loadMore])

  if (authLoading) return <div className="p-6 text-center text-sm font-medium text-gray-400">Verifying administrative clearance...</div>

  return (
    <div className="w-full max-w-7xl mx-auto p-4 pb-28">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 mb-1">Orders Dashboard</h1>
            <span className="flex h-3 w-3 relative mt-1" title="Live Server Connection Active">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </div>
          <p className="text-xs text-gray-500">Track and manage customer fulfillment pipelines.</p>
        </div>
        <button onClick={() => navigate('/admin/products')} className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-700 shadow-xs hover:bg-gray-50 transition-colors">Switch to Products →</button>
      </div>

      <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl w-max border border-gray-200">
        <button onClick={() => setDashboardMode('list')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${dashboardMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>📋 List View</button>
        <button onClick={() => setDashboardMode('map')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${dashboardMode === 'map' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>🗺️ Live Map</button>
      </div>

      {currentCompanyId === 3 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button onClick={() => setViewFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${viewFilter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>🌍 All Orders</button>
          <button onClick={() => setViewFilter(1)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${viewFilter === 1 ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>⛏️ Mineazy Deliveries</button>
          <button onClick={() => setViewFilter(2)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${viewFilter === 2 ? 'bg-green-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>🚜 Farmeazy Deliveries</button>
        </div>
      )}

      <div className="mb-6 relative">
        <input type="text" placeholder="🔎 Search by Order Ref, Customer Name, or Phone..." value={search} onChange={e => setSearch(e.target.value)} className="w-full border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-xs" />
      </div>

      {!authLoading && dashboardMode === 'list' && <div className="text-xs font-bold text-gray-400 mb-3 ml-1">{masterOrders.length} Invoices Found</div>}

      {dashboardMode === 'map' ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[600px]">
          <div className="w-full md:w-1/3 border-r border-gray-100 bg-gray-50 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Driver Manifest</h2>
              <p className="text-[10px] text-gray-500 font-bold mt-1">Active processing & dispatched routes.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {masterOrders.filter(o => (o.status === 'dispatched' || o.status === 'processing') && o.delivery_lat && o.delivery_lng).map((order) => (
                <div key={order.id} onClick={() => navigate(`/admin/orders/${order.id}`)} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-blue-400 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-gray-900">{order.order_number}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${order.status === 'dispatched' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.status}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium truncate mb-2">{order.customers?.name}</div>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`} 
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg w-full text-center hover:bg-blue-100 transition-colors"
                  >
                    Open in Maps →
                  </a>
                </div>
              ))}
              {masterOrders.filter(o => (o.status === 'dispatched' || o.status === 'processing') && o.delivery_lat && o.delivery_lng).length === 0 && (
                <div className="text-center py-8 text-xs font-bold text-gray-400">No active dispatches with GPS targets found.</div>
              )}
            </div>
          </div>
          <div className="w-full md:w-2/3 h-64 md:h-full relative z-10">
            <MapContainer center={[-17.824858, 31.053028]} zoom={12} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {masterOrders
                .filter(o => (o.status === 'dispatched' || o.status === 'processing') && o.delivery_lat && o.delivery_lng)
                .map(order => (
                  <Marker key={order.id} position={[Number(order.delivery_lat), Number(order.delivery_lng)]}>
                    <Popup>
                      <div className="text-xs font-bold text-gray-900">Ref: {order.order_number}</div>
                      <div className="text-[10px] text-gray-500">{order.customers?.name}</div>
                      <a href={`/admin/orders/${order.id}`} className="text-blue-600 font-bold block mt-1">View Order</a>
                    </Popup>
                  </Marker>
                ))
              }
            </MapContainer>
          </div>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="text-center py-12 text-xs font-bold text-gray-400 border border-dashed rounded-xl bg-gray-50">No orders found matching your clearance parameters.</div>
      ) : (
        <div className="space-y-3">
          {displayedOrders.map((order, index) => {
            const isMixedCart = order.involvedCompanies.length > 1
            const isMineazyOnly = order.involvedCompanies.includes(1) && !isMixedCart
            const isFarmeazyOnly = order.involvedCompanies.includes(2) && !isMixedCart

            return (
              <div key={order.id} ref={index === displayedOrders.length - 1 ? lastOrderRef : null} onClick={() => navigate(`/admin/orders/${order.id}`)} className="bg-white border border-gray-100 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-gray-900 text-base">{order.order_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'dispatched' ? 'bg-blue-100 text-blue-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.status}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                      order.payment_status === 'paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 
                      order.payment_status === 'failed' ? 'bg-red-50 border-red-200 text-red-600' :
                      'bg-amber-50 border-amber-200 text-amber-600'
                    }`}>
                      {order.payment_status === 'paid' ? 'Paid 💸' : order.payment_status === 'failed' ? 'Failed ❌' : 'Unpaid ⏳'}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-600">{order.customers?.name || 'Guest'} <span className="text-gray-300 mx-1">|</span> {order.customers?.phone || 'No Phone'}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {isMineazyOnly && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">⛏️ Mineazy Equipment</span>}
                    {isFarmeazyOnly && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">🚜 Farmeazy Agline</span>}
                  </div>
                </div>
                <div className="flex sm:flex-col justify-between sm:items-end sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0">
                  <div className="text-xs text-gray-400 font-medium mb-1">{new Date(order.created_at).toLocaleDateString()}</div>
                  <div className="font-mono font-black text-lg text-blue-600">${order.branchValue.toFixed(2)}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Via {order.payment_method}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}