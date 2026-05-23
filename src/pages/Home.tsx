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
  company: string
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

  const fetchProducts = async (pageNum: number, reset: boolean) => {
    setLoading(true)
    
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
    
    if (search) {
      query = query.ilike('"Name"', `%${search}%`)
    }
    
    if (companyFilter !== 'all') {
      query = query.eq('company', companyFilter)
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
    <div>
      <div className="sticky top-[57px] bg-white z-20 pb-3 pt-1 shadow-md">
  <input
    type="text"
    placeholder="🔍 Search products by name..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="input w-full text-base"
  />
</div>

      <div className="flex gap-2 my-4 overflow-x-auto pb-2">
        <button
          onClick={() => setCompanyFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            companyFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          All Products
        </button>
        <button
          onClick={() => setCompanyFilter('Mineazy')}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            companyFilter === 'Mineazy' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          ⛏️ Mineazy
        </button>
        <button
          onClick={() => setCompanyFilter('Farmeazy')}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            companyFilter === 'Farmeazy' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          🌾 Farmeazy
        </button>
      </div>

      {!initialLoad && (
        <div className="text-sm text-gray-500 mb-3">
          {products.length} product(s) found
        </div>
      )}

      {initialLoad && products.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-500">Loading products...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product, index) => (
            <div key={product.id} ref={index === products.length - 1 ? lastProductRef : null}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}

      {loading && products.length > 0 && (
        <div className="text-center py-8 text-gray-500">Loading more products...</div>
      )}

      {!hasMore && products.length > 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">✓ All {products.length} products loaded</div>
      )}
    </div>
  )
}