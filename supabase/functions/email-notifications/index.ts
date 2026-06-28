import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, type, customerEmail, customerName } = await req.json()

    if (!orderId || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required payload parameters: orderId, type' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not configured. Simulating email send for:", customerEmail)
      return new Response(
        JSON.stringify({ success: true, simulated: true, message: 'Email logic executed without API key.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let subject = ''
    let htmlContent = ''

    if (type === 'dispatched') {
      subject = `🚚 Your EazyHub Order #${orderId.slice(0,8)} is on the way!`
      htmlContent = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h1 style="color: #2563eb;">Great news, ${customerName || 'Valued Customer'}!</h1>
          <p>Your order (Ref: <strong>${orderId}</strong>) has been <strong>dispatched</strong> and is currently en route to your provided GPS delivery target.</p>
          <p>You can track the live status via your EazyHub Dashboard.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">Thank you for trusting EazyHub Logistics.</p>
        </div>
      `
    } else if (type === 'receipt') {
      subject = `✅ Order Confirmation #${orderId.slice(0,8)}`
      htmlContent = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h1 style="color: #16a34a;">Order Confirmed!</h1>
          <p>Thank you for your purchase, ${customerName || 'Valued Customer'}.</p>
          <p>Your order (Ref: <strong>${orderId}</strong>) has been successfully placed and is now Processing in our fulfillment pipeline.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">If you have any questions, reply directly to this email.</p>
        </div>
      `
    } else {
      throw new Error("Invalid email type.")
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'EazyHub <noreply@eazyhub.com>',
        to: [customerEmail || 'test@example.com'],
        subject: subject,
        html: htmlContent
      })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(`Resend Error: ${data.message || JSON.stringify(data)}`)
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Email Edge Function Exception:", error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
