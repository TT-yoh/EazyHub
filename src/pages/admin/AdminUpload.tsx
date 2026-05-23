import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Papa from 'papaparse'

export default function AdminUpload() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [companyId, setCompanyId] = useState(1)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage('')

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const products = results.data.map((row: any) => ({
          "Item No": row["Item No"] || row.item_no,
          "Name": row["Name"] || row.name,
          "Unit": row["Unit"] || row.unit || 'each',
          "Excl VAT": parseFloat(row["Excl VAT"] || row.excl_vat || 0),
          "Incl VAT": parseFloat(row["Incl VAT"] || row.incl_vat || 0),
          company: companyId === 1 ? 'Mineazy' : 'Farmeazy',
          stock: parseInt(row.stock) || 0,
          is_active: true
        }))

        let successCount = 0
        let errorCount = 0

        for (const product of products) {
          const { error } = await supabase
            .from('products')
            .upsert(product, { onConflict: '"Item No"' })
          
          if (error) {
            errorCount++
            console.error(error)
          } else {
            successCount++
          }
        }

        setMessage(`✅ ${successCount} products updated. ❌ ${errorCount} failed.`)
        setUploading(false)
      },
      error: (error) => {
        setMessage(`Error parsing CSV: ${error.message}`)
        setUploading(false)
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload Products (CSV)</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Company target allocation channel</label>
          <select value={companyId} onChange={(e) => setCompanyId(parseInt(e.target.value))} className="input">
            <option value={1}>Mineazy Operations</option>
            <option value={2}>Farmeazy Operations</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Target Spreadsheet Source CSV File</label>
          <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} className="w-full text-sm" />
          <p className="text-xs text-gray-400 mt-1">Required Schema columns map: Item No, Name, Unit, Excl VAT, Incl VAT, stock</p>
        </div>
        {uploading && <div className="text-blue-600 animate-pulse text-sm">Parsing data matrices rows...</div>}
        {message && <div className={`mt-4 p-3 rounded text-sm ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</div>}
      </div>
    </div>
  )
}