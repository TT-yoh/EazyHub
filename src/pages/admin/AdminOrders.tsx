import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIncomingOrders()

    // Real-time listener to automatically update the dashboard when new orders stream in
    const adminOrdersChannel = supabase
      .channel('admin_orders_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchIncomingOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(adminOrdersChannel)
    }
  }, [])

  const fetchIncomingOrders = async () => {
    try {
      setLoading(true)
      
      // Pulls the order information and joins with your 'customers' table automatically
const { data, error } = await supabase
  .from('orders')
  .select(`
    *,
    customers!customer_id (
      name,
      email,
      phone
    )
  `)
  .order('created_at', { ascending: false })
      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error compiling admin order ledger:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500 font-medium">
        Loading master order records...
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Global Order Fulfillment</h1>
        <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100">
          Total Managed: {orders.length}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Order Ref</th>
                <th className="px-6 py-4">Customer Details</th>
                <th className="px-6 py-4">Fulfillment Destination</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                  {/* Order Number & Date */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-black text-gray-900 block">{order.order_number}</span>
                    <span className="text-xs text-gray-400 block mt-0.5">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </td>

                  {/* Update this specific cell inside your map function */}
<td className="px-6 py-4 whitespace-nowrap">
  <span className="font-bold text-gray-900 block">
    {order.customers?.name || 'Profile Not Found'}
  </span>
  <span className="text-xs text-gray-500 block">
    {order.customers?.email || 'N/A'}
  </span>
  <span className="text-xs text-gray-400 block">
    {order.customers?.phone || 'No Phone Registered'}
  </span>
</td>

                  {/* Delivery Location coordinates or pin text */}
                  <td className="px-6 py-4 max-w-xs">
                    <p className="text-gray-600 truncate leading-relaxed">
                      {order.delivery_location || 'No Location Provided'}
                    </p>
                  </td>

                  {/* Chosen payment tracking mechanism */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="uppercase text-xs bg-gray-100 font-bold px-2 py-1 border rounded text-gray-600 tracking-wide">
                      {order.payment_method}
                    </span>
                  </td>

                  {/* Value tracking pricing matrix */}
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                    ${(order.total_amount || 0).toFixed(2)}
                  </td>

                  {/* Operational order status badge configurations */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'dispatched' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>

                  {/* Link action targeting detail lookup page */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <Link
                      to={`/orders/${order.id}`}
                      className="inline-flex items-center text-xs font-bold bg-white hover:bg-gray-50 border border-gray-200 text-blue-600 px-3 py-1.5 rounded-xl shadow-sm transition-all"
                    >
                      Manage & Review →
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 font-semibold bg-gray-50/50">
                    No order transactions recorded in the cloud system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}