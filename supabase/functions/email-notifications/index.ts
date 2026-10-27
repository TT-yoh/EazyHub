import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createAdminClient, createUserClient } from '../_shared/supabaseAdmin.ts'
import { requireAnyAdmin, requireUser } from '../_shared/auth.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const authHeader = req.headers.get('Authorization')
    const userClient = createUserClient(authHeader)
    const user = await requireUser(userClient)
    const admin = createAdminClient()
    await requireAnyAdmin(admin, user.id)

    const { orderId, type } = await req.json()
    if (!orderId || !type) {
      return jsonResponse({ error: 'Missing orderId or type' }, 400)
    }

    const { data: order } = await admin
      .from('orders')
      .select('id, customer_id')
      .eq('id', orderId)
      .maybeSingle()

    if (!order) {
      return jsonResponse({ error: 'Order not found' }, 404)
    }

    const { data: customer } = await admin
      .from('customers')
      .select('email, name')
      .eq('id', order.customer_id)
      .maybeSingle()

    const customerEmail = customer?.email
    const customerName = customer?.name || 'Customer'

    if (!customerEmail) {
      return jsonResponse({ error: 'Customer email not found' }, 400)
    }

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY is not configured. Simulating email send for:', customerEmail)
      return jsonResponse({ success: true, simulated: true, message: 'Email logic executed without API key.' })
    }

    let subject = ''
    let htmlContent = ''

    if (type === 'dispatched') {
      subject = `🚚 Your EazyHub Order #${String(orderId).slice(0, 8)} is on the way!`
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h1 style="color: #2563eb;">Great news, ${customerName}!</h1>
          <p>Your order (Ref: <strong>${orderId}</strong>) has been <strong>dispatched</strong> and is en route.</p>
          <p>Track status in the EazyHub app.</p>
        </div>
      `
    } else if (type === 'receipt') {
      subject = `✅ Order Confirmation #${String(orderId).slice(0, 8)}`
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h1 style="color: #16a34a;">Order Confirmed!</h1>
          <p>Thank you, ${customerName}. Order <strong>${orderId}</strong> is processing.</p>
        </div>
      `
    } else {
      return jsonResponse({ error: 'Invalid email type' }, 400)
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'EazyHub <noreply@eazyhub.com>',
        to: [customerEmail],
        subject,
        html: htmlContent,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(`Resend Error: ${data.message || JSON.stringify(data)}`)
    }

    return jsonResponse({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status =
      message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return jsonResponse({ error: message }, status)
  }
})
