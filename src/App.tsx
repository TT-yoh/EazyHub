import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Profile from './pages/Profile'
import AdminOrders from './pages/admin/AdminOrders'
import AdminProducts from './pages/admin/AdminProducts'
import AdminUpload from './pages/admin/AdminUpload'
import AdminUsers from './pages/admin/AdminUsers'
import type { Session } from '@supabase/supabase-js'
import { Toaster } from 'react-hot-toast';

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check initial user authentication session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        checkAdminStatus(session.user.id)
      } else {
        loading === true && setLoading(false)
      }
    })

    // Listen for real-time auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        checkAdminStatus(session.user.id)
      } else {
        setIsAdmin(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()
      
      setIsAdmin(!!data)
    } catch (error) {
      console.error('Error checking admin identification status:', error)
      setIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl font-medium text-gray-600">Loading EazyHub...</div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {/* ⭐ Added global configuration for the toast manager wrapper */}
      <Toaster 
        position="top-right" 
        reverseOrder={false} 
        toastOptions={{
          className: 'font-sans text-sm font-semibold rounded-xl border border-gray-100 shadow-md',
          duration: 3500,
        }}
      />

      <Routes>
        {/* Auth Entry Blocks - Redirect directly to Home (/) on login success */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/signup" element={!session ? <Signup /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!session ? <ForgotPassword /> : <Navigate to="/" />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* B2C & B2B Customer Interface Modules */}
        {/* Admins can view everything customers see. We pass 'isAdmin' into Layout so it can render the button */}
        <Route element={<Layout isAdmin={isAdmin} />}>
          <Route path="/" element={<Home />} />
          <Route path="/cart" element={session ? <Cart /> : <Navigate to="/login" />} />
          <Route path="/checkout" element={session ? <Checkout /> : <Navigate to="/login" />} />
          <Route path="/orders" element={session ? <Orders /> : <Navigate to="/login" />} />
          <Route path="/orders/:id" element={session ? <OrderDetail /> : <Navigate to="/login" />} />
          <Route path="/profile" element={session ? <Profile /> : <Navigate to="/login" />} />
        </Route>

        {/* Administrative Storefront Control Modules */}
        {/* Strict Check: Locked down tight so standard consumers are turned back to Home (/) */}
        <Route path="/admin" element={session && isAdmin ? <AdminLayout /> : <Navigate to="/" />}>
          <Route index element={<Navigate to="orders" />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="upload" element={<AdminUpload />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>

        {/* Global Fallback Route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App