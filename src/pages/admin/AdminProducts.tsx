import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  
  const observerRef = useRef<HTMLDivElement | null>(null)
  const pageSize = 24

  useEffect(() => { fetchProducts(page) }, [page])

  const fetchProducts = async (pageNum: number) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1) // Handles deep database paginated queries
    
    if (!error) {
      setProducts(prev => pageNum === 0 ? (data || []) : [...prev, ...(data || [])])
      setHasMore((data?.length || 0) === pageSize)
    }
    setLoading(false)
  }

  const lastProductRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(prev => prev + 1)
    })
    if (node) observerRef.current.observe(node)
  }, [loading, hasMore])

  const handleImageChange = async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingId(productId)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `products/${productId}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath)
      await supabase.from('products').update({ image_url: publicUrl }).eq('id', productId)

      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: publicUrl } : p))
      alert('Product image loaded successfully!')
    } catch (err) {
      alert('Upload fault detected.')
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="pb-16">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-gray-900">Catalog Management</h1>
        <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 border rounded font-bold">{products.length} Items Listed</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product, idx) => {
          const isMineazy = product.company === 'Mineazy'
          return (
            <div key={product.id} ref={idx === products.length - 1 ? lastProductRef : null} className="bg-white rounded-xl border p-4 flex gap-4">
              <div className="w-24 h-24 bg-gray-50 border rounded-lg overflow-hidden flex flex-col items-center justify-center relative group flex-shrink-0">
                {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl opacity-30">{isMineazy ? '⛏️' : '🚜'}</span>}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold cursor-pointer transition-opacity">
                  {uploadingId === product.id ? 'Uploading...' : '✏️ Change'}
                  <input type="file" accept="image/*" disabled={uploadingId !== null} onChange={(e) => handleImageChange(product.id, e)} className="hidden" />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isMineazy ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{product.company}</span>
                <div className="font-mono text-[10px] text-gray-400 mt-2">{product["Item No"]}</div>
                <h3 className="font-bold text-sm text-gray-800 line-clamp-2 mt-0.5">{product["Name"]}</h3>
                <div className="flex justify-between items-baseline mt-3">
                  <span className="text-blue-600 font-extrabold text-sm">${Number(product["Excl VAT"]).toFixed(2)}</span>
                  <span className="text-xs font-semibold text-gray-500">Stock: {product.stock}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}