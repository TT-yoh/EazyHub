import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Paynow } from 'npm:paynow'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { createAdminClient, createUserClient } from '../_shared/supabaseAdmin.ts'
import { requireUser } from '../_shared/auth.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const authHeader = req.headers.get('Authorization')
    const userClient = createUserClient(authHeader)
    const user = await requireUser(userClient)
    const admin = createAdminClient()

    const { orderId } = await req.json()
    if (!orderId) {
      return jsonResponse({ success: false, error: 'Missing orderId' }, 400)
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, customer_id, total_amount, delivery_fee, payment_status')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      return jsonResponse({ success: false, error: 'Order not found' }, 404)
    }
    if (order.customer_id !== user.id) {
      return jsonResponse({ success: false, error: 'Forbidden' }, 403)
    }
    if (order.payment_status === 'paid') {
      return jsonResponse({ success: false, error: 'Order is already paid' }, 400)
    }

    const expectedTotal = Number(
      (Number(order.total_amount) + Number(order.delivery_fee ?? 0)).toFixed(2),
    )

    const integrationId = Deno.env.get('PAYNOW_INTEGRATION_ID') ?? ''
    const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '')

    if (!integrationId || !integrationKey || !supabaseUrl || !siteUrl) {
      throw new Error('Payment gateway is not configured')
    }

    const paynow = new Paynow(integrationId, integrationKey)
    paynow.resultUrl = `${supabaseUrl}/functions/v1/paynow-webhook`
    paynow.returnUrl = `${siteUrl}/payment/return/${orderId}`

    const payment = paynow.createPayment(`Order-${orderId}`, user.email ?? 'guest@eazyhub.com')
    payment.add('EazyHub Unified Order', expectedTotal)

    const response = await paynow.send(payment)
    if (!response.success) {
      throw new Error(response.error || 'Failed to initiate Paynow transaction')
    }

    return jsonResponse({
      success: true,
      redirectUrl: response.redirectUrl,
      pollUrl: response.pollUrl,
      amount: expectedTotal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed'
    const status = message === 'Unauthorized' ? 401 : 400
    return jsonResponse({ success: false, error: message }, status)
  }
})
