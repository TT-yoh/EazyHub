import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/ProductCard'
import { useInfiniteQuery } from '@tanstack/react-query'

interface Product {
  id: string
  "Item No": string
  "Name": string
  "Unit": string
  "Excl VAT": number
  "Incl VAT": number
  stock: number
  company: number 
  Company?: number
  company_id?: number
  image_url?: string
  created_at?: string
}

export default function Home() {
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const pageSize = 30
  
  const observerRef = useRef<IntersectionObserver | null>(null)

  // ========================================================
  // ⭐ SERVER-SIDE PAGINATED QUERY ENGINE (REACT QUERY)
  // ========================================================
  const fetchProducts = async ({ pageParam = 0, queryKey }: any) => {
    const [_key, searchTerm, filter] = queryKey;
    const from = pageParam * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (filter !== 'all') {
      // In the original, it fell back to 1. Let's strictly filter by the 'company' column.
      query = query.eq('company', filter);
    }

    if (searchTerm.trim() !== '') {
      query = query.or(`Name.ilike.%${searchTerm}%,Item No.ilike.%${searchTerm}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    return {
      data: data as Product[],
      nextPage: data && data.length === pageSize ? pageParam + 1 : undefined,
      totalCount: count || 0,
    };
  };

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch
  } = useInfiniteQuery({
    queryKey: ['products', search, companyFilter],
    queryFn: fetchProducts,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  })

  // ========================================================
  // ⭐ REALTIME SYNC (TRIGGER REFETCH INSTEAD OF LOCAL MUTATION)
  // ========================================================
  useEffect(() => {
    const channel = supabase
      .channel('public-products-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        () => refetch() // Smart background refetching via React Query
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])

  // ========================================================
  // ⚡ INFINITE SCROLL OBSERVER
  // ========================================================
  const lastProductRef = useCallback((node: HTMLDivElement | null) => {
    if (isFetchingNextPage) return
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage()
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [isFetchingNextPage, hasNextPage, fetchNextPage])

  const products = data ? data.pages.flatMap(page => page.data) : []
  const totalCount = data?.pages[0]?.totalCount || 0

  if (status === 'error') {
    return <div className="text-center py-12 text-red-600 font-bold">Failed to load products: {(error as Error).message}</div>
  }

  return (
    <div className="px-1 pb-12">
      {/* Search Input Sticky Container */}
      <div className="sticky top-[57px] bg-white z-20 pb-3 pt-1 shadow-sm">
        <input
          type="text"
          placeholder="🔍 Search products by name or SKU..."
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
            companyFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Products
        </button>
        <button
          onClick={() => setCompanyFilter('1')} 
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
            companyFilter === '1' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-100'
          }`}
        >
          ⛏️ Mineazy
        </button>
        <button
          onClick={() => setCompanyFilter('2')} 
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
            companyFilter === '2' ? 'bg-green-600 text-white shadow-md' : 'bg-green-50 text-green-800 hover:bg-green-100 border border-green-100'
          }`}
        >
          🚜 Farmeazy
        </button>
      </div>

      {/* Dynamic Results Counter */}
      {status === 'success' && (
        <div className="text-xs font-bold text-gray-400 mb-3 ml-1 flex justify-between">
          <span>{totalCount} Items Found</span>
          {search && <span className="text-blue-600 cursor-pointer" onClick={() => setSearch('')}>Clear Search ✕</span>}
        </div>
      )}

      {/* Loading & Rendering States */}
      {status === 'pending' ? (
        <div className="text-center py-12 text-xs font-bold text-gray-400 animate-pulse">Loading secure storefront...</div>
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
      {isFetchingNextPage && (
        <div className="text-center py-6 text-xs font-bold text-blue-600 animate-pulse">Loading more items...</div>
      )}

      {!hasNextPage && products.length > 0 && (
        <div className="text-center py-8 text-xs font-bold text-gray-400">✓ All {totalCount} matched products loaded</div>
      )}
    </div>
  )
}