import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { supabase, GOOGLE_MAPS_API_KEY } from '../lib/supabase'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { toast } from 'react-hot-toast'

const DEFAULT_CENTER = { lat: -20.1406, lng: 28.5833 } 
const MAP_CONTAINER_STYLE = { width: '100%', height: '350px' }

const MAP_OPTIONS = { 
  disableDefaultUI: false, 
  zoomControl: true, 
  streetViewControl: false,
  mapId: "DEMO_MAP_ID" // 🏢 Required token to authorize Advanced HTML Markers natively
}

// ========================================================
// GUARANTEED DRAGGABLE NATIVE ADVANCED MARKER
// ========================================================
function CustomAdvancedMarker({ 
  position, 
  map, 
  onDragEnd 
}: { 
  position: google.maps.LatLngLiteral; 
  map?: google.maps.Map | null; 
  onDragEnd: (e: google.maps.MapMouseEvent) => void 
}) {
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !window.google) return;

    let nativeMarker: any = null;
    let listener: any = null;

    async function initDraggableMarker() {
      try {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
        
        nativeMarker = new AdvancedMarkerElement({
          map,
          position,
          gmpDraggable: true, 
        });

        markerRef.current = nativeMarker;

        listener = nativeMarker.addListener('dragend', (e: any) => {
          if (e.latLng) {
            onDragEnd({ latLng: { lat: () => e.latLng.lat(), lng: () => e.latLng.lng() } } as any);
          }
        });
      } catch (err) {
        console.error("Failed to safely import the Advanced Marker engine library:", err);
      }
    }

    initDraggableMarker();

    return () => {
      if (nativeMarker) nativeMarker.map = null;
      if (listener) listener.remove();
      markerRef.current = null;
    };
  }, [map]); 

  // Reactive Position Sync (Crucial for snapping back to current GPS location)
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = position;
    }
  }, [position]);

  return null;
}

