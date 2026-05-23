import { Link } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, getSubtotal, getTotalItems } = useCartStore()

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Cart ({getTotalItems()})</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Cart is empty</div>
          ) : (
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.product_id} className="flex gap-3 border-b pb-3">
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.company_name}</div>
                    <div className="text-blue-600">${item.price}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="w-7 h-7 border rounded">-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="w-7 h-7 border rounded">+</button>
                      <button onClick={() => removeItem(item.product_id)} className="ml-auto text-red-500 text-sm">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-4">
            <div className="flex justify-between font-bold mb-3">
              <span>Total: ${getSubtotal().toFixed(2)}</span>
            </div>
            <Link to="/cart" onClick={onClose} className="btn-primary w-full text-center block">
              View Cart
            </Link>
          </div>
        )}
      </div>
    </>
  )
}