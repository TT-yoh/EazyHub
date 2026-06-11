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
import BulkImageUpload from './pages/admin/BulkImageUpload' 
import type { Session } from '@supabase/supabase-js'
import toast, { Toaster } from 'react-hot-toast' 
import SuperConsole from './pages/SuperConsole'
import AdminLogistics from './pages/admin/AdminLogistics'
import PaymentSandbox from './components/PaymentSandbox'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // ========================================================
  // ⭐ COLD-HIT TRUE INSTANT BROADCAST SECURITY CONTROLLER
  // ========================================================
  useEffect(() => {
    if (!session?.user?.id) return

    const currentUserId = session.user.id
    const customChannelName = `admin:${currentUserId}`

    const globalRoleSubscription = supabase
      .channel(customChannelName, {
        config: {
          broadcast: { self: false }, // Disables loopback processing to save client cycles
        },
      })
      .on(
        'broadcast', 
        { event: '*' }, 
        (payload) => {
          const eventType = payload.payload?.type || payload.type
          const recordData = payload.payload?.record || payload.record

          // Guard Clause: Instantly escape if the packet is meant for another user record row
          if (recordData && recordData.id !== currentUserId) return

          // ⚡ BYPASS REACT RENDER CYCLES FOR TRUE ZERO-DELAY EXECUTION
          if (eventType === 'INSERT') {
            localStorage.setItem('show_promotion_toast', 'true')
            window.location.href = window.location.href 
          }
          
          else if (eventType === 'DELETE') {
            window.location.href = '/?access_revoked=true' 
          }

          else if (eventType === 'UPDATE') {
            localStorage.setItem('show_update_toast', 'true')
            window.location.href = window.location.href 
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(globalRoleSubscription)
    }
  }, [session])

  // ========================================================
  // ⭐ PERSISTENT TOAST DISPATCHER AFTER FORCE CACHE RESETS
  // ========================================================
  useEffect(() => {
    if (localStorage.getItem('show_promotion_toast') === 'true') {
      toast.success('🎉 You have been granted Administrative access!')
      localStorage.removeItem('show_promotion_toast')
    }

    if (localStorage.getItem('show_update_toast') === 'true') {
      toast.error('⚠️ Administrative clearance updated. Synchronized permissions successfully.')
      localStorage.removeItem('show_update_toast')
    }

    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('access_revoked') === 'true') {
      toast.error('🔒 Your Administrative access has been revoked.')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [session])

  // ========================================================
  // CORE CORE AUTH INITIALIZATION ENGINE
  // ========================================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        checkAdminStatus(session.user.id)
      } else {
        setLoading(false)
      }
    })

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
      <Toaster 
        position="top-right" 
        reverseOrder={false} 
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'sans-serif',
            borderRadius: '14px',
            padding: '12px 16px',
            fontSize: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
          },
          success: {
            style: {
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              fontWeight: '700',
            },
            iconTheme: {
              primary: '#22c55e', 
              secondary: '#ffffff',
            },
          },
          error: {
            style: {
              background: '#fef2f2', 
              color: '#991b1b',      
              border: '1px solid #fee2e2',
              fontWeight: '700',
            },
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />

      <Routes>
        {/* Auth Entry Blocks */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/signup" element={!session ? <Signup /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!session ? <ForgotPassword /> : <Navigate to="/" />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Storefront Layout Interface Modules */}
        <Route element={<Layout isAdmin={isAdmin} />}>
          <Route path="/" element={<Home />} />
          <Route path="/cart" element={session ? <Cart /> : <Navigate to="/login" />} />
          <Route path="/checkout" element={session ? <Checkout /> : <Navigate to="/login" />} />
          <Route path="/payment/sandbox/:orderId" element={<PaymentSandbox />} />
          <Route path="/orders" element={session ? <Orders /> : <Navigate to="/login" />} />
          <Route path="/orders/:id" element={session ? <OrderDetail /> : <Navigate to="/login" />} />
          <Route path="/profile" element={session ? <Profile /> : <Navigate to="/login" />} />
        </Route>

        {/* Administrative Storefront Control Modules */}
        <Route path="/admin" element={session && isAdmin ? <AdminLayout /> : <Navigate to="/" />}>
          <Route index element={<Navigate to="orders" />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/edit/:id" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProducts />} />
          <Route path="logistics" element={<AdminLogistics />} />
          <Route path="upload" element={<AdminUpload />} />
          <Route path="upload-images" element={<BulkImageUpload />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="super-console" element={<SuperConsole />} /> 
          <Route path="orders/:id" element={<OrderDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}