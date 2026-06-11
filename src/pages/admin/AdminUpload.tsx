import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Papa from 'papaparse'
import { toast } from 'react-hot-toast'

// ⭐ TYPE INTERFACE FOR INLINE MODAL CONFIGURATION
interface ModalSettings {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  theme: 'danger' | 'success';
  onConfirm: () => void;
}

export default function AdminUpload() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [adminCompanyId, setAdminCompanyId] = useState<number | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(1) 
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [flushConfirmation, setFlushConfirmation] = useState('')
  const [isFlushing, setIsFlushing] = useState(false)

  // ⭐ HOOK FOR DRIVING THE TAILWIND CUSTOM OVERLAY
  const [modal, setModal] = useState<ModalSettings>({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    theme: 'danger',
    onConfirm: () => {},
  })

  useEffect(() => {
    async function getAdminContext() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: adminData } = await supabase
          .from('admin_users')
          .select('company_id')
          .eq('id', user.id)
          .maybeSingle()

        if (adminData?.company_id) {
          const cid = Number(adminData.company_id)
          setAdminCompanyId(cid)
          
          if (cid !== 3) {
            setSelectedCompanyId(cid)
          }
        }
      } catch (err) {
        console.error('Error fetching security context:', err)
      } finally {
        setCheckingAuth(false)
      }
    }
    getAdminContext()
  }, [])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!adminCompanyId) {
      setMessage('❌ Security Error: Unable to determine your company channel assignment.')
      return
    }

    setUploading(true)
    setMessage('')
    const uploadToast = toast.loading('Parsing and compiling CSV product spreadsheet matrices...')

    const targetCompanyPipeline = adminCompanyId === 3 ? selectedCompanyId : adminCompanyId;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const products = results.data.map((row: any) => ({
          "Item No": row["Item No"] || row.item_no || row["SKU"] || row["Code"] || row["item_code"],
          "Name": row["Name"] || row.name || row["Product"] || row["Description"],
          "Unit": row["Unit"] || row.unit || 'each',
          "Excl VAT": parseFloat(row["Excl VAT"] || row.excl_vat || row["Price"] || row["Price Excl"] || row["cost_excl"] || 0),
          "Incl VAT": parseFloat(row["Incl VAT"] || row.incl_vat || row["Price Incl"] || row["cost_incl"] || 0),
          company: targetCompanyPipeline, 
          stock: parseInt(row.stock || row["Qty"] || row["Stock"] || row["Stock Level"] || 0) || 0,
          image_url: '', 
          is_active: true
        }))

        if (products.length === 0) {
          setMessage('⚠️ The uploaded CSV file contains no valid data rows.')
          toast.error('Sync Aborted: Empty dataset found.', { id: uploadToast })
          setUploading(false)
          return
        }

        try {
          const { error } = await supabase
            .from('products')
            .upsert(products, { onConflict: 'Item No' }) 

          if (error) throw error

          const successMsg = `Successfully synced all ${products.length} products to the ${targetCompanyPipeline === 1 ? 'Mineazy' : 'Farmeazy'} platform pipeline!`
          setMessage(`✅ ${successMsg}`)
          
          setModal({
            isOpen: true,
            title: 'Catalog Synchronization Finished',
            message: successMsg,
            confirmButtonText: 'Great, continue',
            theme: 'success',
            onConfirm: () => {}
          })
          toast.dismiss(uploadToast)
        } catch (err: any) {
          console.error("Bulk synchronization crash:", err)
          const errorMsg = `Upload transaction failed: ${err.message || 'Database rejected payload matrix.'}`
          setMessage(`❌ ${errorMsg}`)
          toast.error(errorMsg, { id: uploadToast })
        } finally {
          setUploading(false)
          if (event.target) event.target.value = '' 
        }
      },
      error: (error) => {
        setMessage(`Error parsing CSV: ${error.message}`)
        toast.error(`CSV compilation breakdown: ${error.message}`, { id: uploadToast })
        setUploading(false)
      }
    })
  }

  // ⭐ THE LIVE PURGE EXECUTOR ROUTINE
  const executeMasterCatalogFlush = async () => {
    setIsFlushing(true)
    setMessage('')
    const purgeToast = toast.loading('Scrubbing target product records out of catalog schemas...')
    
    try {
      let query = supabase.from('products').delete()

      if (adminCompanyId !== 3) {
        query = query.eq('company', adminCompanyId)
      } else {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000') 
      }

      const { error } = await query
      if (error) throw error

      setMessage('🚨 Database wipe operation successful. Target product rows removed.')
      setFlushConfirmation('')
      
      setModal({
        isOpen: true,
        title: 'Table Purge Successful',
        message: 'All targeted inventory row parameters have been cleanly flushed from your cloud relational database records.',
        confirmButtonText: 'Acknowledge',
        theme: 'success',
        onConfirm: () => {}
      })
      toast.dismiss(purgeToast)
    } catch (err: any) {
      console.error(err)
      setMessage(`❌ Wipe sequence aborted: ${err.message}`)
      toast.error(`Wipe rejected: ${err.message}`, { id: purgeToast })
    } finally {
      setIsFlushing(false)
    }
  }

  // TRIGGER MODAL FOR MASTER CATALOG PURGE
  const handleMasterCatalogFlush = () => {
    if (flushConfirmation !== 'DELETE ALL PRODUCTS') {
      toast.error('Verification string sequence mismatch.')
      return
    }

    setModal({
      isOpen: true,
      title: '⚠️ CRITICAL DESTRUCTIVE PURGE',
      message: 'Are you absolutely certain you want to completely drop all structural inventory listing lines from the table? Active user carts matching these IDs will break.',
      confirmButtonText: '💥 Obliterate Products',
      theme: 'danger',
      onConfirm: executeMasterCatalogFlush
    })
  }

  if (checkingAuth) {
    return (
      <div className="max-w-2xl mx-auto pt-12 text-center text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">
        Configuring secure company isolation context...
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto pt-6 px-4 pb-12 relative">
      <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-6">Upload Products (CSV Platform Sync)</h1>
      
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4 mb-6">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Channel Context:</span>
          <span className="text-xs font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg font-mono">
            Role ID: {adminCompanyId}
          </span>
        </div>

        {adminCompanyId === 3 && (
          <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-4 space-y-2">
            <label className="block text-[10px] font-black text-blue-800 uppercase tracking-wider">
              Assign Data Batch Targeting:
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
              disabled={uploading}
              className="w-full text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl p-2.5 outline-none shadow-xs cursor-pointer focus:border-blue-500"
            >
              <option value={1}>⛏️ Stamp Payload Context as: Mineazy Mining Solutions</option>
              <option value={2}>🚜 Stamp Payload Context as: Farmeazy Agricultural Line</option>
            </select>
          </div>
        )}
        
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Target Spreadsheet Source CSV File</label>
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:bg-gray-50/50 transition-all relative">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              disabled={uploading} 
              className="w-full text-xs cursor-pointer opacity-70 file:mr-2 sm:file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
            />
          </div>
          <p className="text-[11px] text-gray-400 font-medium mt-2 leading-relaxed break-words">
            Supported Source Schema Columns: <code className="bg-gray-100 text-gray-600 px-1 py-0.5 rounded font-mono font-bold">Item No/SKU</code>, <code className="bg-gray-100 text-gray-600 px-1 py-0.5 rounded font-mono font-bold">Name/Product</code>, <code className="bg-gray-100 text-gray-600 px-1 py-0.5 rounded font-mono font-bold">Excl VAT/Price</code>
          </p>
        </div>

        {uploading && (
          <div className="text-blue-600 animate-pulse text-xs font-bold flex items-center gap-1.5 pt-2">
            ⏳ Processing bulk catalog sync transaction... Please do not close connection.
          </div>
        )}
        
        {message && (
          <div className={`p-4 rounded-xl text-xs font-bold border leading-relaxed break-words ${
            message.includes('✅') 
              ? 'bg-green-50 text-green-700 border-green-100' 
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message}
          </div>
        )}
      </div>

      <div className="bg-red-50/40 rounded-2xl border border-red-100 p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-black text-red-700 uppercase tracking-wide">⚠️ Master Catalog Data Purge</h2>
          <p className="text-[11px] text-red-900/60 mt-1">
            Permanently clear structural inventory records from the database schema. 
            {adminCompanyId !== 3 && " You will only delete products belonging to your assigned company context."}
          </p>
        </div>
        
        <div className="bg-white border border-red-100 rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
          <p className="text-xs text-gray-600">To proceed with total catalog erasure, type <strong className="text-red-600 select-all font-mono font-bold bg-red-50 px-1 rounded">DELETE ALL PRODUCTS</strong> below:</p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Verbatim authentication confirmation..." 
              value={flushConfirmation} 
              onChange={(e) => setFlushConfirmation(e.target.value)} 
              disabled={isFlushing}
              className="text-xs font-mono font-bold text-gray-800 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 flex-1 w-full" 
            />
            <button 
              type="button"
              onClick={handleMasterCatalogFlush} 
              disabled={isFlushing || flushConfirmation !== 'DELETE ALL PRODUCTS'} 
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-sm flex items-center justify-center min-w-[160px] w-full sm:w-auto"
            >
              {isFlushing ? 'Purging Records...' : 'Execute Table Purge'}
            </button>
          </div>
        </div>
      </div>

      {/* ⭐ INLINE MODAL OVERLAY INJECTED HERE */}
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