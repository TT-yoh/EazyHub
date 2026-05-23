import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Order {
  id: string
  order_number: string
  total_amount: number
  status: string
  created_at: string
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('orders').select('*').eq('customer_id', user.id).order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    fetchOrders()
  }, [])

  if (loading) return <div className="text-center py-12">Loading orders...</div>
  if (orders.length === 0) return <div className="text-center py-12"><h2 className="text-xl font-bold mb-4">No orders</h2><Link to="/" className="btn-primary">Shop Now</Link></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>
      {orders.map(order => (
        <Link key={order.id} to={`/orders/${order.id}`} className="block bg-white rounded-lg shadow p-4 mb-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-mono text-sm text-gray-500">{order.order_number}</div>
              <div className="font-bold">${order.total_amount.toFixed(2)}</div>
              <div className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</div>
            </div>
            <div>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">{order.status}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}