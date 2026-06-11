import { useCartStore } from '../store/cartStore'

// ⭐ ADDED STATIC LOGO MAPPING: Links your hosted Supabase logos directly to the storefront
const COMPANY_STATIC: Record<number, { name: string; icon: string; logoUrl: string }> = {
  1: { 
    name: 'Mineazy', 
    icon: '⛏️',
    logoUrl: 'https://plmwckgshtxwgvwmbsvq.supabase.co/storage/v1/object/public/product-images/company-logos/mineazy-logo.png'
  },
  2: { 
    name: 'Farmeazy', 
    icon: '🚜',
    logoUrl: 'https://plmwckgshtxwgvwmbsvq.supabase.co/storage/v1/object/public/product-images/company-logos/farmeazy-logo.png'
  }
};

interface Product {
  id: string
  "Item No": string
  "Name": string
  "Unit": string
  "Excl VAT": number
  "Incl VAT": number
  stock: number
  company: number | string 
  image_url?: string
}

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)

  const companyId = Number(product.company)
  const isMineazy = companyId === 1
  const isOutOfStock = product.stock === 0

  // ⭐ Resolve brand details instantly based on the product database company ID mapping
  const brand = COMPANY_STATIC[companyId] || { name: 'General', icon: '📦', logoUrl: '' }

  const handleAddToCart = () => {
    if (isOutOfStock) return
    addItem({
      product_id: product.id,
      name: product["Name"],
      price: product["Excl VAT"],
      company_name: brand.name,
      unit: product["Unit"] || 'each',
      max_stock: product.stock,
    })
  }

  return (
    // 📱 Compact Grid card layout optimizations
    <div className="bg-white rounded-xl shadow-xs p-2.5 hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[290px] relative border border-gray-100/60">
      <div>
        
        {/* ⭐ UPGRADED LOGO BADGE BLOCK: Renders image graphic asset automatically */}
        <div className="flex items-center gap-1 mb-1.5">
          {brand.logoUrl ? (
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-100 flex-shrink-0">
              <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <span className="text-[10px]">{brand.icon}</span>
          )}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
            isMineazy ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'
          }`}>
            {brand.name}
          </span>
        </div>
        
        <div className="w-full h-24 bg-gray-50 border border-gray-100 rounded-lg mb-1.5 overflow-hidden flex items-center justify-center relative flex-shrink-0">
          {product.image_url ? (
            <img src={product.image_url} alt={product["Name"]} className="w-full h-full object-cover object-center" loading="lazy" />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-300 select-none">
              <span className="text-xl">{brand.icon}</span>
            </div>
          )}
        </div>

        <div className="text-[10px] text-gray-400 font-mono">{product["Item No"]}</div>
        <h3 className="font-bold text-xs mt-0.5 line-clamp-2 min-h-[32px] text-gray-800 leading-tight">{product["Name"]}</h3>
        
        <div className="mt-1.5 bg-gray-50/60 p-1.5 rounded-lg border border-gray-100 flex items-baseline justify-between">
          <div>
            <span className="text-blue-600 font-black text-sm">${Number(product["Excl VAT"]).toFixed(2)}</span>
            <span className="text-[9px] text-gray-400 ml-0.5">excl</span>
          </div>
          <div className="text-[9px] text-gray-400">
            ${Number(product["Incl VAT"]).toFixed(2)} Target
          </div>
        </div>
        
        <div className="mt-1.5 text-[10px] font-semibold">
          {isOutOfStock ? (
            <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md inline-block">Out of stock</span>
          ) : (
            <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md inline-block">Available ({product.stock})</span>
          )}
        </div>
      </div>

      <button
        onClick={handleAddToCart}
        disabled={isOutOfStock}
        className={`mt-2.5 w-full text-white text-xs py-1.5 rounded-md font-bold transition-all ${
          isOutOfStock ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  )
}