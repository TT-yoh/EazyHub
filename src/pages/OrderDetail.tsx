import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { toast } from 'react-hot-toast'
import { calculateHistoricalDeliveryBreakdown } from '../utils/pricing'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
  const [updating, setUpdating] = useState(false)
  const [orderBreakdown, setOrderBreakdown] = useState({ mineazyFee: 0, farmeazyFee: 0 })

  useEffect(() => {
    const checkAdminStatus = async (userObj: any) => {
      if (!userObj) {
        setIsAdmin(false)
        return null
      }
      try {
        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('id, company_id')
          .eq('id', userObj.id)
          .maybeSingle()

        if (adminCheck) {
          setIsAdmin(true)
          setCurrentCompanyId(adminCheck.company_id)
          return adminCheck.company_id
        }
        return null
      } catch (err) {
        setIsAdmin(false)
        return null
      }
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) { navigate('/login'); return }
        
        const activeCompanyId = await checkAdminStatus(user)

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .single()

        if (orderError) throw orderError
        setOrder(orderData)

        // Fetch Logistics Settings for historical accuracy reconstruction
        let mBase, mKm, fBase, fKm;
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('meta_key, meta_value')
          .in('meta_key', ['mineazy_base_price', 'mineazy_price_per_km', 'farmeazy_base_price', 'farmeazy_price_per_km'])

        if (settingsData) {
          mBase = settingsData.find(r => r.meta_key === 'mineazy_base_price')?.meta_value
          mKm = settingsData.find(r => r.meta_key === 'mineazy_price_per_km')?.meta_value
          fBase = settingsData.find(r => r.meta_key === 'farmeazy_base_price')?.meta_value
          fKm = settingsData.find(r => r.meta_key === 'farmeazy_price_per_km')?.meta_value
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', id)

        if (itemsError) throw itemsError
        if (!itemsData || itemsData.length === 0) { setItems([]); return }

        const productIds = itemsData.map(item => item.product_id).filter(Boolean)

        const { data: productsCatalog, error: catalogError } = await supabase
          .from('products')
          .select('id, Name, company')
          .in('id', productIds)

        if (catalogError) throw catalogError

        const formattedItems = itemsData.map(item => {
          const matchedProduct = productsCatalog?.find(p => p.id === item.product_id)
          return {
            ...item,
            products: matchedProduct 
              ? { name: matchedProduct.Name, company: Number(matchedProduct.company) } 
              : { name: 'Unknown Product', company: null }
          }
        })

        const hasMineazy = formattedItems.some(i => i.products.company === 1)
        const hasFarmeazy = formattedItems.some(i => i.products.company === 2)

        const logisticsConf = {
          mineazy: { basePrice: mBase ? Number(mBase) : 15.00, pricePerKm: mKm ? Number(mKm) : 2.50 },
          farmeazy: { basePrice: fBase ? Number(fBase) : 5.00, pricePerKm: fKm ? Number(fKm) : 1.00 }
        }

        const breakdown = calculateHistoricalDeliveryBreakdown(
          orderData.delivery_fee,
          orderData.delivery_lat,
          orderData.delivery_lng,
          hasMineazy,
          hasFarmeazy,
          logisticsConf
        )
        setOrderBreakdown(breakdown)

        // ⭐ THE CRITICAL FIX: Isolate the view for Branch Admins
        let finalItems = formattedItems;
        if (activeCompanyId && activeCompanyId !== 3) {
          // Hide all items that DO NOT belong to the logged-in admin's company
          finalItems = formattedItems.filter(item => item.products.company === activeCompanyId)
        }
        
        setItems(finalItems)

      } catch (error) {
        console.error("Critical error mapping client order profiles:", error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchData()

      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user) {
            await checkAdminStatus(session.user)
          } else if (event === 'SIGNED_OUT') {
            setIsAdmin(false)
            navigate('/login')
          }
        }
      )

      // 🔄 Realtime Tracking: Listen for status updates (e.g. from admins or dispatchers)
      const orderTrackerChannel = supabase
        .channel(`order_tracker_${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${id}`
          },
          (payload) => {
            // Hot-swap the order state so the UI (progress bar, status pill) updates instantly
            setOrder((prev: any) => ({ ...prev, ...payload.new }))
            toast.success(`Order status updated to ${payload.new.status.toUpperCase()}`, {
              icon: '🚚',
              style: {
                borderRadius: '10px',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 'bold'
              }
            })
          }
        )
        .subscribe()

      return () => { 
        authSubscription.unsubscribe() 
        supabase.removeChannel(orderTrackerChannel)
      }
    }
  }, [id, navigate])

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true)
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      // Opt out of optimistic UI update for status pill, let realtime handle it
      // setOrder((prev: any) => ({ ...prev, status: newStatus }))
      // toast.success(`Status updated to: ${newStatus.toUpperCase()}`) // Removed duplicate toast

      // 📨 TRIGGER EMAIL NOTIFICATION IF DISPATCHED
      if (newStatus === 'dispatched' && order?.customers?.email) {
        supabase.functions.invoke('email-notifications', {
          body: {
            orderId: id,
            type: 'dispatched',
            customerEmail: order.customers.email,
            customerName: order.customers.name || 'Customer'
          }
        }).catch(e => console.error("Email dispatch failed:", e))
      }

    } catch (err) {
      toast.error("Failed to commit status update.")
    } finally {
      setUpdating(false)
    }
  }

  const [initiatingPayment, setInitiatingPayment] = useState(false)

  const handlePayNow = async () => {
    setInitiatingPayment(true)
    const initToast = toast.loading('Initializing secure Paynow checkout...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const total = (order.total_amount || 0) + (order.delivery_fee || 0)
      
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('paynow-checkout', { 
        body: { orderId: order.id, amount: total, customerEmail: user?.email || 'guest@eazyhub.com' } 
      })
      
      if (edgeError) throw edgeError

      if (edgeData && edgeData.success && edgeData.redirectUrl) {
        toast.success('Redirecting to Paynow Secure Gateway...', { id: initToast })
        window.location.href = edgeData.redirectUrl
      } else {
        throw new Error(edgeData?.error || "Invalid response from Paynow Gateway")
      }
    } catch (err: any) {
      toast.error(`Transaction Rejected: ${err.message || 'Check network connection.'}`, { id: initToast })
    } finally {
      setInitiatingPayment(false)
    }
  }

  if (loading) return <div className="text-center py-12 font-medium text-gray-500">Loading order configurations...</div>
  if (!order) return <div className="text-center py-12 font-medium text-gray-500">Target order file not found.</div>

  const hasCoordinates = order.delivery_lat && order.delivery_lng
  const mapPosition: [number, number] = [Number(order.delivery_lat || 0), Number(order.delivery_lng || 0)]

  // Calculate isolated branch total based on ONLY the items they are allowed to see
  const branchSubtotal = items.reduce((sum, item) => sum + ((item.price_at_time || 0) * item.quantity), 0)
  const masterSubtotal = order.total_amount || 0
  const isPartialView = isAdmin && currentCompanyId !== 3 && branchSubtotal !== masterSubtotal

  // Reconstruct Delivery Fee Breakdown
  return (
    <div className="max-w-2xl mx-auto pb-20 px-4 pt-6">
      <Link 
        to={isAdmin ? "/admin/orders" : "/orders"} 
        className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors mb-4"
      >
        ← Back to Order Dashboard
      </Link>
      
      {/* ⭐ ALERT BANNER FOR BRANCH ADMINS LOOKING AT MIXED ORDERS */}
      {isPartialView && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-xl mb-4 text-xs font-bold shadow-sm flex gap-3 items-center">
          <span className="text-xl">🔍</span>
          <p>
            <strong>Partial View Active:</strong> This was a mixed-cart order. You are only seeing the specific items requested from your division.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-gray-100 pb-5 mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Order Ref: {order.order_number}</h1>
            <div className="text-xs font-medium text-gray-400 mt-1">
              Transaction Date: {new Date(order.created_at).toLocaleString()}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 self-start">
            <div className="text-sm font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              Method: <span className="uppercase text-gray-800 font-bold">{order.payment_method}</span>
            </div>
            <div className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border ${
              order.payment_status === 'paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
              order.payment_status === 'failed' ? 'bg-red-50 border-red-200 text-red-600' :
              'bg-amber-50 border-amber-200 text-amber-600'
            }`}>
              {order.payment_status === 'paid' ? 'Payment Verified 💸' : order.payment_status === 'failed' ? 'Payment Failed ❌' : 'Payment Pending ⏳'}
            </div>
            {order.payment_status !== 'paid' && !isAdmin && (
              <button 
                onClick={handlePayNow} 
                disabled={initiatingPayment}
                className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {initiatingPayment ? 'Connecting...' : 'Pay Now'}
              </button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fulfillment Target Destination</div>
          <p className="text-sm font-medium text-gray-700 bg-gray-50 p-3.5 rounded-xl border border-gray-200/60 leading-relaxed">
            {order.delivery_location || 'No text location provided'}
          </p>
        </div>

        <div className="mb-8">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status Tracking Management</div>
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <select
                value={order.status}
                disabled={updating}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 shadow-sm transition-all outline-none cursor-pointer"
              >
                <option value="pending">Pending ⏳</option>
                <option value="processing">Processing ⚙️</option>
                <option value="dispatched">Dispatched 🚚</option>
                <option value="completed">Completed ✅</option>
                <option value="cancelled">Cancelled ❌</option>
              </select>
              {updating && <span className="text-xs font-semibold text-blue-600 animate-pulse">Syncing...</span>}
            </div>
          ) : (
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              order.status === 'completed' ? 'bg-green-100 text-green-800' :
              order.status === 'dispatched' ? 'bg-blue-100 text-blue-800' :
              order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {order.status}
            </span>
          )}
        </div>

        <div className="border-t border-gray-100 pt-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            {isPartialView ? 'Your Division Manifest Items' : 'Purchased Manifest Items'}
          </div>
          <div className="divide-y divide-gray-100 bg-gray-50/50 rounded-xl border px-4 border-gray-100">
            {items && items.length > 0 ? (
              items.map((item) => {
                const isMineazy = item.products?.company === 1;
                const isFarmeazy = item.products?.company === 2;
                
                const badgeLabel = isMineazy ? '⛏️ Mineazy' : isFarmeazy ? '🚜 Farmeazy' : '📦 EazyHub System';
                const badgeColor = isMineazy ? 'text-blue-600 bg-blue-50' : isFarmeazy ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50';

                return (
                  <div key={item.id} className="flex justify-between items-center py-3.5 text-sm">
                    <div className="flex flex-col gap-1.5">
                      <div className="font-medium text-gray-800">
                        {item.products?.name} 
                        <span className="text-gray-400 font-mono text-xs ml-2 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                          x{item.quantity}
                        </span>
                      </div>
                      
                      {(isMineazy || isFarmeazy) && (
                        <span className={`inline-block self-start px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                      )}

                    </div>
                    <div className="font-bold text-gray-900 font-mono">
                      ${((item.price_at_time || 0) * item.quantity).toFixed(2)}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-4 text-center text-xs text-gray-400 font-medium">No distinct lines mapped to this cargo tracking row.</div>
            )}
          </div>
        </div>

        {/* GPS Target Location Section */}
        <div className="border-t border-gray-100 pt-6 mt-6">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              🗺️ GPS Dispatch Target
            </div>
            {hasCoordinates && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100"
              >
                Open Navigation Directions →
              </a>
            )}
          </div>

          {hasCoordinates ? (
            <div className="h-64 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative z-10">
              <MapContainer 
                center={mapPosition} 
                zoom={16} 
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={mapPosition}>
                  <Popup>
                    <div className="text-xs font-bold text-gray-900">
                      Deliver to Ref: <span className="text-blue-600">{order.order_number}</span>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center text-xs font-medium text-gray-400">
              No geographical waypoint coordinates dropped for this dispatch sequence.
            </div>
          )}
        </div>

        {/* 💳 Balanced Invoice Pricing Panel */}
        <div className="border-t border-gray-100 pt-6 mt-6 space-y-2.5 text-xs text-gray-500 font-medium">
          <div className="flex justify-between">
            <span>{isPartialView ? 'Your Division Items Subtotal:' : 'Items Master Subtotal:'}</span>
            <span className="text-gray-800 font-bold font-mono">
              ${isPartialView ? branchSubtotal.toFixed(2) : masterSubtotal.toFixed(2)}
            </span>
          </div>
          
          {/* Detailed Delivery Fee Breakdown */}
          {isPartialView ? (
            <div className="flex justify-between">
              <span>Your Division Delivery Fee:</span>
              <span className="text-blue-600 font-bold font-mono">
                +${(currentCompanyId === 1 ? orderBreakdown.mineazyFee : orderBreakdown.farmeazyFee).toFixed(2)}
              </span>
            </div>
          ) : (
            <>
              {orderBreakdown.mineazyFee > 0 && (
                <div className="flex justify-between">
                  <span>Logistics / Delivery Fee (Mineazy):</span>
                  <span className="text-blue-600 font-bold font-mono">+${orderBreakdown.mineazyFee.toFixed(2)}</span>
                </div>
              )}
              {orderBreakdown.farmeazyFee > 0 && (
                <div className="flex justify-between">
                  <span>Logistics / Delivery Fee (Farmeazy):</span>
                  <span className="text-green-600 font-bold font-mono">+${orderBreakdown.farmeazyFee.toFixed(2)}</span>
                </div>
              )}
              {orderBreakdown.mineazyFee === 0 && orderBreakdown.farmeazyFee === 0 && order.delivery_fee > 0 && (
                 <div className="flex justify-between">
                 <span>Logistics / Delivery Fee:</span>
                 <span className="text-blue-600 font-bold font-mono">+${(order.delivery_fee || 0).toFixed(2)}</span>
               </div>
              )}
            </>
          )}

          <div className="flex justify-between items-center font-black text-xl text-gray-900 border-t border-dashed border-gray-200 pt-4 mt-2">
            <span className="text-gray-800 text-sm font-black uppercase tracking-tight">
              {isPartialView ? 'Your Fulfillment Value' : 'Total Statement Balance'}
            </span>
            <span className="text-blue-600 font-mono tracking-tight text-2xl">
              ${isPartialView 
                  ? (branchSubtotal + (currentCompanyId === 1 ? orderBreakdown.mineazyFee : orderBreakdown.farmeazyFee)).toFixed(2) 
                  : (masterSubtotal + (order.delivery_fee || 0)).toFixed(2)}
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}