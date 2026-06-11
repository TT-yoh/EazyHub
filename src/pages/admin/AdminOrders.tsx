import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

export default function AdminOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'delivery_fee'>('created_at')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    const checkAdminAndFetchOrders = async () => {
      try {
        setLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          navigate('/login')
          return
        }

        const { data: adminCheck, error: adminError } = await supabase
          .from('admin_users')
          .select('id, company_id')
          .eq('id', user.id)
          .maybeSingle()

        if (adminError) console.error("Admin validation breakdown:", adminError)

        if (!adminCheck) {
          toast.error("Unauthorized Access Channel. Redirecting...")
          navigate('/orders')
          return
        }

        const currentCompanyId = adminCheck.company_id

        // ⭐ TABLE EDIT: Joined the 'payments' table to fetch real-time success flags
        let query = supabase
          .from('orders')
          .select(`
            id,
            order_number,
            created_at,
            status,
            total_amount,
            delivery_fee,
            delivery_location,
            payment_method,
            customers (
              name,
              phone
            ),
            payments (
              status,
              reference
            ),
            order_items (
              id,
              quantity,
              price_at_time,
              products (
                Name,
                company
              )
            )
          `)

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter)
        }

        query = query.order(sortBy, { ascending: false })

        const { data: ordersData, error: ordersError } = await query
        if (ordersError) throw ordersError

        if (ordersData && currentCompanyId !== 3) {
          const filteredOrders = ordersData.filter(order => {
            const hasMineazy = order.order_items.some((item: any) => item.products?.company === 1)
            const hasFarmeazy = order.order_items.some((item: any) => item.products?.company === 2)
            
            if (currentCompanyId === 1 && hasMineazy) return true;
            if (currentCompanyId === 2 && hasFarmeazy) return true;
            return false;
          })
          setOrders(filteredOrders)
        } else {
          setOrders(ordersData || [])
        }

      } catch (err) {
        console.error("Failed loading corporate control queues:", err)
        toast.error("Error running secure order pipeline lookup queries.")
      } finally {
        setLoading(false)
      }
    }

    checkAdminAndFetchOrders()

    const globalAdminChannel = supabase
      .channel('admin_live_orders_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          checkAdminAndFetchOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(globalAdminChannel)
    }
  }, [statusFilter, sortBy, navigate])

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) throw error

      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ))
      toast.success('Order status updated!')
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border border-amber-100'
      case 'processing': return 'bg-blue-50 text-blue-700 border border-blue-100'
      case 'dispatched': return 'bg-purple-50 text-purple-700 border border-purple-100'
      case 'completed': return 'bg-green-50 text-green-700 border border-green-100'
      case 'cancelled': return 'bg-red-50 text-red-700 border border-red-100'
      default: return 'bg-gray-50 text-gray-700 border border-gray-200'
    }
  }

  if (loading) return <div className="text-center py-12 font-medium text-gray-500">Loading master logistics pipeline...</div>

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 px-4 pt-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-gray-100 pb-5 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Admin Fulfillment Terminal</h1>
          <p className="text-xs text-gray-400 mt-1">Manage cross-business dispatches for Mineazy and Farmeazy lines.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex flex-col flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter View</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-200 text-xs font-bold text-gray-700 rounded-xl p-2.5 outline-none shadow-sm cursor-pointer w-full"
            >
              <option value="all">All Submissions 📦</option>
              <option value="pending">Pending ⏳</option>
              <option value="processing">Processing ⚙️</option>
              <option value="dispatched">Dispatched 🚚</option>
              <option value="completed">Completed ✅</option>
              <option value="cancelled">Cancelled ❌</option>
            </select>
          </div>

          <div className="flex flex-col flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Priority Sorting</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-gray-200 text-xs font-bold text-blue-700 bg-blue-50/40 rounded-xl p-2.5 outline-none shadow-sm cursor-pointer w-full"
            >
              <option value="created_at">Sort by: Date Logged 📅</option>
              <option value="delivery_fee">Sort by: Delivery Fee Amount 🚚</option>
            </select>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-12 text-center text-sm font-medium text-gray-400">
          No active order entries found matching the selection query.
        </div>
      ) : (
        <div className="bg-transparent sm:bg-white sm:rounded-2xl sm:border sm:border-gray-100 sm:shadow-sm overflow-hidden">
          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead className="hidden sm:table-header-group">
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Order Ref</th>
                  <th className="py-4 px-6">Client Profile</th>
                  <th className="py-4 px-6">Target Waypoint</th>
                  <th className="py-4 px-6 text-center">Fulfillment Status</th>
                  <th className="py-4 px-6 text-right">Payment Link</th>
                  <th className="py-4 px-6 text-right">Statement Balance</th>
                  <th className="py-4 px-6 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="grid grid-cols-2 gap-2.5 p-1 sm:p-0 sm:table-row-group divide-y sm:divide-y divide-gray-50 text-sm">
                {orders.map((order) => {
                  const customerInfo: any = order.customers || {}
                  
                  // ⭐ TABLE EDIT: Check if a matching 'completed' transaction row exists
                  const isPaid = order.payments?.some((p: any) => p.status === 'completed')

                  return (
                    <tr key={order.id} className="flex flex-col sm:table-row bg-white border border-gray-200 sm:border-0 rounded-2xl p-3 sm:p-0 hover:bg-gray-50/40 transition-colors relative shadow-xs sm:shadow-none justify-between h-full text-xs sm:text-sm">
                      
                      <td className="py-1 sm:py-4 px-0 sm:px-6 flex flex-col items-start sm:flex-row sm:justify-between sm:items-center sm:table-cell pb-1.5 sm:pb-0 mb-1 sm:mb-0 border-b border-dashed border-gray-100 sm:border-0 w-full">
                        <span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Order Ref:</span>
                        <div className="text-left">
                          <span className="block font-black text-gray-900 leading-none">{order.order_number}</span>
                          <span className="block text-[9px] text-gray-400 font-mono mt-1 leading-tight">
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      <td className="py-1 sm:py-4 px-0 sm:px-6 flex flex-col items-start sm:flex-row sm:justify-between sm:items-center sm:table-cell w-full">
                        <span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Client Profile:</span>
                        <div className="text-left min-w-0 w-full">
                          <span className="block font-bold text-gray-800 truncate">{customerInfo.name || "Unnamed Buyer"}</span>
                          <span className="block text-[10px] text-gray-400 font-mono tracking-tight mt-0.5 truncate">{customerInfo.phone || "No Line"}</span>
                        </div>
                      </td>

                      <td className="py-1 sm:py-4 px-0 sm:px-6 flex flex-col items-start sm:flex-row sm:justify-between sm:items-center sm:table-cell max-w-none sm:max-w-xs sm:truncate w-full">
                        <span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Destination:</span>
                        <div className="text-left w-full min-w-0">
                          <span className="text-gray-600 font-medium text-[11px] block line-clamp-1" title={order.delivery_location}>
                            {order.delivery_location || "No Address Stated"}
                          </span>
                          <span className="inline-block mt-0.5 text-[8px] font-bold uppercase tracking-wide bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono leading-none">
                            {order.payment_method}
                          </span>
                        </div>
                      </td>

                      <td className="py-1.5 sm:py-4 px-0 sm:px-6 flex flex-col items-start sm:flex-row sm:justify-between sm:items-center sm:table-cell sm:text-center w-full">
                        <span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fulfillment Status:</span>
                        <select 
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          disabled={updatingId === order.id}
                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-1 rounded-md border outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 disabled:opacity-50 w-full sm:w-auto text-center ${getStatusBadge(order.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="dispatched">Dispatched</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>

                      {/* ⭐ TABLE EDIT: Renders active validation markers based on Sandbox syncs */}
                      <td className="py-1 sm:py-4 px-0 sm:px-6 flex flex-col items-start sm:flex-row sm:justify-between sm:items-center sm:table-cell sm:text-right w-full">
                        <span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Payment Ledger:</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border tracking-wide uppercase ${
                          isPaid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-100 animate-pulse'
                        }`}>
                          {isPaid ? '✅ Paid' : '💳 Unpaid'}
                        </span>
                      </td>

                      <td className="py-1 sm:py-4 px-0 sm:px-6 flex flex-col items-start sm:flex-row sm:justify-between sm:items-center sm:table-cell sm:text-right w-full">
                        <span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Statement Balance:</span>
                        <span className="font-black text-gray-900 tracking-tight text-[11px]">
                          ${((order.total_amount || 0) + (order.delivery_fee || 0)).toFixed(2)}
                        </span>
                      </td>

                      <td className="py-1 sm:py-4 px-0 sm:px-6 flex flex-col sm:table-cell text-center w-full mt-1.5 sm:mt-0 pt-2 sm:pt-4 border-t border-gray-100 sm:border-0">
                        <span className="sm:hidden text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Action:</span>
                        <Link
                          to={`/orders/${order.id}`}
                          className="inline-flex items-center justify-center text-[11px] font-bold text-blue-600 hover:text-white hover:bg-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 transition-all shadow-sm w-full sm:w-auto text-center"
                        >
                          Manage File →
                        </Link>
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}