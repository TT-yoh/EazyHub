import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

serve(async (req) => {
  try {
    // 1. Paynow sends form data, parse it
    const formData = await req.formData()
    const reference = formData.get("reference")?.toString() // e.g. "Order-123456"
    const paynowReference = formData.get("paynowreference")?.toString()
    const amount = formData.get("amount")?.toString()
    const status = formData.get("status")?.toString() // e.g. "Paid", "Cancelled"

    if (!reference || !status) {
      return new Response("Missing Paynow Data", { status: 400 })
    }

    const orderId = reference.replace("Order-", "")

    // 2. Initialize Supabase Admin Client (To bypass RLS and force the update)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. If Paid, update the Database!
    if (status.toLowerCase() === 'paid') {
      
      // Update the Order
      await supabase
        .from('orders')
        .update({ status: 'processing', payment_status: 'paid' })
        .eq('id', orderId)

      // Create a Payment Receipt record
      await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          amount: parseFloat(amount || "0"),
          method: "Paynow Gateway",
          reference: paynowReference,
          status: "completed"
        })
    } else if (status.toLowerCase() === 'cancelled') {
       await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', orderId)
    }

    // Paynow requires a blank 200 response to confirm receipt
    return new Response("OK", { status: 200 })

  } catch (error: any) {
    console.error("Webhook Error:", error.message)
    return new Response(error.message, { status: 500 })
  }
})