import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
// 1. Imported Leaflet map tools and global stylesheet anchors
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
// 2. Imported toast notifications wrapper hook
import { toast } from 'react-hot-toast'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    // Check if user has administrative clear privileges
    const checkAdminStatus = async (userObj: any) => {
      if (!userObj) {
        setIsAdmin(false)
        return
      }

      try {
        const { data: adminCheck, error: adminError } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', userObj.id)
          .maybeSingle()

        if (adminError) console.error("Admin verification query failure:", adminError)
        
        if (adminCheck) {
          setIsAdmin(true)
        } else {
          setIsAdmin(false)
        }
      } catch (err) {
        console.error("Failed to run role check:", err)
        setIsAdmin(false)
      }
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Fetch current active session user
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          navigate('/login')
          return
        }

        // Run the admin check for the initial load
        await checkAdminStatus(user)

        // Fetch main order metadata
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .single()

        if (orderError) throw orderError
        setOrder(orderData)

        // Fetch line items
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', id)

        if (itemsError) throw itemsError

        if (!itemsData || itemsData.length === 0) {
          setItems([])
          return
        }

        const productIds = itemsData.map(item => item.product_id).filter(Boolean)

        // Fetch details directly from 'products' table using case-sensitive column 'Name'
        const { data: productsCatalog, error: catalogError } = await supabase
          .from('products')
          .select('id, Name')
          .in('id', productIds)

        if (catalogError) throw catalogError

        const formattedItems = itemsData.map(item => {
          const matchedProduct = productsCatalog?.find(p => p.id === item.product_id)
          return {
            ...item,
            products: matchedProduct ? { name: matchedProduct.Name } : { name: 'Unknown Product' }
          }
        })

        setItems(formattedItems)
      } catch (error) {
        console.error("Critical error mapping client order profiles:", error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchData()

      // AUTH LISTENER: Listens to the exact moment a user signs in/out
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

      // REALTIME CHANNEL SUBSCRIPTION: Stream database status shifts safely
      const orderChannel = supabase
        .channel(`live_order_${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${id}`
          },
          (payload) => {
            // ⭐ SAFE STATUS REWRITE: Avoid interfering with an active admin dropdown state
            setOrder((prev: any) => {
              if (!prev) return null
              if (isAdmin) return prev // Keep admin local state intact
              return { ...prev, status: payload.new.status }
            })
          }
        )
        .subscribe()

      return () => {
        authSubscription.unsubscribe()
        supabase.removeChannel(orderChannel)
      }
    }
  }, [id, navigate, isAdmin])

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error

      setOrder((prev: any) => ({ ...prev, status: newStatus }))
      
      // ⭐ Updated to Toast success notification
      toast.success(`Order status updated to: ${newStatus.toUpperCase()}`)
    } catch (err) {
      console.error("Failed to commit database status update:", err)
      // ⭐ Updated to Toast error notification
      toast.error("Failed to commit status update to the server.")
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="text-center py-12 font-medium text-gray-500">Loading order configurations...</div>
  if (!order) return <div className="text-center py-12 font-medium text-gray-500">Target order file not found.</div>

  // Parse location coordinate fields cleanly
  const hasCoordinates = order.delivery_lat && order.delivery_lng
  const mapPosition: [number, number] = [Number(order.delivery_lat || 0), Number(order.delivery_lng || 0)]

  return (
    <div className="max-w-2xl mx-auto pb-20 px-4 pt-6">
      {/* Dynamic Back Link Routing */}
      <Link 
        to={isAdmin ? "/admin/orders" : "/orders"} 
        className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors mb-4"
      >
        ← Back to Order Dashboard
      </Link>
      
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-gray-100 pb-5 mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Order Ref: {order.order_number}</h1>
            <div className="text-xs font-medium text-gray-400 mt-1">
              Transaction Date: {new Date(order.created_at).toLocaleString()}
            </div>
          </div>
          <div className="text-sm font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 self-start">
            Method: <span className="uppercase text-gray-800 font-bold">{order.payment_method}</span>
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
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Purchased Manifest Items</div>
          <div className="divide-y divide-gray-100 bg-gray-50/50 rounded-xl border px-4 border-gray-100">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-3.5 text-sm">
                <div className="font-medium text-gray-800">
                  {item.products?.name} 
                  <span className="text-gray-400 font-mono text-xs ml-2 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                    x{item.quantity}
                  </span>
                </div>
                <div className="font-bold text-gray-900">
                  ${((item.price_at_time || 0) * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ⭐ Logistic Pin Coordinates Map Layer Component Display */}
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
                scrollWheelZoom={false} // Halts zooming maps when navigating through mouse cursor page wheel spans
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

        <div className="flex justify-between items-center font-black text-xl mt-6 pt-5 border-t border-dashed border-gray-200">
          <span className="text-gray-800 text-base font-bold">Total Statement Balance</span>
          <span className="text-blue-600 tracking-tight">${(order.total_amount || 0).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}