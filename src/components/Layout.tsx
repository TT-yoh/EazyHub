import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useCartStore } from '../store/cartStore'
import CartDrawer from './CartDrawer'

interface LayoutProps {
  isAdmin: boolean
}

export default function Layout({ isAdmin }: LayoutProps) {
  const [cartOpen, setCartOpen] = useState(false)
  const totalItems = useCartStore(state => state.getTotalItems())
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-blue-600' : 'text-gray-500'
  }

  // Don't show cart for admins
  const showCart = !isAdmin

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-blue-600">EazyHub</Link>
          
          <div className="flex items-center gap-3">
            {/* Cart Icon - Only for customers */}
            {showCart && (
              <button onClick={() => setCartOpen(true)} className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
                🛒
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>
            )}
            
            {/* Profile Icon */}
            <Link to="/profile" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-xl">
              👤
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
        <div className="flex justify-around items-center py-2">
          {/* Home - Everyone */}
          <Link to="/" className={`flex flex-col items-center p-2 ${isActive('/')}`}>
            <span className="text-2xl">🏠</span>
            <span className="text-xs mt-1">Home</span>
          </Link>
          
          {/* Cart - Only for customers */}
          {showCart && (
            <Link to="/cart" className={`flex flex-col items-center p-2 ${isActive('/cart')}`}>
              <span className="text-2xl relative">
                🛒
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </span>
              <span className="text-xs mt-1">Cart</span>
            </Link>
          )}
          
          {/* Orders - Only for customers now 📦 */}
          {!isAdmin && (
            <Link to="/orders" className={`flex flex-col items-center p-2 ${isActive('/orders')}`}>
              <span className="text-2xl">📦</span>
              <span className="text-xs mt-1">Orders</span>
            </Link>
          )}
          
          {/* Admin Dashboard - Only for admins */}
          {isAdmin && (
            <Link to="/admin/orders" className={`flex flex-col items-center p-2 ${isActive('/admin/orders')}`}>
              <span className="text-2xl">⚙️</span>
              <span className="text-xs mt-1">Admin</span>
            </Link>
          )}
          
          {/* Profile - Everyone */}
          <Link to="/profile" className={`flex flex-col items-center p-2 ${isActive('/profile')}`}>
            <span className="text-2xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>

      {/* Cart Drawer - Only for customers */}
      {showCart && (
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      )}
    </div>
  )
}