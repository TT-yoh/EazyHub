import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/ProductCard'

interface Product {
  id: string
  "Item No": string
  "Name": string
  "Unit": string
  "Excl VAT": number
  "Incl VAT": number
  stock: number
  company: number 
  image_url?: string
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const observerRef = useRef<HTMLDivElement | null>(null)
  const pageSize = 30

  // 1. Core Fetch Trigger
  useEffect(() => {
    setProducts([])
    setPage(0)
    setHasMore(true)
    setInitialLoad(true)
    fetchProducts(0, true)
  }, [search, companyFilter])

  useEffect(() => {
    if (page > 0) {
      fetchProducts(page, false)
    }
  }, [page])

  // 2. ⭐ REALTIME SYNC: Listen for live changes from the admin dashboard
  useEffect(() => {
    const channel = supabase
      .channel('public-products-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          // Instantly sync local states with updated image/data records
          setProducts(prev => 
            prev.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchProducts = async (pageNum: number, reset: boolean) => {
    setLoading(true)
    
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false }) 
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
    
    if (search.trim() !== '') {
      query = query.ilike('Name', `%${search.trim()}%`) 
    }
    
    if (companyFilter !== 'all') {
      query = query.eq('company', parseInt(companyFilter)) 
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching products:', error)
    } else {
      if (reset) {
        setProducts(data || [])
      } else {
        setProducts(prev => [...prev, ...(data || [])])
      }
      setHasMore((data?.length || 0) === pageSize)
    }
    
    setLoading(false)
    setInitialLoad(false)
  }

  const lastProductRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !initialLoad) {
        setPage(prev => prev + 1)
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [loading, hasMore, initialLoad])

  return (
    <div className="px-1 pb-12">
      {/* Search Input Sticky Container */}
      <div className="sticky top-[57px] bg-white z-20 pb-3 pt-1 shadow-sm">
        <input
          type="text"
          placeholder="🔍 Search products by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full text-base border border-gray-200 rounded-xl p-2.5 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Pill Filter Navigation Row */}
      <div className="flex gap-2 my-4 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setCompanyFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
            companyFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          All Products
        </button>
        <button
          onClick={() => setCompanyFilter('1')} 
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
            companyFilter === '1' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          ⛏️ Mineazy
        </button>
        <button
          onClick={() => setCompanyFilter('2')} 
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
            companyFilter === '2' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          🚜 Farmeazy
        </button>
      </div>

      {/* Dynamic Results Counter */}
      {!initialLoad && (
        <div className="text-xs font-bold text-gray-400 mb-3 ml-1">
          {products.length} Items Displayed
        </div>
      )}

      {/* Loading & Rendering States */}
      {initialLoad && products.length === 0 ? (
        <div className="text-center py-12 text-xs font-bold text-gray-400 animate-pulse">Loading items...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-xs font-bold text-gray-400 border border-dashed rounded-xl bg-gray-50">
          No matches found inside database criteria.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product, index) => (
            <div key={product.id} ref={index === products.length - 1 ? lastProductRef : null}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}

      {/* Scroll Footer Load Indicators */}
      {loading && products.length > 0 && (
        <div className="text-center py-6 text-xs font-bold text-blue-600 animate-pulse">Loading more items...</div>
      )}

      {!hasMore && products.length > 0 && (
        <div className="text-center py-8 text-xs font-bold text-gray-400">✓ All {products.length} products loaded</div>
      )}
    </div>
  )
}