import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

const POLL_MS = 3000
const MAX_POLLS = 20

export default function PaymentReturn() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const polls = useRef(0)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!orderId) {
      navigate('/orders', { replace: true })
      return
    }

    let cancelled = false
    let interval: ReturnType<typeof setInterval>

    async function verifyAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login', { replace: true })
        return false
      }

      const { data: order } = await supabase
        .from('orders')
        .select('id, customer_id, payment_status')
        .eq('id', orderId)
        .maybeSingle()

      if (!order || order.customer_id !== user.id) {
        setDenied(true)
        return false
      }
      return true
    }

    async function poll() {
      const { data } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .maybeSingle()

      if (!data) return

      if (data.payment_status === 'paid') {
        clearInterval(interval)
        toast.success('Payment verified. Your order is processing.')
        navigate('/orders', { replace: true })
      } else if (data.payment_status === 'failed') {
        clearInterval(interval)
        toast.error('Payment failed or was cancelled.')
        navigate('/orders', { replace: true })
      }

      polls.current += 1
      if (polls.current >= MAX_POLLS) {
        clearInterval(interval)
        toast.error('Payment verification timed out. Check your order history.')
        navigate('/orders', { replace: true })
      }
    }

    verifyAccess().then((ok) => {
      if (cancelled || !ok) return
      poll()
      interval = setInterval(poll, POLL_MS)
    })

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [orderId, navigate])

  if (denied) {
    return (
      <div className="text-center py-16 text-sm text-red-600 font-semibold">
        You do not have access to this payment session.
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto pt-16 pb-20 px-4 text-center">
      <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl">
        <div className="w-20 h-20 mx-auto mb-6 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <h1 className="text-2xl font-black text-gray-900 mb-2">Verifying payment</h1>
        <p className="text-sm text-gray-500 mb-6">Waiting for Paynow confirmation. Keep this window open.</p>
        <div className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest bg-gray-50 py-2 rounded-lg">
          Order: {orderId?.slice(0, 8)}
        </div>
      </div>
    </div>
  )
}
