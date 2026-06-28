import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Paynow } from "npm:paynow"

// Standard CORS headers so your React frontend can call this function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS Preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Extract the order details from the React frontend
    const { orderId, amount, customerEmail, customerPhone } = await req.json()

    if (!orderId || !amount) {
      throw new Error("Missing required order parameters")
    }

    // 2. Initialize Paynow securely using Environment Variables
    const paynow = new Paynow(
      Deno.env.get('PAYNOW_INTEGRATION_ID') || '',
      Deno.env.get('PAYNOW_INTEGRATION_KEY') || ''
    )

    // Set the URLs Paynow will use to talk back to EazyHub
    // resultUrl: Where Paynow sends silent server-to-server updates
    // returnUrl: Where the customer is redirected after paying
    paynow.resultUrl = "https://your-project.supabase.co/functions/v1/paynow-webhook" 
    paynow.returnUrl = `https://your-website.com/orders/${orderId}?payment=success`

    // 3. Create a new Payment Object
    const payment = paynow.createPayment(`Order-${orderId}`, customerEmail || "guest@eazyhub.com")

    // 4. Add the cart total to the payment
    payment.add("EazyHub Unified Order", parseFloat(amount))

    // 5. Send to Paynow and wait for the checkout link
    const response = await paynow.send(payment)

    if (response.success) {
      // 6. Return the secure redirect URL to the React frontend
      return new Response(
        JSON.stringify({ 
          success: true, 
          redirectUrl: response.redirectUrl, 
          pollUrl: response.pollUrl // Save this to your DB if you want to check status later
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    } else {
      throw new Error(response.error || "Failed to initiate Paynow transaction")
    }

  } catch (error: any) {
    console.error("Paynow Error:", error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})