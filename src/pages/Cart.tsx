import { Link } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'

export default function Cart() {
  const { items, updateQuantity, removeItem, getSubtotal } = useCartStore()

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
        <Link to="/" className="btn-primary">Continue Shopping</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.product_id} className="p-4 flex gap-4">
              <div className="flex-1">
                <h3 className="font-medium">{item.name}</h3>
                <div className="text-sm text-gray-500">{item.company_name}</div>
                <div className="text-blue-600 font-bold mt-1">
                  ${item.price} <span className="text-xs font-normal text-gray-400">excl VAT</span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="w-8 h-8 border rounded-lg hover:bg-gray-100">-</button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="w-8 h-8 border rounded-lg hover:bg-gray-100">+</button>
                  <button onClick={() => removeItem(item.product_id)} className="ml-auto text-red-500 text-sm">Remove</button>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">${(item.price * item.quantity).toFixed(2)}</div>
                <div className="text-xs text-gray-400">excl VAT</div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${getSubtotal().toFixed(2)}</span>
          </div>
          <Link to="/checkout" className="btn-primary w-full text-center block mt-4">Proceed to Checkout</Link>
        </div>
      </div>
    </div>
  )
}