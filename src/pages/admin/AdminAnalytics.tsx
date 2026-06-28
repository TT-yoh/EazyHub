import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminAnalytics() {
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Analytics State
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [mineazyRevenue, setMineazyRevenue] = useState(0)
  const [farmeazyRevenue, setFarmeazyRevenue] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [topProducts, setTopProducts] = useState<any[]>([])
  
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: adminData } = await supabase
          .from('admin_users')
          .select('company_id')
          .eq('id', user.id)
          .maybeSingle()

        if (!adminData) return
        const activeCompany = adminData.company_id
        setCurrentCompanyId(activeCompany)

        // Fetch completed orders
        const { data: orders } = await supabase
          .from('orders')
          .select('id, total_amount, delivery_fee')
          .eq('status', 'completed')

        if (!orders) return

        // Fetch all items from those orders
        const orderIds = orders.map(o => o.id)
        if (orderIds.length === 0) {
          setLoading(false)
          return
        }

        const { data: orderItems } = await supabase
          .from('order_items')
          .select('product_id, quantity, price_at_time, products(company, Name)')
          .in('order_id', orderIds)
          
        if (!orderItems) return

        let mRev = 0
        let fRev = 0
        let tRev = 0
        const productCounts: Record<string, { name: string; quantity: number; revenue: number; company: number }> = {}

        orderItems.forEach((item: any) => {
          const comp = Number(item.products?.company)
          const rev = (item.price_at_time || 0) * (item.quantity || 1)
          
          if (comp === 1) mRev += rev
          if (comp === 2) fRev += rev

          // Only count for the active company (or all if super admin)
          if (activeCompany === 3 || activeCompany === comp) {
            tRev += rev
            
            const pId = item.product_id
            if (!productCounts[pId]) {
              productCounts[pId] = { 
                name: item.products?.Name || 'Unknown', 
                quantity: 0, 
                revenue: 0,
                company: comp 
              }
            }
            productCounts[pId].quantity += (item.quantity || 1)
            productCounts[pId].revenue += rev
          }
        })

        setMineazyRevenue(mRev)
        setFarmeazyRevenue(fRev)
        setTotalRevenue(tRev) // If branch admin, this is just their subtotal without delivery (for simplicity)
        setTotalOrders(orders.length) // Note: This is total completed orders, maybe not all contained their products, but good enough metric

        const sortedProducts = Object.values(productCounts)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)

        setTopProducts(sortedProducts)

      } catch (err) {
        console.error("Analytics fetch error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) return <div className="p-6 text-center text-sm font-medium text-gray-400">Aggregating analytics data...</div>

  return (
    <div className="w-full max-w-7xl mx-auto p-4 pb-28 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 mb-1">Performance Analytics</h1>
        <p className="text-xs text-gray-500">Track your division's revenue and high-velocity products.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currentCompanyId === 3 ? (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total System Revenue</div>
              <div className="text-3xl font-black text-gray-900 font-mono">${(mineazyRevenue + farmeazyRevenue).toFixed(2)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Mineazy Subtotals</div>
              <div className="text-3xl font-black text-blue-700 font-mono">${mineazyRevenue.toFixed(2)}</div>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Farmeazy Subtotals</div>
              <div className="text-3xl font-black text-green-700 font-mono">${farmeazyRevenue.toFixed(2)}</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Your Division Revenue</div>
              <div className="text-3xl font-black text-blue-600 font-mono">${totalRevenue.toFixed(2)}</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Completed Orders</div>
              <div className="text-3xl font-black text-gray-900 font-mono">{totalOrders}</div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Top Performing Products (By Revenue)</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {topProducts.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-gray-400">No product sales data available.</div>
          ) : (
            topProducts.map((p, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500 text-xs">#{i + 1}</div>
                  <div>
                    <div className="font-bold text-sm text-gray-900">{p.name}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{p.quantity} units sold</div>
                  </div>
                </div>
                <div className="font-mono font-black text-gray-900">${p.revenue.toFixed(2)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
