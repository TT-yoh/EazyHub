import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { parsePaynowFormBody, validatePaynowInboundHash } from '../_shared/paynowHash.ts'

serve(async (req) => {
  try {
    const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY') ?? ''
    if (!integrationKey) {
      return new Response('Gateway not configured', { status: 500 })
    }

    const rawBody = await req.text()
    const entries = parsePaynowFormBody(rawBody)
    const fieldMap = Object.fromEntries(entries.map(([k, v]) => [k.toLowerCase(), v]))

    const receivedHash = fieldMap.hash ?? fieldMap.Hash ?? ''
    if (!receivedHash) {
      return new Response('Missing hash', { status: 400 })
    }

    const hashValid = await validatePaynowInboundHash(entries, integrationKey, receivedHash)
    if (!hashValid) {
      return new Response('Invalid hash', { status: 403 })
    }

    const reference = decodeURIComponent((fieldMap.reference ?? '').replace(/\+/g, ' '))
    const status = decodeURIComponent((fieldMap.status ?? '').replace(/\+/g, ' '))
    const amount = decodeURIComponent((fieldMap.amount ?? '0').replace(/\+/g, ' '))
    const paynowReference = decodeURIComponent((fieldMap.paynowreference ?? '').replace(/\+/g, ' '))

    if (!reference || !status) {
      return new Response('Missing Paynow Data', { status: 400 })
    }

    const orderId = reference.replace(/^Order-/i, '')
    const admin = createAdminClient()

    const { data: order } = await admin
      .from('orders')
      .select('id, total_amount, delivery_fee, payment_status')
      .eq('id', orderId)
      .maybeSingle()

    if (!order) {
      return new Response('OK', { status: 200 })
    }

    const expectedTotal = Number(
      (Number(order.total_amount) + Number(order.delivery_fee ?? 0)).toFixed(2),
    )
    const paidAmount = Number(parseFloat(amount).toFixed(2))

    if (status.toLowerCase() === 'paid') {
      if (paidAmount < expectedTotal) {
        console.error(`Amount mismatch for order ${orderId}: got ${paidAmount}, expected ${expectedTotal}`)
        return new Response('Amount mismatch', { status: 400 })
      }

      if (order.payment_status !== 'paid') {
        await admin
          .from('orders')
          .update({ status: 'processing', payment_status: 'paid' })
          .eq('id', orderId)

        await admin.from('payments').insert({
          order_id: orderId,
          amount: paidAmount,
          method: 'Paynow Gateway',
          reference: paynowReference,
          status: 'completed',
        })
      }
    } else if (status.toLowerCase() === 'cancelled') {
      await admin.from('orders').update({ payment_status: 'failed' }).eq('id', orderId)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook Error:', error)
    return new Response('Internal error', { status: 500 })
  }
})
