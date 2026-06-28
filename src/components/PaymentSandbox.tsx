import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

export default function PaymentSandbox() { // Kept name same so App.tsx routing doesn't break
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState(0)

  // Polling logic: Checks Supabase every 3 seconds to see if Paynow webhook cleared the payment
  useEffect(() => {
    if (!orderId) return;

    let interval: ReturnType<typeof setInterval>;

    async function checkPaymentStatus() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, payment_status')
          .eq('id', orderId)
          .maybeSingle()

        if (error || !data) return;
        setOrder(data);

        if (data.payment_status === 'paid') {
          clearInterval(interval);
          toast.success('Payment Verified! Your order is now processing.');
          navigate('/orders');
        } else if (data.payment_status === 'failed') {
          clearInterval(interval);
          toast.error('Payment Failed or Cancelled.');
          navigate('/orders');
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
        setAttempts(prev => prev + 1)
      }
    }

    // Initial check
    checkPaymentStatus()

    // Poll every 3 seconds
    interval = setInterval(() => {
      checkPaymentStatus()
    }, 3000)

    // Timeout after 60 seconds (20 attempts) to prevent infinite loops
    if (attempts >= 20) {
      clearInterval(interval)
      toast.error('Payment verification timed out. Please check your order history.')
      navigate('/orders')
    }

    return () => clearInterval(interval)
  }, [orderId, navigate, attempts])

  if (loading) return null;

  return (
    <div className="w-full max-w-md mx-auto pt-16 pb-20 px-4 text-center">
      <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl">
        <div className="w-20 h-20 mx-auto mb-6">
          {/* Animated loading ring */}
          <div className="w-full h-full border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Verifying Payment</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Waiting for confirmation from Paynow... Please do not close this window.
        </p>
        
        <div className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest bg-gray-50 py-2 rounded-lg">
          Order Ref: {order?.id?.split('-')[0]}
        </div>
      </div>
    </div>
  )
}