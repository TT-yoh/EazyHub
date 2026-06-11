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
    return location.pathname === path ? 'text-blue-600 scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
  }

  const showCart = !isAdmin

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black text-blue-600 tracking-tight">EazyHub</Link>
          
          <div className="flex items-center gap-2">
            {showCart && (
              <button onClick={() => setCartOpen(true)} className="relative p-2.5 hover:bg-gray-50 rounded-full transition-colors text-xl">
                🛒
                {totalItems > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center animate-bounce">
                    {totalItems}
                  </span>
                )}
              </button>
            )}
            
            <Link to="/profile" className="p-2.5 hover:bg-gray-50 rounded-full transition-colors text-xl">
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-xl z-40">
        <div className="max-w-md mx-auto flex justify-around items-center py-1">
          
          <Link to="/" className={`flex flex-col items-center p-2 transition-all duration-200 ${isActive('/')}`}>
            <span className="text-xl sm:text-2xl">🏠</span>
            <span className="text-[10px] sm:text-xs tracking-wide mt-0.5">Home</span>
          </Link>
          
          {showCart && (
            <Link to="/cart" className={`flex flex-col items-center p-2 transition-all duration-200 ${isActive('/cart')}`}>
              <span className="text-xl sm:text-2xl relative">
                🛒
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </span>
              <span className="text-[10px] sm:text-xs tracking-wide mt-0.5">Cart</span>
            </Link>
          )}
          
          {!isAdmin && (
            <Link to="/orders" className={`flex flex-col items-center p-2 transition-all duration-200 ${isActive('/orders')}`}>
              <span className="text-xl sm:text-2xl">📦</span>
              <span className="text-[10px] sm:text-xs tracking-wide mt-0.5">Orders</span>
            </Link>
          )}
          
          {isAdmin && (
            <Link to="/admin/orders" className={`flex flex-col items-center p-2 transition-all duration-200 ${isActive('/admin/orders')}`}>
              <span className="text-xl sm:text-2xl">⚙️</span>
              <span className="text-[10px] sm:text-xs tracking-wide mt-0.5">Admin</span>
            </Link>
          )}
          
          <Link to="/profile" className={`flex flex-col items-center p-2 transition-all duration-200 ${isActive('/profile')}`}>
            <span className="text-xl sm:text-2xl">👤</span>
            <span className="text-[10px] sm:text-xs tracking-wide mt-0.5">Profile</span>
          </Link>
        </div>
      </nav>

      {showCart && (
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      )}
    </div>
  )
}