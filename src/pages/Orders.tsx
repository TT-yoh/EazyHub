import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { calculateHistoricalDeliveryBreakdown } from '../utils/pricing'

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [logisticsConfig, setLogisticsConfig] = useState({
    mineazy: { basePrice: 15.00, pricePerKm: 2.50 },
    farmeazy: { basePrice: 5.00, pricePerKm: 1.00 }
  })

  // Isolated fetch logic joined with child relational arrays
  const fetchUserOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

        // 🔗 RELATIONAL JOIN: Fetches the order, the delivery surcharge column, and child line items text
        const [ordersRes, settingsRes] = await Promise.all([
          supabase
            .from('orders')
            .select(`
              id,
              order_number,
              created_at,
              status,
              total_amount,
              delivery_fee,
              delivery_lat,
              delivery_lng,
              order_items (
                id,
                quantity,
                products (
                  Name,
                  company
                )
              )
            `)
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('app_settings')
            .select('meta_key, meta_value')
            .in('meta_key', ['mineazy_base_price', 'mineazy_price_per_km', 'farmeazy_base_price', 'farmeazy_price_per_km'])
        ])

      if (ordersRes.error) throw ordersRes.error
      
      let currentLogisticsConfig = logisticsConfig;
      if (settingsRes.data) {
        const mBase = settingsRes.data.find(r => r.meta_key === 'mineazy_base_price')?.meta_value
        const mKm = settingsRes.data.find(r => r.meta_key === 'mineazy_price_per_km')?.meta_value
        const fBase = settingsRes.data.find(r => r.meta_key === 'farmeazy_base_price')?.meta_value
        const fKm = settingsRes.data.find(r => r.meta_key === 'farmeazy_price_per_km')?.meta_value
        
        currentLogisticsConfig = {
          mineazy: { basePrice: mBase ? Number(mBase) : 15.00, pricePerKm: mKm ? Number(mKm) : 2.50 },
          farmeazy: { basePrice: fBase ? Number(fBase) : 5.00, pricePerKm: fKm ? Number(fKm) : 1.00 }
        }
        setLogisticsConfig(currentLogisticsConfig)
      }
      
      const processedOrders = (ordersRes.data || []).map(order => {
        const hasMineazy = order.order_items.some((i: any) => i.products?.company === 1)
        const hasFarmeazy = order.order_items.some((i: any) => i.products?.company === 2)
        const breakdown = calculateHistoricalDeliveryBreakdown(order.delivery_fee, order.delivery_lat, order.delivery_lng, hasMineazy, hasFarmeazy, currentLogisticsConfig)
        return { ...order, breakdown }
      })

      setOrders(processedOrders)
    } catch (err) {
      console.error("Error fetching order manifest matrix:", err)
      toast.error("Failed to load your order history.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserOrders()

    // Real-time listener for background administrative update changes
    const fetchUserAndSubscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const ordersDashboardChannel = supabase
        .channel(`user_orders_dashboard_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `customer_id=eq.${user.id}`
          },
          (payload) => {
            // Hot-swap the updated order state properties dynamically without breaking relationships
            setOrders((prevOrders) =>
              prevOrders.map((order) =>
                order.id === payload.new.id 
                  ? { 
                      ...order, 
                      status: payload.new.status,
                      total_amount: payload.new.total_amount,
                      delivery_fee: payload.new.delivery_fee
                    } 
                  : order
              )
            )

            toast.success(`Order #${payload.new.order_number.slice(0, 10)}... status is now: ${payload.new.status.toUpperCase()}!`)
          }
        )
        .subscribe()

      return ordersDashboardChannel
    }

    const subscriptionPromise = fetchUserAndSubscribe()

    return () => {
      subscriptionPromise.then((channel) => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [navigate])

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-100'
      case 'dispatched': return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-100'
      default: return 'bg-amber-50 text-amber-700 border-amber-100'
    }
  }

  if (loading) return <div className="text-center py-12 font-medium text-gray-500">Loading your order lines...</div>

  return (
    <div className="max-w-2xl mx-auto pb-20 px-4 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Orders</h1>
        <p className="text-xs text-gray-400 mt-1">Track live processing statuses for your Mineazy and Farmeazy assets.</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border border-dashed rounded-2xl p-12 text-center text-sm font-medium text-gray-400 shadow-sm">
          You haven't placed any orders yet.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            // ⭐ ARITHMETIC AGGREGATION BREAKDOWN FIX
            const subtotalAmount = Number(order.total_amount || 0)
            const deliverySurcharge = Number(order.delivery_fee || 0)
            
            // Checks if the field already contains the grand total, otherwise combines them safely
            const grandTotalDisplay = subtotalAmount + deliverySurcharge

            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-white border border-gray-100 hover:border-blue-200 rounded-2xl p-5 shadow-xs transition-all hover:shadow-md active:scale-[0.99] group"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div>
                      <span className="block font-mono text-xs font-bold text-gray-400">Reference: {order.order_number}</span>
                      <span className="block text-[11px] text-gray-400 font-medium mt-0.5">
                        Placed on {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    </div>

                    {/* 📦 INLINE MANIFEST SUMMARY PREVIEW CHIPS */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {order.order_items?.slice(0, 2).map((item: any) => (
                        <span key={item.id} className="inline-block text-[10px] font-bold bg-gray-50 text-gray-600 border border-gray-100 px-2 py-0.5 rounded-lg truncate max-w-[150px]">
                          {item.products?.Name || 'Market Item'} <strong className="text-gray-400 font-normal">x{item.quantity}</strong>
                        </span>
                      ))}
                      {order.order_items?.length > 2 && (
                        <span className="inline-block text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                          +{order.order_items.length - 2} items
                        </span>
                      )}
                    </div>

                    {/* Grand Bill Print block containing the fix logic summaries */}
                    <div className="pt-2 flex items-baseline gap-1.5">
                      <span className="text-xl font-black text-gray-900 font-mono">
                        ${grandTotalDisplay.toFixed(2)}
                      </span>
                      {deliverySurcharge > 0 && (
                        <div className="text-[10px] text-gray-400 font-medium font-mono flex flex-col">
                          <span>(inc. ${deliverySurcharge.toFixed(2)} delivery)</span>
                          {order.breakdown?.mineazyFee > 0 && <span>- Mineazy: ${order.breakdown.mineazyFee.toFixed(2)}</span>}
                          {order.breakdown?.farmeazyFee > 0 && <span>- Farmeazy: ${order.breakdown.farmeazyFee.toFixed(2)}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Status Pill Badge Indicator */}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex-shrink-0 ${getStatusStyle(order.status)}`}>
                    {order.status}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}