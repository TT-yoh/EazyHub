import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import imageCompression from 'browser-image-compression'
import { toast } from 'react-hot-toast'

interface UploadLog {
  fileName: string;
  status: 'success' | 'failed' | 'processing';
  message: string;
}

interface DBStats {
  count: number;
  samples: any[];
}

// ⭐ TYPE INTERFACE FOR INLINE MODAL CONFIGURATION
interface ModalSettings {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  theme: 'danger' | 'success';
  onConfirm: () => void;
}

export default function BulkImageUpload() {
  const [uploading, setUploading] = useState(false)
  const [logs, setLogs] = useState<UploadLog[]>([])
  const [matchType, setMatchType] = useState<'name' | 'item_no'>('item_no')
  const [adminCompanyId, setAdminCompanyId] = useState<string | number | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [dbStats, setDbStats] = useState<DBStats>({ count: 0, samples: [] })

  // ⭐ HOOKS FOR STORAGE PURGE OPERATION STATES
  const [isPurgingBucket, setIsPurgingBucket] = useState(false)
  const [modal, setModal] = useState<ModalSettings>({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    theme: 'danger',
    onConfirm: () => {},
  })

  const fetchAllProducts = async (companyId: number | string) => {
    let allProducts: any[] = []
    let from = 0
    let to = 999
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('products')
        .select('id, "Item No", "Name", company')
        .range(from, to)

      if (companyId !== 3) {
        query = query.eq('company', companyId)
      }

      const { data, error } = await query
      if (error) throw error

      if (data && data.length > 0) {
        allProducts = [...allProducts, ...data]
        from += 1000
        to += 1000
        hasMore = data.length === 1000 
      } else {
        hasMore = false
      }
    }

    return allProducts
  }

  // Self-contained data fetch routine to allow quick refreshing
  const loadDiagnosticsContext = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: adminData } = await supabase
        .from('admin_users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()

      const resolvedCompanyId = adminData?.company_id ?? 3
      setAdminCompanyId(resolvedCompanyId)

      const products = await fetchAllProducts(resolvedCompanyId)

      setDbStats({
        count: products.length,
        samples: products.slice(0, 3)
      })
    } catch (err) {
      console.error('Error fetching admin context:', err)
    } finally {
      setCheckingAuth(false)
    }
  }

  useEffect(() => {
    loadDiagnosticsContext()
  }, [])

  const normalizeString = (text: string): string => {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim()
  }

  const handleBulkFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (!adminCompanyId) {
      toast.error('Authentication Context Error: Unable to determine your company channel assignment.')
      return
    }

    setUploading(true)
    setLogs([])

    const fileArray = Array.from(files)
    const initialLogs = fileArray.map(f => ({
      fileName: f.name,
      status: 'processing' as const,
      message: 'Running multi-column verification matrix...'
    }))
    setLogs(initialLogs)

    const totalBatchToast = toast.loading(`Processing and optimizing batch upload of ${fileArray.length} assets...`)

    try {
      const productList = await fetchAllProducts(adminCompanyId)

      const compressionOptions = {
        maxSizeMB: 0.4,          
        maxWidthOrHeight: 1024,  
        useWebWorker: true,      
        fileType: 'image/webp'   
      }

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        const rawFileNameNoExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
        const cleanFileName = normalizeString(rawFileNameNoExt)

        let matchedProduct = null
        let logMessage = ''

        matchedProduct = productList.find(p => {
          const targetValue = matchType === 'item_no' ? p['Item No'] : p['Name']
          const cleanTarget = normalizeString(targetValue || '')
          return cleanTarget === cleanFileName || cleanFileName.includes(cleanTarget) || cleanTarget.includes(cleanFileName)
        })

        if (matchedProduct) {
          const resolvedValue = matchType === 'item_no' ? matchedProduct['Item No'] : matchedProduct['Name']
          logMessage = `Linked via primary [${matchType === 'item_no' ? 'Item No' : 'Name'}]: "${resolvedValue}"`
        } 
        else {
          const alternateType = matchType === 'item_no' ? 'name' : 'item_no'
          matchedProduct = productList.find(p => {
            const targetValue = alternateType === 'item_no' ? p['Item No'] : p['Name']
            const cleanTarget = normalizeString(targetValue || '')
            return cleanTarget === cleanFileName || cleanFileName.includes(cleanTarget) || cleanTarget.includes(cleanFileName)
          })

          if (matchedProduct) {
            const resolvedValue = alternateType === 'item_no' ? matchedProduct['Item No'] : matchedProduct['Name']
            logMessage = `Linked via fallback [${alternateType === 'item_no' ? 'Item No' : 'Name'}]: "${resolvedValue}"`
          } else {
            logMessage = `No match sequence discovered in either Item No or Name columns.`
          }
        }

        if (!matchedProduct) {
          updateLog(file.name, 'failed', logMessage)
          continue
        }

        try {
          updateLog(file.name, 'processing', 'Compressing and optimizing asset bytes locally...')
          const compressedBlob = await imageCompression(file, compressionOptions)
          const optimizedFile = new File([compressedBlob], `${rawFileNameNoExt}.webp`, { type: 'image/webp' })

          updateLog(file.name, 'processing', 'Streaming optimized WebP bytes to cloud storage...')
          const filePath = `products/${matchedProduct.id}-${Math.random().toString(36).substring(7)}.webp`

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, optimizedFile, { 
              cacheControl: '3600',
              upsert: true 
            })

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath)

          const { error: patchError } = await supabase
            .from('products')
            .update({ image_url: publicUrl })
            .eq('id', matchedProduct.id)

          if (patchError) throw patchError

          updateLog(file.name, 'success', logMessage)
        } catch (err) {
          updateLog(file.name, 'failed', 'Storage write rejected payload or compression failed.')
        }
      }
      toast.success('Batch pipeline complete! Asset matrix updated.', { id: totalBatchToast })
      loadDiagnosticsContext()
    } catch (globalErr: any) {
      console.error(globalErr)
      toast.error(`Bulk workflow failure: ${globalErr.message}`, { id: totalBatchToast })
    } finally {
      setUploading(false)
    }
  }

  const updateLog = (fileName: string, status: 'success' | 'failed' | 'processing', message: string) => {
    setLogs(prev => prev.map(log => log.fileName === fileName ? { ...log, status, message } : log))
  }

  // ⭐ THE LIVE STORAGE BUCKET PURGE EXECUTOR ROUTINE
  const executeStorageBucketFlush = async () => {
    setIsPurgingBucket(true)
    const purgeToast = toast.loading('Listing files inside product-images storage folder...')

    try {
      // 1. Scan storage folder directory contents
      const { data: fileList, error: listError } = await supabase.storage
        .from('product-images')
        .list('products', { limit: 1000 })

      if (listError) throw listError

      if (fileList && fileList.length > 0) {
        toast.loading(`Purging ${fileList.length} physical file binaries out of cloud buckets...`, { id: purgeToast })
        
        // Map files into full target paths array strings
        const pathsToDelete = fileList.map(file => `products/${file.name}`)

        // 2. Mass drop the mapped files array out of storage servers
        const { error: removeError } = await supabase.storage
          .from('product-images')
          .remove(pathsToDelete)

        if (removeError) throw removeError
      }

      toast.dismiss(purgeToast)
      setModal({
        isOpen: true,
        title: 'Storage Bucket Wiped',
        message: 'The products image asset folder has been emptied out completely. All development image thumbnails have been scrubbed from disk.',
        confirmButtonText: 'Acknowledge',
        theme: 'success',
        onConfirm: () => {}
      })
    } catch (err: any) {
      console.error(err)
      toast.error(`Storage Purge Rejected: ${err.message || 'Verify permissions.'}`, { id: purgeToast })
    } finally {
      setIsPurgingBucket(false)
    }
  }

  // TRIGGER MODAL FOR THE IMAGES STORAGE PURGE BUTTON
  const handlePurgeBucketClick = () => {
    setModal({
      isOpen: true,
      title: '⚠️ PURGE CLOUD STORAGE BUCKET',
      message: "Are you absolutely certain you want to permanently empty out the 'product-images/products' storage directory? This deletes every uploaded thumbnail image blob entirely. Product display views will fall back to default icons.",
      confirmButtonText: '🗑️ Obliterate Image Files',
      theme: 'danger',
      onConfirm: executeStorageBucketFlush
    })
  }

  if (checkingAuth) {
    return (
      <div className="max-w-3xl mx-auto pt-12 text-center text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">
        Configuring secure company isolation context...
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto pt-6 px-4 space-y-6 relative">
      
      {/* HEADER ROW WITH INTEGRATED DEDICATED FLUSH CONTROL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Bulk Catalog Image Importer</h1>
          <p className="text-xs text-gray-400 mt-0.5">Automate inventory image mappings cleanly across company channels with web worker compression optimization.</p>
        </div>
        
        {/* ⭐ THE SELF-CONTAINED FILE PURGE TRIGGER BUTTON */}
        <button
          type="button"
          onClick={handlePurgeBucketClick}
          disabled={uploading || isPurgingBucket || modal.isOpen}
          className="w-full sm:w-auto px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-black border border-red-200 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40 active:scale-95 shadow-xs flex items-center justify-center gap-1.5 flex-shrink-0"
        >
          {isPurgingBucket ? 'Emptying Bucket...' : '🗑️ Purge Image Bucket'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Primary Matching Rule:
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-100 p-3 rounded-xl cursor-pointer flex-1 w-full">
              <input type="radio" checked={matchType === 'item_no'} onChange={() => setMatchType('item_no')} disabled={uploading} className="text-blue-600" />
              <span className="break-words">Match "Item No" (With fallback auto-scan)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-100 p-3 rounded-xl cursor-pointer flex-1 w-full">
              <input type="radio" checked={matchType === 'name'} onChange={() => setMatchType('name')} disabled={uploading} className="text-blue-600" />
              <span className="break-words">Match Product "Name" (With fallback auto-scan)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Target Image Files</label>
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 sm:p-8 text-center bg-gray-50/30 hover:bg-gray-50 transition-all relative">
            <input type="file" multiple accept="image/*" disabled={uploading || isPurgingBucket} onChange={handleBulkFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
            <div className="space-y-1">
              <span className="text-2xl block">{uploading ? '⏳' : '🖼️'}</span>
              <span className="text-xs font-bold text-gray-700 block">
                {uploading ? 'Processing batch execution queues...' : 'Click or Drag multiple images here to auto-map'}
              </span>
            </div>
          </div>
        </div>

        {logs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide">Importer Status Manifest</h3>
            <div className="border border-gray-100 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50 bg-white shadow-inner font-mono text-[11px]">
              {logs.map((log, idx) => (
                <div key={idx} className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                  <span className="font-bold text-gray-700 truncate max-w-full sm:max-w-xs">{log.fileName}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${log.status === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : log.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse'}`}>{log.status}</span>
                    <span className="text-gray-400 font-medium break-all">{log.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-[11px] space-y-2 shadow-inner overflow-x-auto">
          <div className="text-blue-400 font-bold border-b border-gray-800 pb-1 flex items-center justify-between gap-4">
            <span>🔍 LIVE DATABASE DIAGNOSTICS</span>
            <span className="text-[9px] bg-gray-800 px-2 py-0.5 rounded text-gray-400 flex-shrink-0">Tenant Status</span>
          </div>
          <div className="break-all">Active Admin Company ID: <span className="text-yellow-400 font-bold">{adminCompanyId === 3 ? '3 (Super Admin Role)' : String(adminCompanyId || 'None')}</span></div>
          <div>Total Visible Products: <span className={`font-bold ${dbStats.count > 0 ? 'text-green-400' : 'text-red-400'}`}>{dbStats.count} products found</span></div>
          
          {dbStats.count > 0 ? (
            <div className="pt-1">
              <div className="text-gray-400 font-bold mb-1">Active Index Samples:</div>
              <ul className="space-y-1 list-disc list-inside text-gray-300">
                {dbStats.samples.map((p, i) => (
                  <li key={i} className="truncate max-w-full">
                    Code: <span className="text-cyan-400">"{p['Item No']}"</span> — Name: <span className="text-purple-400">"{p['Name']}"</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-red-400 font-bold p-2 bg-red-950/40 rounded border border-red-900 mt-2">
              ⚠️ Alert: The importer is returning empty records. Check your database products collection.
            </div>
          )}
        </div>

      </div>

      {/* ⭐ SELF-CONTAINED TAILWIND POPUP MODAL OVERLAY */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in">
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
                  onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  modal.onConfirm()
                  setModal(prev => ({ ...prev, isOpen: false }))
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
      )}

    </div>
  )
}