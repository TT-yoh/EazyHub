import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import toast, { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SessionProvider, useSession } from './context/SessionContext'
import RequireAuth from './components/RequireAuth'
import RequireAdmin from './components/RequireAdmin'
import RequireSuperAdmin from './components/RequireSuperAdmin'

// Lazy-loaded routes for optimal bundle code-splitting
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Home = lazy(() => import('./pages/Home'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'))
const AdminUpload = lazy(() => import('./pages/admin/AdminUpload'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const BulkImageUpload = lazy(() => import('./pages/admin/BulkImageUpload'))
const SuperConsole = lazy(() => import('./pages/SuperConsole'))
const AdminLogistics = lazy(() => import('./pages/admin/AdminLogistics'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const PaymentReturn = lazy(() => import('./components/PaymentReturn'))

function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function LegacyPaymentRedirect() {
  const { orderId } = useParams()
  return <Navigate to={`/payment/return/${orderId}`} replace />
}

function AppContent() {
  const navigate = useNavigate()
  const { session, admin, setAdminLive } = useSession()

  useEffect(() => {
    if (!session?.user?.id) return

    const currentUserId = session.user.id
    const channel = supabase
      .channel(`admin:${currentUserId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: '*' }, (payload) => {
        const eventType = payload.payload?.type || payload.type
        const recordData = payload.payload?.record || payload.record
        if (recordData && recordData.id !== currentUserId) return

        if (eventType === 'INSERT') {
          setAdminLive({ isAdmin: true, isSuperAdmin: recordData?.role === 'super_admin' })
          toast.success('You have been granted administrative access.')
        } else if (eventType === 'DELETE') {
          setAdminLive({ isAdmin: false, isSuperAdmin: false, role: null, companyId: null })
          toast.error('Your administrative access has been revoked.')
          navigate('/')
        } else if (eventType === 'UPDATE') {
          toast('Administrative permissions were updated.')
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, navigate, setAdminLive])

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <ErrorBoundary>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
            <Route path="/signup" element={!session ? <Signup /> : <Navigate to="/" replace />} />
            <Route path="/forgot-password" element={!session ? <ForgotPassword /> : <Navigate to="/" replace />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<RequireAuth />}>
              <Route element={<Layout isAdmin={admin.isAdmin} />}>
                <Route path="/" element={<Home />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/payment/return/:orderId" element={<PaymentReturn />} />
                <Route path="/payment/sandbox/:orderId" element={<LegacyPaymentRedirect />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              <Route path="/admin" element={<RequireAdmin />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Navigate to="orders" replace />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="products/edit/:id" element={<AdminProducts />} />
                  <Route path="products/new" element={<AdminProducts />} />
                  <Route path="logistics" element={<AdminLogistics />} />
                  <Route path="upload" element={<AdminUpload />} />
                  <Route path="upload-images" element={<BulkImageUpload />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="orders/:id" element={<OrderDetail />} />
                  <Route element={<RequireSuperAdmin />}>
                    <Route path="super-console" element={<SuperConsole />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  )
}

function AppShell() {
  const { loading } = useSession()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-xl font-medium text-gray-600">Loading EazyHub...</div>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  )
}