// ========================================================
// MAIN CHECKOUT PANEL COMPONENT
// ========================================================
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
  const [fetchingGPS, setFetchingGPS] = useState(false) // ⏳ Loading state for GPS button

  // Capture underlying active map layout instance reference context
  const [activeMapRef, setActiveMapRef] = useState<google.maps.Map | null>(null)

  // Dynamic Logistics State
  const [logistics, setLogistics] = useState({ basePrice: 5.00, pricePerKm: 1.50 })
  const [distance, setDistance] = useState(0)
  const [deliveryFee, setDeliveryFee] = useState(0)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  // 1. Load Profile & Fetch Dynamic Admin Pricing on Mount
  useEffect(() => {
    loadProfile()
    fetchPricingMatrix()
  }, [])

  const fetchPricingMatrix = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('meta_key, meta_value')
        .in('meta_key', ['delivery_base_price', 'delivery_price_per_km'])
      
      if (data) {
        const base = data.find(r => r.meta_key === 'delivery_base_price')?.meta_value
        const perKm = data.find(r => r.meta_key === 'delivery_price_per_km')?.meta_value
        
        setLogistics({
          basePrice: base ? Number(base) : 5.00,
          pricePerKm: perKm ? Number(perKm) : 1.50
        })
      }
    } catch (err) {
      console.warn('Failed to load dynamic pricing. Utilizing fallbacks.')
    }
  }

  // ⭐ DEDICATED FUNCTION TO TRIGGER AND FETCH CURRENT DEVICE GEOLOCATION
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      toast.error('Your web browser does not support physical GPS location routing.')
      return
    }

    setFetchingGPS(true)
    const gpsToast = toast.loading('Pinging satellite network for local coordinates...')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude }
        
        // Update states to snap map view and marker back onto user
        setMarkerPosition(currentCoords)
        setMapCenter(currentCoords)
        reverseGeocode(currentCoords.lat, currentCoords.lng)
        
        // Force the map viewport canvas to pan dynamically to the new location
        if (activeMapRef) {
          activeMapRef.panTo(currentCoords)
        }

        toast.success('Location locked successfully!', { id: gpsToast })
        setFetchingGPS(false)
      },
      (error) => {
        console.warn(error)
        toast.error('GPS Access Denied. Check your browser location permissions.', { id: gpsToast })
        setFetchingGPS(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // 2. Map Geolocation Initialization on Mount
  useEffect(() => {
    // Silently locate on load, but let the user manually override using the new button later
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

  // 3. The Reactive Haversine Calculation Engine
  useEffect(() => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (markerPosition.lat - DEFAULT_CENTER.lat) * (Math.PI / 180)
    const dLon = (markerPosition.lng - DEFAULT_CENTER.lng) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(DEFAULT_CENTER.lat * (Math.PI / 180)) * Math.cos(markerPosition.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    
    const distanceKm = Number((R * c).toFixed(2))
    const calculatedFee = Number((logistics.basePrice + (distanceKm * logistics.pricePerKm)).toFixed(2))

    setDistance(distanceKm)
    setDeliveryFee(calculatedFee)
  }, [markerPosition, logistics])

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
        toast.error('Admins cannot place marketplace purchase orders.')
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
      toast.error('Failed to securely load customer profile options.')
    } finally {
      setProfileLoading(false)
    }
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!window.google) return
    
    try {
      const { Geocoder } = await google.maps.importLibrary("geocoding") as google.maps.GeocodingLibrary;
      const geocoder = new Geocoder()
      
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          setDeliveryLocation(results[0].formatted_address)
        } else {
          setDeliveryLocation(`Coordinates Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
      })
    } catch (err) {
      console.error("Geocoding network loader failure:", err)
      setDeliveryLocation(`Coordinates Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    }
  }

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const updatedCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() }
    setMarkerPosition(updatedCoords)
    reverseGeocode(updatedCoords.lat, updatedCoords.lng)
  }

  const subtotal = getSubtotal()
  const total = subtotal + deliveryFee

  const placeOrder = async () => {
    if (!deliveryLocation) {
      toast.error('Please specify your destination by dropping a waypoint marker map pin.')
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
          total_amount: subtotal, 
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

      const orderItemsPayload = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: Number(item.quantity),
        price_at_time: Number(item.price)
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload)

      if (itemsError) throw itemsError

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
      toast.success(`Invoice created! Routing to Payment Sandbox Terminal...`)
      navigate(`/payment/sandbox/${order.id}`)

    } catch (err: any) {
      console.error("Checkout process crash details:", err)
      toast.error(`Transaction Rejected: ${err.message || 'Check database configurations.'}`)
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
            <div className="font-bold text-gray-800 mt-0.5">{profile?.name || 'Name not configured'} <span className="text-gray-300 font-normal px-2">|</span> {profile?.phone || 'No active phone'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-5 shadow-sm">
        {/* MODIFIED HEADER WITH FLOATING SATELLITE BUTTON LINK */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h2 className="font-bold text-lg mb-0.5">Delivery pinpoint geolocation</h2>
            <p className="text-xs text-gray-400">Drag the marker exactly over your property destination point.</p>
          </div>
          
          {/* ⭐ THE NEW BUTTON TOOLKIT LAYOUT ITEM */}
          <button
            type="button"
            onClick={handleLocateUser}
            disabled={fetchingGPS}
            className="w-full sm:w-auto px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold border border-blue-100 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
          >
            {fetchingGPS ? 'Locating...' : '📍 Use Current Location'}
          </button>
        </div>

        <div className="rounded-xl overflow-hidden border shadow-inner mb-4">
          {isLoaded ? (
            <GoogleMap 
              mapContainerStyle={MAP_CONTAINER_STYLE} 
              center={mapCenter} 
              zoom={14} 
              options={MAP_OPTIONS}
              onLoad={(map) => setActiveMapRef(map)} 
              onUnmount={() => setActiveMapRef(null)}
            >
              <CustomAdvancedMarker 
                position={markerPosition} 
                map={activeMapRef} 
                onDragEnd={handleMarkerDragEnd} 
              />
            </GoogleMap>
          ) : <div className="h-[350px] w-full bg-gray-100 flex items-center justify-center text-gray-400">Loading map data...</div>}
        </div>
        <input type="text" readOnly value={deliveryLocation} className="w-full p-3 bg-gray-50 text-gray-600 text-sm border border-gray-200 rounded-xl outline-none" />
      </div>

      {distance > 0 && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-sm flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">
              🚚 Dispatch Logistics Route
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Calculated road-line distance from base hub warehouse:
            </p>
          </div>
          <div className="text-right">
            <span className="block font-mono text-base font-black text-blue-900">{distance} KM</span>
          </div>
        </div>
      )}

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
          <div className="flex justify-between font-medium text-blue-600">
            <span>Fixed Delivery Fee</span>
            <span>${deliveryFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-black text-gray-900 text-lg pt-2 border-t border-dashed">
            <span>Total Cost Due</span><span className="text-blue-600">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-6 shadow-sm">
        <h2 className="font-bold text-lg mb-3">Payment Method</h2>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-3 text-sm bg-white border rounded-xl outline-none border-gray-200 cursor-pointer font-semibold text-gray-800">
          <option value="EcoCash">EcoCash Channel</option>
          <option value="OneMoney">OneMoney Gateway</option>
          <option value="InnBucks">InnBucks API</option>
        </select>
      </div>

      <button onClick={placeOrder} disabled={loading} className="w-full py-4 text-sm font-black tracking-wide text-white bg-blue-600 hover:bg-blue-700 transition-all rounded-xl disabled:opacity-40 shadow-sm active:scale-[0.99]">
        {loading ? 'Processing...' : `Confirm Checkout Order - $${total.toFixed(2)}`}
      </button>
    </div>
  )
}