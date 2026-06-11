import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

export default function PaymentSandbox() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [paymentPhone, setPaymentPhone] = useState('')

  useEffect(() => {
    async function fetchOrderForPayment() {
      if (!orderId) return
      try {
        setLoading(true)
        
        // Pull the matching order info to verify invoice parameters
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, delivery_fee, payment_method, customer_id')
          .eq('id', orderId)
          .maybeSingle()

        if (error) throw error
        if (!data) {
          toast.error('Target payment reference non-existent.')
          navigate('/orders')
          return
        }

        setOrder(data)
        
        // Safely map down the client's phone digits if stored
        const { data: customer } = await supabase
          .from('customers')
          .select('phone')
          .eq('id', data.customer_id)
          .maybeSingle()
          
        if (customer?.phone) setPaymentPhone(customer.phone)

      } catch (err) {
        console.error(err)
        toast.error('Failed parsing transaction balance records.')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderForPayment()
  }, [orderId, navigate])

  if (loading) return <div className="text-center py-20 font-mono text-xs text-gray-400">Opening Secure Paynow Gateway Channel Node...</div>

  // Unified accounting arithmetic rules matrix
  const subtotal = Number(order?.total_amount || 0)
  const delivery = Number(order?.delivery_fee || 0)
  const grandTotal = subtotal + delivery
  
  const mockPaynowRef = `PAYNOW-SB-${Date.now().toString().slice(-6)}`

  const handleSimulatePayment = async (simulateSuccess: boolean) => {
    setProcessing(true)
    const statusToast = toast.loading(simulateSuccess ? 'Simulating USSD push response...' : 'Cancelling payment link routing...')
    
    try {
      if (simulateSuccess) {
        // 1. Write transactional tracking row using your exact column types schema matrix
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            order_id: order.id,
            amount: grandTotal,
            method: order.payment_method,
            reference: mockPaynowRef,
            status: 'completed', // ⭐ MATCHES YOUR BADGE CHECKER: Triggers your dashboard '✅ Paid' flag
            customer_screenshot_url: null,
            verified_by: null,
            verified_at: null
          })

        if (paymentError) throw paymentError

        // 2. Transition parent order tracking status markers into corporate visibility queues
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ 
            status: 'processing',
            payment_status: 'paid' 
          })
          .eq('id', order.id)

        if (orderUpdateError) throw orderUpdateError

        toast.success('Transaction Authenticated! Gateway funds captured.', { id: statusToast })
        navigate('/orders') // Route back to client history tracker card list
      } else {
        // Simulate fallback cancellation routines seamlessly
        await supabase
          .from('payments')
          .insert({
            order_id: order.id,
            amount: grandTotal,
            method: order.payment_method,
            reference: mockPaynowRef,
            status: 'failed'
          })

        toast.error('Transaction processing terminated by customer request.', { id: statusToast })
        navigate('/orders')
      }
    } catch (err: any) {
      console.error(err)
      toast.error(`Sandbox processing breakdown: ${err.message}`, { id: statusToast })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto pt-8 pb-20 px-4">
      {/* Paynow Simulated Brand Header Card */}
      <div className="bg-[#E5812B] text-white rounded-t-2xl p-5 text-center shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-widest bg-black/20 inline-block px-2.5 py-0.5 rounded-md mb-2 font-mono">
          Paynow Sandbox Environment
        </div>
        <h1 className="text-2xl font-black tracking-tight lowercase">paynow</h1>
        <p className="text-xs text-orange-100/90 mt-1">Inter-Merchant Mobile Settlement Gateway Mockup</p>
      </div>

      {/* Interactive Terminal Interface Wrapper */}
      <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl p-5 space-y-5 shadow-lg">
        
        {/* Ledger Balance Statement Info box */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Statement Amount Requested</span>
          <span className="text-3xl font-black text-gray-900 mt-1 block font-mono">
            ${grandTotal.toFixed(2)}
          </span>
          <div className="flex justify-center gap-3 text-[9px] font-mono text-gray-400 mt-2.5 pt-2.5 border-t border-gray-100">
            <span>Ticket: {order?.order_number}</span>
            <span>Gateway: <span className="uppercase text-orange-600 font-black">{order?.payment_method}</span></span>
          </div>
        </div>

        {/* Mock Input Interface Field Card */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
            Payer Handset Mobile Number
          </label>
          <input 
            type="tel"
            placeholder="e.g. 077XXXXXXX"
            value={paymentPhone}
            onChange={(e) => setPaymentPhone(e.target.value)}
            disabled={processing}
            className="w-full p-3 bg-gray-50 text-sm font-mono font-bold text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-[#E5812B] focus:bg-white transition-all shadow-inner"
          />
          <span className="text-[9px] text-gray-400 leading-tight block">
            Simulates firing an active cryptographic secure background push pin request straight to your mobile network account balance line.
          </span>
        </div>

        {/* Control Operation Execution Triggers Set */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => handleSimulatePayment(true)}
            disabled={processing}
            className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-40"
          >
            {processing ? 'Processing Sandbox Authorization...' : '✔️ Authorize Simulated Settlement'}
          </button>
          
          <button
            type="button"
            onClick={() => handleSimulatePayment(false)}
            disabled={processing}
            className="w-full py-3 text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-transparent hover:border-red-100 text-center block"
          >
            Decline & Void Purchase Ticket
          </button>
        </div>

        {/* Safety Disclaimer Warning Panel */}
        <div className="border-t border-dashed border-gray-100 pt-3 text-center">
          <span className="text-[9px] text-gray-400 font-medium leading-relaxed block">
            This module is handling mockup sandbox metrics exclusively. No electronic mobile wallet currency reserves will be checked, processed, or moved.
          </span>
        </div>

      </div>
    </div>
  )
}