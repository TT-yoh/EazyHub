import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { supabase, GOOGLE_MAPS_API_KEY } from '../lib/supabase'
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api'

const DEFAULT_CENTER = { lat: -20.1406, lng: 28.5833 } // Coordinates default near Bulawayo
const MAP_CONTAINER_STYLE = { width: '100%', height: '350px' }
const MAP_OPTIONS = { disableDefaultUI: false, zoomControl: true, streetViewControl: false }

const MAP_LIBRARIES: ("places" | "geometry")[] = ['places'];

export default function Checkout() {
  const navigate = useNavigate()
  const { items, getSubtotal, clearCart } = useCartStore()
  const [loading, setLoading] = useState(false)
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('ecocash')
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState('')

  const [markerPosition, setMarkerPosition] = useState(DEFAULT_CENTER)
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)

  // Look for this block around line 26 in Checkout.tsx
  const { isLoaded, loadError } = useJsApiLoader({
  id: 'google-map-script',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY, // 👈 Clean and centralized!
})

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude }
          setMarkerPosition(currentCoords)
          setMapCenter(currentCoords)
          reverseGeocode(currentCoords.lat, currentCoords.lng)
        },
        () => console.warn('Browser GPS access denied. Utilizing default geographic map center.')
      )
    }
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return; }

      const { data: adminCheck } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (adminCheck) {
        alert('Admins cannot place marketplace purchase orders.')
        navigate('/admin/orders')
        return
      }

      let { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!customerData) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            id: user.id,
            email: user.email,
            name: '',
            phone: '',
            location: '',
            created_at: new Date().toISOString()
          })
          .select()
          .maybeSingle()
        customerData = newCustomer
      }

      if (customerData) {
        setProfile(customerData)
        if (customerData.location) setDeliveryLocation(customerData.location)
      }
    } catch (err) {
      setError('Failed to securely load customer profile options.')
    } finally {
      setProfileLoading(false)
    }
  }

  const reverseGeocode = (lat: number, lng: number) => {
    if (!window.google) return
    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        setDeliveryLocation(results[0].formatted_address)
      } else {
        setDeliveryLocation(`Coordinates Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      }
    })
  }

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const updatedCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() }
    setMarkerPosition(updatedCoords)
    reverseGeocode(updatedCoords.lat, updatedCoords.lng)
  }

  const subtotal = getSubtotal()
  const deliveryFee = 50
  const total = subtotal + deliveryFee

  const placeOrder = async () => {
    if (!deliveryLocation) {
      alert('Please specify your dispatch destination by placing a marker pin on the map.')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return; }

      const orderNumber = `EZ-${Date.now()}`
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: user.id,
          total_amount: total,
          payment_method: paymentMethod,
          delivery_location: deliveryLocation,
          delivery_fee: deliveryFee,
          delivery_lat: markerPosition.lat,
          delivery_lng: markerPosition.lng,
          status: 'pending',
          payment_status: 'pending'
        })
        .select()
        .single()

      if (orderError) throw orderError

      for (const item of items) {
        await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.product_id,
          company_name: item.company_name,
          quantity: item.quantity,
          price_at_time: item.price,
          status: 'pending'
        })
      }

      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .maybeSingle()
        
        if (product) {
          await supabase
            .from('products')
            .update({ stock: Math.max(0, product.stock - item.quantity) })
            .eq('id', item.product_id)
        }
      }

      clearCart()
      alert(`Order placed successfully! Order Reference: ${orderNumber}`)
      navigate('/orders')
    } catch (err) {
      alert('An error occurred while securing transactions.')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) return <div className="text-center py-12"><h2 className="text-xl font-bold">Cart is empty</h2></div>
  if (profileLoading) return <div className="text-center py-12">Loading checkout...</div>

  return (
    <div className="max-w-3xl mx-auto pb-20 px-2">
      <h1 className="text-2xl font-black text-gray-900 mb-6 tracking-tight">Checkout</h1>

      <div className="bg-gray-100 border rounded-xl p-4 mb-5 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase">Fulfillment Contact</div>
            <div className="font-bold text-gray-800 mt-0.5">{profile.name} <span className="text-gray-300 font-normal px-2">|</span> {profile.phone}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-5 shadow-sm">
        <h2 className="font-bold text-lg mb-3 tracking-tight">Order Summary</h2>
        <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto pr-2">
          {items.map((item) => (
            <div key={item.product_id} className="flex justify-between text-sm py-2.5">
              <span>{item.name} <span className="text-gray-400 font-mono text-xs ml-2">x{item.quantity}</span></span>
              <span className="font-semibold text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t space-y-2 text-sm text-gray-600">
          <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Delivery Fee</span><span>${deliveryFee.toFixed(2)}</span></div>
          <div className="flex justify-between font-black text-gray-900 text-lg pt-2 border-t border-dashed">
            <span>Total Cost Due</span><span className="text-blue-600">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-5 shadow-sm">
        <h2 className="font-bold text-lg mb-1">Delivery pinpoint geolocation</h2>
        <p className="text-xs text-gray-400 mb-4">Drag the marker exactly over your property destination point.</p>
        <div className="rounded-xl overflow-hidden border shadow-inner mb-4">
          {isLoaded ? (
            <GoogleMap mapContainerStyle={MAP_CONTAINER_STYLE} center={mapCenter} zoom={14} options={MAP_OPTIONS}>
              <MarkerF position={markerPosition} draggable={true} onDragEnd={handleMarkerDragEnd} />
            </GoogleMap>
          ) : <div className="h-[350px] w-full bg-gray-100 flex items-center justify-center text-gray-400">Loading map data...</div>}
        </div>
        <input type="text" readOnly value={deliveryLocation} className="input bg-gray-50 text-gray-600 text-sm border-gray-200" />
      </div>

      <div className="bg-white rounded-xl border p-5 mb-6 shadow-sm">
        <h2 className="font-bold text-lg mb-3">Payment Method</h2>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input text-sm">
          <option value="ecocash">EcoCash Channel</option>
          <option value="onemoney">OneMoney Gateway</option>
          <option value="innbucks">InnBucks API</option>
        </select>
      </div>

      <button onClick={placeOrder} disabled={loading} className="btn-primary w-full py-3.5 font-bold rounded-xl disabled:opacity-40">
        {loading ? 'Processing...' : `Confirm Checkout Order - $${total.toFixed(2)}`}
      </button>
    </div>
  )
}