import { useCartStore } from '../store/cartStore'

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

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)

  const handleAddToCart = () => {
    if (product.stock === 0) return
    addItem({
      product_id: product.id,
      name: product["Name"],
      price: product["Excl VAT"],
      company_name: product.company,
      unit: product["Unit"] || 'each',
      max_stock: product.stock,
    })
  }

  const isMineazy = product.company === 'Mineazy'
  const isOutOfStock = product.stock === 0

  return (
    <div className="bg-white rounded-lg shadow p-3 hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[380px]">
      <div>
        <div className={`text-xs px-2 py-0.5 rounded-full inline-block mb-2 font-medium ${
          isMineazy ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {isMineazy ? '⛏️ Mineazy' : '🌾 Farmeazy'}
        </div>
        
        {/* Aspect-locked media container avoids Cumulative Layout Shifts */}
        <div className="w-full h-36 bg-gray-50 border border-gray-100 rounded-md mb-2 overflow-hidden flex items-center justify-center relative flex-shrink-0">
          {product.image_url ? (
            <img src={product.image_url} alt={product["Name"]} className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-300 select-none">
              <span className="text-3xl">{isMineazy ? '⚙️' : '🚜'}</span>
              <span className="text-[9px] mt-1 uppercase tracking-wider font-bold">No Image Asset</span>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 font-mono">{product["Item No"]}</div>
        <h3 className="font-bold text-sm mt-1 line-clamp-2 min-h-[40px] text-gray-800 leading-tight">{product["Name"]}</h3>
        <div className="text-xs text-gray-400 mt-0.5">{product["Unit"]}</div>
        
        <div className="mt-2 bg-gray-50/70 p-2 rounded-md border border-gray-100">
          <div>
            <span className="text-blue-600 font-black text-base">${Number(product["Excl VAT"]).toFixed(2)}</span>
            <span className="text-[10px] text-gray-400 ml-1">excl</span>
          </div>
          <div className="text-xs text-gray-500 font-medium">
            ${Number(product["Incl VAT"]).toFixed(2)} incl VAT
          </div>
        </div>
        
        <div className="mt-2 text-xs font-semibold">
          {isOutOfStock ? (
            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md inline-block">Out of stock</span>
          ) : (
            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-md inline-block">Available ({product.stock})</span>
          )}
        </div>
      </div>

      <button
        onClick={handleAddToCart}
        disabled={isOutOfStock}
        className={`mt-3 w-full text-white text-sm py-2 rounded-lg font-bold transition-all ${
          isOutOfStock ? 'bg-gray-200 cursor-not-allowed text-gray-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
        }`}
      >
        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  )
}