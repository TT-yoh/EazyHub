import { useEffect, useState, useCallback, useRef, ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

const COMPANY_STATIC: Record<number, { name: string; shortName: string; icon: string; logoUrl: string }> = {
  1: { 
    name: 'Mineazy Mining Solutions', 
    shortName: 'Mineazy', 
    icon: '⛏️',
    logoUrl: 'https://plmwckgshtxwgvwmbsvq.supabase.co/storage/v1/object/public/product-images/company-logos/mineazy-logo.png'
  },
  2: { 
    name: 'Farmeazy Agricultural Line', 
    shortName: 'Farmeazy', 
    icon: '🚜',
    logoUrl: 'https://plmwckgshtxwgvwmbsvq.supabase.co/storage/v1/object/public/product-images/company-logos/farmeazy-logo.png'
  }
};

interface ModalSettings {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  theme: 'danger' | 'success';
  onConfirm: () => void;
}

export default function AdminProducts() {
  const navigate = useNavigate()
  const { id } = useParams() 
  
  // ⭐ Direct Inline Authentication States (Mirrors AdminOrders.tsx setup)
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  
  // ⭐ SUPER ADMIN VIEW FILTER
  const [viewFilter, setViewFilter] = useState<'all' | number>('all')

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  
  const observerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [targetingProductId, setTargetingProductId] = useState<string | null>(null)

  // Universal Form State (Handles both Edits and Creates) - Matching 'company'
  const [editForm, setEditForm] = useState({ Name: '', "Item No": '', "Excl VAT": 0, "Incl VAT": 0, stock: 0, image_url: '', company: 1 })
  const [saving, setSaving] = useState(false)

  // BATCH STOCK STATES
  const [unsavedStock, setUnsavedStock] = useState<Record<string, number>>({})
  const [batchSaving, setBatchSaving] = useState(false)

  // GLOBAL OVERRIDE STATE
  const [globalStockValue, setGlobalStockValue] = useState<string>('')

  // MULTI-THEME CUSTOM MODAL CONTROLLER STATE
  const [modal, setModal] = useState<ModalSettings>({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    theme: 'danger',
    onConfirm: () => {},
  })

  // ========================================================
  // 🛡️ AUTH CHECK RUNTIME: Directly replicates AdminOrders.tsx
  // ========================================================
  useEffect(() => {
    const verifyAdminProfile = async () => {
      try {
        setAuthLoading(true)
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
          navigate('/')
          return
        }

        // Lock in the database row company integer value safely
        setCurrentCompanyId(adminCheck.company_id)
      } catch (err) {
        console.error("Logistics profile load breakdown:", err)
      } finally {
        setAuthLoading(false)
      }
    }

    verifyAdminProfile()
  }, [navigate])

  // Mode Switcher: Fetch product for Edit Mode, or clear for Create Mode
  useEffect(() => {
    if (authLoading || currentCompanyId === null) return

    if (id && id !== 'new') {
      setLoading(true)
      supabase.from('products').select('*').eq('id', id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setEditForm({
              Name: data.Name || '',
              "Item No": data["Item No"] || '',
              "Excl VAT": data["Excl VAT"] || 0,
              "Incl VAT": data["Incl VAT"] || 0,
              stock: data.stock || 0,
              image_url: data.image_url || '',
              company: data.company || 1 
            })
          }
          setLoading(false)
        })
    } else if (id === 'new') {
      setEditForm({ 
        Name: '', "Item No": '', "Excl VAT": 0, "Incl VAT": 0, stock: 0, image_url: '', 
        company: currentCompanyId === 3 ? 1 : (currentCompanyId || 1) 
      })
    }
  }, [id, currentCompanyId, authLoading])

  // ========================================================
  // ⚡ FETCH PRODUCTS: Optimized Server-Side int4 WHERE Clause
  // ========================================================
  const fetchProducts = useCallback(async (pageNumber: number, clearOld: boolean) => {
    if (authLoading || currentCompanyId === null) return

    setLoading(true)
    try {
      const safeCompanyId = Number(currentCompanyId)
      let query = supabase.from('products').select('*')
      
      // Inline SQL Where clause matching database column mapping
      if (safeCompanyId !== 3) {
        // Branch Admins are locked to their company ID natively
        query = query.eq('company', safeCompanyId)
      } else if (viewFilter !== 'all') {
        // Super Admins are filtered by their active dropdown tab selection
        query = query.eq('company', viewFilter)
      }

      query = query
        .order('created_at', { ascending: false })
        .range(pageNumber * 30, (pageNumber + 1) * 30 - 1)
      
      if (search.trim() !== '') query = query.ilike('Name', `%${search}%`)

      const { data, error } = await query
      if (error) throw error

      if (data) {
        setProducts(prev => clearOld ? data : [...prev, ...data])
        setHasMore(data.length === 30)
      }
    } catch (err: any) {
      console.error("Catalog database query execution crash:", err.message)
    } finally {
      setLoading(false)
    }
  }, [currentCompanyId, search, authLoading, viewFilter])

  // Pipeline execution manager hook
  useEffect(() => {
    if (authLoading || currentCompanyId === null) return

    if (!id) {
      setProducts([])
      setPage(0)
      setHasMore(true)
      setUnsavedStock({}) 
      fetchProducts(0, true)
    }
  }, [search, id, fetchProducts, currentCompanyId, authLoading])

  // Infinite Scroll Intersection Observer
  const lastProductRef = useCallback((node: HTMLDivElement) => {
    if (loading || id) return
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => {
          fetchProducts(prev + 1, false)
          return prev + 1
        })
      }
    })
    if (node) observerRef.current.observe(node)
  }, [loading, hasMore, fetchProducts, id])

  // ========================================================
  // ⭐ SECURE CSV EXPORT (Respects Super Admin Filtering)
  // ========================================================
  const handleExportCSV = async () => {
    const exportToast = toast.loading('Extracting catalog records...')
    try {
      // Setup the base query to grab the entire file set
      let query = supabase.from('products').select('*').order('created_at', { ascending: false })
      
      // Inject database-level sorting before downloading so it aligns perfectly with the active view tab
      if (currentCompanyId !== 3) {
        query = query.eq('company', currentCompanyId)
      } else if (viewFilter !== 'all') {
        query = query.eq('company', viewFilter)
      }

      const { data, error } = await query
      if (error) throw error

      let exportData = data

      // If a search filter is currently applied, narrow the export file to match the active search text
      if (search.trim() !== '') {
        exportData = exportData.filter(product => {
          const title = product.Name || product.name || ''
          return title.toLowerCase().includes(search.toLowerCase())
        })
      }

      if (!exportData || exportData.length === 0) {
        toast.error('No products found to export.', { id: exportToast })
        return
      }

      // Construct headers and map data safely
      const headers = ['SKU', 'Product Name', 'Price (Excl VAT)', 'Stock Balance', 'Company ID']
      const csvRows = exportData.map(product => {
        return [
          `"${product["Item No"] || product.item_no || ''}"`,
          `"${product.Name || product.name || ''}"`,
          product["Excl VAT"] || product.excl_vat || 0,
          product.stock || 0,
          product.company || 1
        ].join(',')
      })

      // Generate the CSV Blob file object and trigger browser download
      const csvContent = [headers.join(','), ...csvRows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      
      // Dynamically title the file based on who is downloading it and what filter they used
      const exportTarget = currentCompanyId !== 3 ? Number(currentCompanyId) : (viewFilter === 'all' ? null : Number(viewFilter));
      const brandName = exportTarget ? COMPANY_STATIC[exportTarget]?.shortName : 'System_Master'
      
      link.setAttribute('download', `${brandName}_Catalog_Export.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Inventory report exported successfully!', { id: exportToast })
    } catch (err: any) {
      console.error(err)
      toast.error(`Export failed: ${err.message}`, { id: exportToast })
    }
  }

  const openImagePicker = (productId: string | null = null) => {
    setTargetingProductId(productId)
    fileInputRef.current?.click()
  }

  // File Upload Pipeline Handler
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return
    const file = e.target.files[0]
    const mediaToast = toast.loading('Uploading asset file to storage buckets...')

    try {
      const filePath = `products/${Math.random()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      if (targetingProductId) {
        await supabase.from('products').update({ image_url: publicUrl }).eq('id', targetingProductId)
        setProducts(prev => prev.map(p => p.id === targetingProductId ? { ...p, image_url: publicUrl } : p))
      } else {
        setEditForm(prev => ({ ...prev, image_url: publicUrl }))
      }
      toast.success('Image asset compiled and assigned cleanly!', { id: mediaToast })
    } catch (err: any) {
      console.error(err)
      toast.error(`Image upload breakdown: ${err.message || 'Check storage policies.'}`, { id: mediaToast })
    } finally {
      setTargetingProductId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLocalStockChange = (productId: string, originalStock: number, valueString: string) => {
    const parsedValue = parseInt(valueString)
    if (isNaN(parsedValue) || parsedValue < 0) return

    if (parsedValue === originalStock) {
      setUnsavedStock(prev => {
        const updated = { ...prev }
        delete updated[productId]
        return updated
      })
    } else {
      setUnsavedStock(prev => ({ ...prev, [productId]: parsedValue }))
    }
  }

  // GLOBAL DATABASE-WIDE OVERRIDE SYSTEM EXECUTOR
  const executeGlobalStockOverride = async (parsedGlobal: number) => {
    setBatchSaving(true)
    const overrideToast = toast.loading('Executing system-wide baseline warehouse updates...')
    try {
      let query = supabase.from('products').update({ stock: parsedGlobal })

      if (currentCompanyId && currentCompanyId !== 3) {
        query = query.eq('company', currentCompanyId) 
      } else if (viewFilter !== 'all') {
        query = query.eq('company', viewFilter) 
      } else {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000')
      }

      const { error } = await query
      if (error) throw error

      setProducts(prev => prev.map(p => ({ ...p, stock: parsedGlobal })))
      setUnsavedStock({}) 
      setGlobalStockValue('')
      
      setModal({
        isOpen: true,
        title: 'Override Successful',
        message: `All target inventory listings have been globally calibrated to an absolute count of ${parsedGlobal} items.`,
        confirmButtonText: 'Continue',
        theme: 'success',
        onConfirm: () => {}
      })
      toast.dismiss(overrideToast)
    } catch (err: any) {
      console.error(err)
      toast.error(`Bulk write crash: ${err.message}`, { id: overrideToast })
    } finally {
      setBatchSaving(false)
    }
  }

  const handleApplyGlobalStockDatabaseWide = () => {
    const parsedGlobal = parseInt(globalStockValue)
    if (isNaN(parsedGlobal) || parsedGlobal < 0) {
      toast.error('Please specify a valid positive integer count.')
      return
    }

    const alertMsg = (currentCompanyId === 3 && viewFilter === 'all')
      ? `This will instantly overwrite and set the stock level to ${parsedGlobal} units for EVERY single product across ALL companies in the entire database catalog system.`
      : `This will instantly overwrite and set the stock level to ${parsedGlobal} units for EVERY product tracked under the ${currentCompanyId !== 3 ? COMPANY_STATIC[Number(currentCompanyId)]?.shortName : COMPANY_STATIC[Number(viewFilter)]?.shortName} division.`;

    setModal({
      isOpen: true,
      title: '🚨 CRITICAL BULK EXECUTOR ALERT',
      message: `${alertMsg} This change cannot be automatically reversed. Proceed?`,
      confirmButtonText: '💥 Overwrite Database',
      theme: 'danger',
      onConfirm: () => executeGlobalStockOverride(parsedGlobal)
    })
  }

  // BATCH SAVE STOCK TRANSACTION EXECUTOR
  const executeBatchStockSave = async () => {
    const totalEdits = Object.keys(unsavedStock).length
    setBatchSaving(true)
    const batchToast = toast.loading(`Synchronizing ${totalEdits} inventory adjustments...`)
    
    try {
      for (const [productId, updatedCount] of Object.entries(unsavedStock)) {
        await supabase
          .from('products')
          .update({ stock: updatedCount })
          .eq('id', productId)
      }

      setProducts(prev => prev.map(p => 
        unsavedStock[p.id] !== undefined ? { ...p, stock: unsavedStock[p.id] } : p
      ))
      
      setUnsavedStock({}) 
      
      setModal({
        isOpen: true,
        title: 'Balances Synchronized',
        message: `Successfully written ${totalEdits} separate physical item stock levels into system records.`,
        confirmButtonText: 'Acknowledge',
        theme: 'success',
        onConfirm: () => {}
      })
      toast.dismiss(batchToast)
    } catch (err: any) {
      console.error(err)
      toast.error(`Batch pipeline tracking broken: ${err.message}`, { id: batchToast })
    } finally {
      setBatchSaving(false)
    }
  }

  const handleBatchSaveStock = () => {
    const totalEdits = Object.keys(unsavedStock).length
    if (totalEdits === 0) return

    setModal({
      isOpen: true,
      title: 'Save Grid Adjustments',
      message: `Commit and push all ${totalEdits} altered inventory stock counts directly into the production cluster tables?`,
      confirmButtonText: '💾 Push Changes',
      theme: 'success',
      onConfirm: executeBatchStockSave
    })
  }

  // DUAL-ACTION SUBMIT FORM EXECUTOR
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const formsToast = toast.loading('Syncing specification records with master tables...')
    const isNew = id === 'new'

    try {
      const payload = {
        Name: editForm.Name,
        "Item No": editForm["Item No"],
        "Excl VAT": Number(editForm["Excl VAT"]),
        "Incl VAT": Number(editForm["Incl VAT"]),
        stock: Number(editForm.stock),
        image_url: editForm.image_url,
        company: Number(editForm.company), 
        is_active: true
      }

      if (isNew) {
        const { error } = await supabase.from('products').insert([payload])
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').update(payload).eq('id', id)
        if (error) throw error
      }
      
      toast.dismiss(formsToast)
      setModal({
        isOpen: true,
        title: isNew ? 'Product Created' : 'Changes Saved',
        message: `"${editForm.Name}" catalog information records have been fully updated.`,
        confirmButtonText: 'Return to Catalog',
        theme: 'success',
        onConfirm: () => navigate('/admin/products')
      })
    } catch (err: any) {
      console.error(err)
      toast.error(`Save structural mismatch: ${err.message}`, { id: formsToast })
    } finally {
      setSaving(false)
    }
  }

  // DELETE CATALOG RUNTIME EXECUTOR
  const executeSingleProductDeletion = async (productId: string) => {
    const trashToast = toast.loading('Scrubbing product allocation records out of indices...')
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId)
      if (error) throw error
      
      setProducts(prev => prev.filter(p => p.id !== productId))
      toast.success('Product identity removed from deployment catalog items.', { id: trashToast })
    } catch (err: any) {
      console.error(err)
      toast.error("Purge blocked: Product has active transactional dependencies.", { id: trashToast })
    }
  }

  const handleDelete = (productId: string) => {
    const targetItem = products.find(p => p.id === productId)
    setModal({
      isOpen: true,
      title: 'Delete Catalog Item',
      message: `Are you completely certain you want to permanently erase "${targetItem?.Name || 'this item'}" from store logs? This will disrupt active customer cart values.`,
      confirmButtonText: '🗑️ Obliterate Item',
      theme: 'danger',
      onConfirm: () => executeSingleProductDeletion(productId)
    })
  }

  if (authLoading) return <div className="p-6 text-center text-sm font-medium text-gray-400">Verifying administrative terminal profile...</div>

  // ==========================================
  // VIEW 1: FULL PRODUCT CREATE/EDIT FORM
  // ==========================================
  if (id) {
    const isNew = id === 'new'
    
    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 bg-white rounded-xl shadow-sm border mt-6 relative">
        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />

        <div className="flex justify-between items-center mb-6 gap-2">
          <button onClick={() => navigate('/admin/products')} className="text-xs sm:text-sm font-bold text-gray-600 hover:text-blue-600">
            ← Back to Catalog
          </button>
          <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full text-center ${isNew ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {isNew ? '✨ CREATE NEW ITEM' : '✏️ EDITING EXISTING ITEM'}
          </span>
        </div>

        {loading && !isNew ? (
          <div className="text-center py-12 text-sm font-bold text-gray-400">Loading item attributes...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Product Image (Click to set)</label>
              <button type="button" onClick={() => openImagePicker(null)} className="w-full aspect-square max-w-[260px] mx-auto border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden hover:border-blue-500 bg-gray-50 transition-colors">
                {editForm.image_url ? <img src={editForm.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl text-gray-300">🖼️</span>}
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="md:col-span-2 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500">Product Name</label>
                <input type="text" value={editForm.Name} onChange={e => setEditForm(prev => ({ ...prev, Name: e.target.value }))} required className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:border-blue-500 focus:outline-none" />
              </div>

              {currentCompanyId === 3 && (
                <div>
                  <label className="text-xs font-bold text-gray-500">Brand / Company Assignment</label>
                  <select value={editForm.company} onChange={e => setEditForm(prev => ({ ...prev, company: Number(e.target.value) }))} className="w-full border p-2.5 rounded-lg text-sm mt-1 bg-gray-50 font-bold focus:border-blue-500 focus:outline-none">
                    <option value={1}>⛏️ Mineazy Mining Solutions</option>
                    <option value={2}>🚜 Farmeazy Agricultural Line</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500">Item No / SKU</label>
                  <input type="text" value={editForm["Item No"]} onChange={e => setEditForm(prev => ({ ...prev, "Item No": e.target.value }))} required className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Stock Balance</label>
                  <input type="number" value={editForm.stock} onChange={e => setEditForm(prev => ({ ...prev, stock: Number(e.target.value) }))} required className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500">Price Excl VAT ($)</label>
                  <input type="number" step="0.01" value={editForm["Excl VAT"]} onChange={e => setEditForm(prev => ({ ...prev, "Excl VAT": Number(e.target.value) }))} required className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Price Incl VAT ($)</label>
                  <input type="number" step="0.01" value={editForm["Incl VAT"]} onChange={e => setEditForm(prev => ({ ...prev, "Incl VAT": Number(e.target.value) }))} required className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => navigate('/admin/products')} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-6 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg disabled:bg-blue-300 shadow-sm hover:bg-blue-700 transition-colors">
                  {saving ? 'Processing...' : isNew ? '+ Add to Database' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {modal.isOpen && <RenderCustomModal modal={modal} setModal={setModal} />}
      </div>
    )
  }

  const totalChangedItems = Object.keys(unsavedStock).length

  // ==========================================
  // VIEW 2: GRID LIST CATALOG OVERVIEW
  // ==========================================
  return (
    <div className="w-full max-w-7xl mx-auto p-4 pb-28 relative">
      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Products Catalog</h1>
          <p className="text-xs text-gray-500">Modify numbers individually, or run a global database override to change all table stock numbers instantly.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={handleExportCSV} 
            className="flex-1 sm:flex-initial text-center px-4 py-2 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm hover:bg-emerald-100 transition-colors"
          >
            📥 Export CSV
          </button>
          <button onClick={() => navigate('/admin/products/edit/new')} className="flex-1 sm:flex-initial text-center px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors">
            + Add New Product
          </button>
          <button onClick={() => navigate('/')} className="flex-1 sm:flex-initial text-center border border-gray-200 px-3 py-2 rounded-lg text-xs font-bold bg-white text-gray-700 shadow-xs hover:bg-gray-50 transition-colors">
            ← Storefront
          </button>
        </div>
      </div>

      {/* SEARCH, FILTERS & DATABASE-WIDE STOCK OVERRIDE BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        
        {/* ⭐ VIEW FILTER & SEARCH CONTAINER */}
        <div className="md:col-span-2 flex flex-col sm:flex-row gap-2">
          {currentCompanyId === 3 && (
            <select 
              value={viewFilter}
              onChange={(e) => setViewFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-blue-500 bg-gray-50 font-bold text-gray-700 shadow-xs w-full sm:w-auto"
            >
              <option value="all">🌍 All Brands</option>
              <option value={1}>⛏️ Mineazy Only</option>
              <option value={2}>🚜 Farmeazy Only</option>
            </select>
          )}

          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="🔎 Search products by catalog title..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="w-full border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors h-full shadow-xs" 
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-100 hover:bg-gray-200 text-gray-500 w-7 h-7 flex items-center justify-center rounded-full text-xs font-black transition-colors"
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-red-50/40 border border-red-200 rounded-xl p-2 flex items-center gap-2 shadow-xs">
          <input 
            type="number" 
            placeholder="Set DB..." 
            value={globalStockValue} 
            onChange={e => setGlobalStockValue(e.target.value)} 
            className="w-20 sm:w-24 border border-gray-200 rounded-lg p-2 text-xs font-mono font-bold text-center focus:outline-none focus:border-red-500 bg-white" 
          />
          <button 
            type="button" 
            onClick={handleApplyGlobalStockDatabaseWide}
            disabled={batchSaving || loading}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-[10px] font-black tracking-wider uppercase p-2.5 rounded-lg transition-colors shadow-xs text-center"
          >
            {batchSaving ? 'Syncing...' : '⚠️ Set Database'}
          </button>
        </div>
      </div>

      {products.length === 0 && !loading ? (
        <div className="text-center py-12 text-sm text-gray-400">No matches found for active view parameters.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {products.map((product, index) => {
            const targetCompanyId = Number(product.company);
            const brand = COMPANY_STATIC[targetCompanyId] || { name: 'General', icon: '📦', logoUrl: '' };
            const isThisUploading = targetingProductId === product.id;
            
            const hasUnsavedChanges = unsavedStock[product.id] !== undefined;
            const displayedStockValue = hasUnsavedChanges ? unsavedStock[product.id] : product.stock;

            return (
              <div key={product.id} ref={index === products.length - 1 ? lastProductRef : null} className={`bg-white border rounded-xl p-2.5 sm:p-4 shadow-xs flex flex-col justify-between relative transition-all ${
                hasUnsavedChanges ? 'border-blue-500 ring-1 ring-blue-500/30 bg-blue-50/5' : 'hover:border-gray-200'
              }`}>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => openImagePicker(product.id)}
                    className="w-full h-24 sm:h-32 rounded-lg bg-gray-50 border flex-shrink-0 flex items-center justify-center overflow-hidden hover:border-blue-500 relative group"
                    title="Click to instantly change image"
                  >
                    {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl opacity-40">📦</span>}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold">EDIT</div>
                    {isThisUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></div></div>}
                  </button>

                  <div className="min-w-0 space-y-0.5">
                    <span className="block font-mono text-[9px] text-gray-400 truncate">SKU: {product["Item No"]}</span>
                    <h3 className="font-bold text-xs sm:text-sm text-gray-800 line-clamp-2 leading-tight min-h-[32px]">{product["Name"]}</h3>
                    <div className="text-xs font-black text-blue-600">${Number(product["Excl VAT"] || 0).toFixed(2)} <span className="text-[9px] text-gray-400 font-normal">excl</span></div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 w-full">
                  <div className="flex items-center justify-between xl:justify-start gap-1.5 w-full">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Stock:</span>
                    <input 
                      type="number"
                      value={displayedStockValue}
                      onChange={(e) => handleLocalStockChange(product.id, product.stock, e.target.value)}
                      className={`w-12 sm:w-16 p-1 text-xs font-mono font-bold text-center border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                        hasUnsavedChanges ? 'bg-blue-50 text-blue-700 border-blue-300' :
                        product.stock === 0 ? 'bg-red-600 border-red-200' : 'bg-gray-50 text-gray-800 border-gray-200'
                      }`}
                    />
                    {hasUnsavedChanges && <span className="text-[9px] font-black text-blue-600 animate-pulse">●</span>}
                  </div>

                  <div className="flex gap-1 w-full xl:w-auto">
                    <button onClick={() => navigate(`/admin/products/edit/${product.id}`)} className="flex-1 xl:flex-initial text-center px-1.5 py-1 text-[10px] font-bold border rounded bg-gray-50 text-gray-700 hover:bg-gray-100">Edit</button>
                    <button onClick={() => handleDelete(product.id)} className="flex-1 xl:flex-initial text-center px-1.5 py-1 text-[10px] font-bold border border-red-100 text-red-600 rounded bg-red-50 hover:bg-red-100">Delete</button>
                  </div>
                </div>

                <div className="absolute top-4 right-4 w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border bg-white flex items-center justify-center text-xs shadow-sm">
                  {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="w-full h-full object-cover" /> : <span>{brand.icon}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating Action Queue Bar */}
      {totalChangedItems > 0 && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-gray-900 border border-gray-800 text-white rounded-2xl px-4 py-3.5 sm:px-6 sm:py-4 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 z-50 animate-slide-up">
          <div className="text-left">
            <span className="block text-[9px] font-bold text-blue-400 uppercase tracking-widest">Unsaved Register</span>
            <span className="text-xs font-semibold text-gray-300 block sm:inline">Queued: <strong className="text-white text-sm font-black">{totalChangedItems} items</strong> modified counts.</span>
          </div>
          <div className="flex gap-2 justify-end w-full sm:w-auto">
            <button onClick={() => setUnsavedStock({})} disabled={batchSaving} className="px-3 py-2 border border-gray-700 hover:bg-gray-800 text-gray-300 text-xs font-bold rounded-xl flex-1 sm:flex-initial text-center">Reset</button>
            <button onClick={handleBatchSaveStock} disabled={batchSaving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-xs font-black tracking-wide rounded-xl shadow-md transition-all flex-[2] sm:flex-initial text-center">
              {batchSaving ? 'Saving...' : '💾 Save All'}
            </button>
          </div>
        </div>
      )}

      {loading && !targetingProductId && <div className="text-center text-xs font-bold text-blue-600 py-4">Loading inventory updates...</div>}

      {/* GRID RENDER FOR THE TAILWIND OVERLAY MODAL */}
      {modal.isOpen && <RenderCustomModal modal={modal} setModal={setModal} />}
    </div>
  )
}

function RenderCustomModal({ modal, setModal }: { modal: ModalSettings, setModal: (v: any) => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="bg-white border border-gray-100 rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 transform scale-100 transition-all duration-200">
        
        <div className={`flex items-center gap-2.5 ${modal.theme === 'danger' ? 'text-red-600' : 'text-green-600'}`}>
          <span className="text-xl">{modal.theme === 'danger' ? '⚠️' : '✨'}</span>
          <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">{modal.title}</h3>
        </div>
        
        <p className="text-xs text-gray-500 font-medium leading-relaxed">
          {modal.message}
        </p>

        <div className="flex gap-2 pt-1">
          {modal.theme === 'danger' && (
            <button
              type="button"
              onClick={() => setModal((prev: any) => ({ ...prev, isOpen: false }))}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              modal.onConfirm()
              setModal((prev: any) => ({ ...prev, isOpen: false }))
            }}
            className={`py-2.5 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs text-center ${
              modal.theme === 'danger' 
                ? 'flex-1 bg-red-600 hover:bg-red-700' 
                : 'w-full bg-green-600 hover:bg-green-700'
            }`}
          >
            {modal.confirmButtonText}
          </button>
        </div>

      </div>
    </div>
  )
}