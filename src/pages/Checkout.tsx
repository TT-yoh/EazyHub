import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

const DEFAULT_CENTER = { lat: -20.1406, lng: 28.5833 }

function RecenterMap({ position }: { position: { lat: number, lng: number } }) {
  const map = useMap()
  useEffect(() => { map.panTo([position.lat, position.lng]) }, [position, map])
  return null
}

export default function Checkout() {
  const navigate = useNavigate()
  const { items, getSubtotal, clearCart } = useCartStore()
  const [loading, setLoading] = useState(false)
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('ecocash')
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [markerPosition, setMarkerPosition] = useState(DEFAULT_CENTER)
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)
  const [fetchingGPS, setFetchingGPS] = useState(false)
  
  const [logistics, setLogistics] = useState({
    mineazy: { basePrice: 15.00, pricePerKm: 2.50 },
    farmeazy: { basePrice: 5.00, pricePerKm: 1.00 }
  })
  
  const [distance, setDistance] = useState(0)
  const [deliveryFees, setDeliveryFees] = useState({ mineazy: 0, farmeazy: 0, total: 0 })

  // ⚡ BLAZING FAST PARALLEL CHECKOUT INIT
  useEffect(() => {
    const initializeCheckout = async () => {
      setProfileLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/login')

        // Fetch everything at once!
        const [adminRes, customerRes, settingsRes] = await Promise.all([
          supabase.from('admin_users').select('id').eq('id', user.id).maybeSingle(),
          supabase.from('customers').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('app_settings').select('meta_key, meta_value').in('meta_key', ['mineazy_base_price', 'mineazy_price_per_km', 'farmeazy_base_price', 'farmeazy_price_per_km'])
        ])

        if (adminRes.data) {
          toast.error('Admins cannot place marketplace purchase orders.')
          return navigate('/admin/orders')
        }

        // Handle Customer Profile
        let customerData = customerRes.data
        if (!customerData) {
          const { data: newCustomer } = await supabase.from('customers').insert({ id: user.id, email: user.email, name: '', phone: '', location: '', created_at: new Date().toISOString() }).select().maybeSingle()
          customerData = newCustomer
        }
        if (customerData) {
          setProfile(customerData)
          if (customerData.location) setDeliveryLocation(customerData.location)
        }

        // Handle Settings
        if (settingsRes.data) {
          const mBase = settingsRes.data.find(r => r.meta_key === 'mineazy_base_price')?.meta_value
          const mKm = settingsRes.data.find(r => r.meta_key === 'mineazy_price_per_km')?.meta_value
          const fBase = settingsRes.data.find(r => r.meta_key === 'farmeazy_base_price')?.meta_value
          const fKm = settingsRes.data.find(r => r.meta_key === 'farmeazy_price_per_km')?.meta_value
          setLogistics({
            mineazy: { basePrice: mBase ? Number(mBase) : 15.00, pricePerKm: mKm ? Number(mKm) : 2.50 },
            farmeazy: { basePrice: fBase ? Number(fBase) : 5.00, pricePerKm: fKm ? Number(fKm) : 1.00 }
          })
        }
      } catch (err) {
        console.error("Fast init error:", err)
      } finally {
        setProfileLoading(false)
      }
    }
    initializeCheckout()
  }, [navigate])

  const handleLocateUser = () => {
    if (!navigator.geolocation) { toast.error('Your browser does not support GPS routing.'); return; }
    setFetchingGPS(true)
    const gpsToast = toast.loading('Pinging satellite network...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude }
        setMarkerPosition(currentCoords); setMapCenter(currentCoords); reverseGeocode(currentCoords.lat, currentCoords.lng);
        toast.success('Location locked successfully!', { id: gpsToast })
        setFetchingGPS(false)
      },
      () => { toast.error('GPS Access Denied.', { id: gpsToast }); setFetchingGPS(false) },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude }
          setMarkerPosition(currentCoords); setMapCenter(currentCoords); reverseGeocode(currentCoords.lat, currentCoords.lng);
        }, () => {}
      )
    }
  }, [])

  useEffect(() => {
    const R = 6371
    const dLat = (markerPosition.lat - DEFAULT_CENTER.lat) * (Math.PI / 180)
    const dLon = (markerPosition.lng - DEFAULT_CENTER.lng) * (Math.PI / 180)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(DEFAULT_CENTER.lat * (Math.PI / 180)) * Math.cos(markerPosition.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distanceKm = Number((R * c).toFixed(2))
    
    setDistance(distanceKm)

    const hasMineazy = items.some(i => String(i.company_name || '').toLowerCase().includes('mineazy'))
    const hasFarmeazy = items.some(i => String(i.company_name || '').toLowerCase().includes('farmeazy'))

    const mFee = hasMineazy ? Number((logistics.mineazy.basePrice + (distanceKm * logistics.mineazy.pricePerKm)).toFixed(2)) : 0
    const fFee = hasFarmeazy ? Number((logistics.farmeazy.basePrice + (distanceKm * logistics.farmeazy.pricePerKm)).toFixed(2)) : 0

    setDeliveryFees({ mineazy: mFee, farmeazy: fFee, total: Number((mFee + fFee).toFixed(2)) })
  }, [markerPosition, logistics, items])

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const data = await response.json()
      if (data && data.display_name) {
        setDeliveryLocation(data.display_name)
      } else {
        setDeliveryLocation(`Coordinates Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      }
    } catch (err) { setDeliveryLocation(`Coordinates Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`) }
  }

  const markerRef = useRef<L.Marker>(null)
  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current
      if (marker != null) {
        const position = marker.getLatLng()
        const updatedCoords = { lat: position.lat, lng: position.lng }
        setMarkerPosition(updatedCoords)
        reverseGeocode(updatedCoords.lat, updatedCoords.lng)
      }
    },
  }), [])

  const subtotal = getSubtotal()
  const total = subtotal + deliveryFees.total

  const placeOrder = async () => {
    if (!deliveryLocation) { toast.error('Please specify your destination by dropping a waypoint marker map pin.'); return }
    setLoading(true)
    const initToast = toast.loading('Initializing secure Paynow checkout...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return; }

      const orderNumber = `EZ-${Date.now()}`
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({ order_number: orderNumber, customer_id: user.id, total_amount: subtotal, payment_method: paymentMethod, delivery_location: deliveryLocation, delivery_fee: deliveryFees.total, delivery_lat: markerPosition.lat, delivery_lng: markerPosition.lng, status: 'pending', payment_status: 'pending' })
        .select().single()

      if (orderError) throw orderError

      const orderItemsPayload = items.map(item => ({ order_id: order.id, product_id: item.product_id, quantity: Number(item.quantity), price_at_time: Number(item.price) }))
      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload)
      if (itemsError) throw itemsError

      clearCart()

      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('paynow-checkout', { body: { orderId: order.id, amount: total, customerEmail: user.email || 'guest@eazyhub.com' } })
      if (edgeError) throw edgeError

      if (edgeData && edgeData.success && edgeData.redirectUrl) {
        toast.success('Redirecting to Paynow Secure Gateway...', { id: initToast })
        window.location.href = edgeData.redirectUrl
      } else throw new Error(edgeData?.error || "Invalid response from Paynow Gateway")

    } catch (err: any) {
      toast.error(`Transaction Rejected: ${err.message || 'Check network connection.'}`, { id: initToast })
      setLoading(false)
    }
  }

  if (items.length === 0) return <div className="text-center py-12"><h2 className="text-xl font-bold">Cart is empty</h2></div>
  if (profileLoading) return <div className="text-center py-12 text-sm text-gray-500 animate-pulse font-bold">Booting Checkout Engine...</div>

  return (
    <div className="max-w-3xl mx-auto pb-20 px-2">
      <h1 className="text-2xl font-black text-gray-900 mb-6 tracking-tight">Checkout</h1>

      <div className="bg-gray-100 border rounded-xl p-4 mb-5 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase">Fulfillment Contact</div>
            <div className="font-bold text-gray-800 mt-0.5">{profile?.name || 'Name not configured'} <span className="text-gray-300 font-normal px-2">|</span> {profile?.phone || 'No active phone'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h2 className="font-bold text-lg mb-0.5">Delivery pinpoint geolocation</h2>
            <p className="text-xs text-gray-400">Drag the marker exactly over your property destination point.</p>
          </div>
          <button type="button" onClick={handleLocateUser} disabled={fetchingGPS} className="w-full sm:w-auto px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold border border-blue-100 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95">
            {fetchingGPS ? 'Locating...' : '📍 Use Current Location'}
          </button>
        </div>

        <div className="rounded-xl overflow-hidden border shadow-inner mb-4 h-[350px] relative z-0">
          <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={14} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker 
              position={[markerPosition.lat, markerPosition.lng]} 
              draggable={true} 
              eventHandlers={eventHandlers} 
              ref={markerRef} 
            />
            <RecenterMap position={mapCenter} />
          </MapContainer>
        </div>
        <input type="text" readOnly value={deliveryLocation} className="w-full p-3 bg-gray-50 text-gray-600 text-sm border border-gray-200 rounded-xl outline-none" />
      </div>

      {distance > 0 && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-sm flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">🚚 Dispatch Logistics Route</h3>
            <p className="text-xs text-gray-500 mt-0.5">Calculated road-line distance from base hub warehouse:</p>
          </div>
          <div className="text-right">
            <span className="block font-mono text-base font-black text-blue-900">{distance} KM</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border p-5 mb-5 shadow-sm">
        <h2 className="font-bold text-lg mb-3 tracking-tight">Order Summary</h2>
        <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto pr-2">
          {items.map((item) => {
            const companyString = String(item.company_name || '').toLowerCase();
            const isMineazy = companyString.includes('mineazy');
            const isFarmeazy = companyString.includes('farmeazy');
            const badgeLabel = isMineazy ? '⛏️ Mineazy Equipment' : isFarmeazy ? '🚜 Farmeazy Agline' : (item.company_name || '📦 EazyHub System');
            const badgeColor = isMineazy ? 'text-blue-600 bg-blue-50' : isFarmeazy ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50';

            return (
              <div key={item.product_id} className="flex justify-between items-center text-sm py-3">
                <div className="flex flex-col gap-1">
                  <div className="font-medium text-gray-800">
                    {item.name} <span className="text-gray-400 font-mono text-xs ml-1">x{item.quantity}</span>
                  </div>
                  <span className={`inline-block self-start px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeColor}`}>
                    {badgeLabel}
                  </span>
                </div>
                <span className="font-bold text-gray-900 font-mono">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t space-y-2 text-sm text-gray-600">
          <div className="flex justify-between mb-3">
            <span>Items Subtotal</span>
            <span className="font-mono text-gray-800">${subtotal.toFixed(2)}</span>
          </div>
          
          {deliveryFees.mineazy > 0 && (
            <div className="flex justify-between font-bold text-blue-600 bg-blue-50/50 p-2 rounded-lg">
              <span>⛏️ Mineazy Heavy Dispatch</span>
              <span className="font-mono text-blue-800">+ ${deliveryFees.mineazy.toFixed(2)}</span>
            </div>
          )}

          {deliveryFees.farmeazy > 0 && (
            <div className="flex justify-between font-bold text-green-600 bg-green-50/50 p-2 rounded-lg">
              <span>🚜 Farmeazy Agri Dispatch</span>
              <span className="font-mono text-green-800">+ ${deliveryFees.farmeazy.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between items-end pt-3 mt-2 border-t border-dashed">
            <span className="font-black text-gray-900 text-lg">Total Cost Due</span>
            <span className="text-blue-600 font-black text-xl font-mono">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-6 shadow-sm">
        <h2 className="font-bold text-lg mb-3">Payment Method</h2>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-3 text-sm bg-white border rounded-xl outline-none border-gray-200 cursor-pointer font-semibold text-gray-800 focus:border-blue-500">
          <option value="EcoCash">📱 EcoCash Channel</option>
          <option value="OneMoney">📱 OneMoney Gateway</option>
          <option value="InnBucks">💸 InnBucks API</option>
          <option value="Visa">💳 Visa / Mastercard</option>
        </select>
      </div>

      <button onClick={placeOrder} disabled={loading} className="w-full py-4 text-sm font-black tracking-wide text-white bg-blue-600 hover:bg-blue-700 transition-all rounded-xl disabled:opacity-40 shadow-sm active:scale-[0.99]">
        {loading ? 'Routing to Secure Paynow Server...' : `Proceed to Secure Checkout - $${total.toFixed(2)}`}
      </button>
    </div>
  )
}