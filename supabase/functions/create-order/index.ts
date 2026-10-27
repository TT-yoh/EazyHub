import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createAdminClient, createUserClient } from '../_shared/supabaseAdmin.ts'
import { requireUser } from '../_shared/auth.ts'
import { deliveryFeesForCart, haversineKm, loadLogisticsRates } from '../_shared/logistics.ts'

interface CartLine {
  product_id: string
  quantity: number
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const authHeader = req.headers.get('Authorization')
    const userClient = createUserClient(authHeader)
    const user = await requireUser(userClient)
    const admin = createAdminClient()

    const { data: adminRow } = await admin.from('admin_users').select('id').eq('id', user.id).maybeSingle()
    if (adminRow) {
      return jsonResponse({ success: false, error: 'Administrators cannot place customer orders' }, 403)
    }

    const body = await req.json()
    const lines = body.lines as CartLine[]
    const deliveryLocation = String(body.deliveryLocation ?? '').trim()
    const deliveryLat = Number(body.deliveryLat)
    const deliveryLng = Number(body.deliveryLng)
    const paymentMethod = String(body.paymentMethod ?? 'ecocash')

    if (!Array.isArray(lines) || lines.length === 0) {
      return jsonResponse({ success: false, error: 'Cart is empty' }, 400)
    }
    if (!deliveryLocation || !Number.isFinite(deliveryLat) || !Number.isFinite(deliveryLng)) {
      return jsonResponse({ success: false, error: 'Delivery location is required' }, 400)
    }

    const productIds = [...new Set(lines.map((l) => l.product_id))]
    const { data: products, error: productsError } = await admin
      .from('products')
      .select('id, "Name", "Excl VAT", stock, company, is_active')
      .in('id', productIds)

    if (productsError || !products?.length) {
      return jsonResponse({ success: false, error: 'Products could not be loaded' }, 400)
    }

    const productMap = new Map(products.map((p) => [p.id, p]))
    let subtotal = 0
    const orderItems: { product_id: string; quantity: number; price_at_time: number }[] = []
    const companyIds: number[] = []

    for (const line of lines) {
      const qty = Math.floor(Number(line.quantity))
      if (!line.product_id || qty <= 0) {
        return jsonResponse({ success: false, error: 'Invalid cart line' }, 400)
      }

      const product = productMap.get(line.product_id)
      if (!product || product.is_active === false) {
        return jsonResponse({ success: false, error: 'Product unavailable' }, 400)
      }
      if (qty > Number(product.stock ?? 0)) {
        return jsonResponse({ success: false, error: `Insufficient stock for ${product.Name}` }, 400)
      }

      const price = Number(product['Excl VAT'])
      subtotal += price * qty
      companyIds.push(Number(product.company))
      orderItems.push({ product_id: product.id, quantity: qty, price_at_time: price })
    }

    const rates = await loadLogisticsRates(admin)
    const distanceKm = haversineKm(deliveryLat, deliveryLng)
    const fees = deliveryFeesForCart(companyIds, distanceKm, rates)
    const totalDue = Number((subtotal + fees.total).toFixed(2))

    const orderNumber = `EZ-${Date.now()}`
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: user.id,
        total_amount: Number(subtotal.toFixed(2)),
        payment_method: paymentMethod,
        delivery_location: deliveryLocation,
        delivery_fee: fees.total,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        status: 'pending',
        payment_status: 'pending',
      })
      .select('id, order_number')
      .single()

    if (orderError || !order) {
      throw new Error(orderError?.message ?? 'Failed to create order')
    }

    const itemsPayload = orderItems.map((item) => ({ ...item, order_id: order.id }))
    const { error: itemsError } = await admin.from('order_items').insert(itemsPayload)
    if (itemsError) {
      await admin.from('orders').delete().eq('id', order.id)
      throw new Error(itemsError.message)
    }

    for (const item of orderItems) {
      const product = productMap.get(item.product_id)!
      const nextStock = Number(product.stock) - item.quantity
      await admin.from('products').update({ stock: nextStock }).eq('id', item.product_id)
    }

    return jsonResponse({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      subtotal: Number(subtotal.toFixed(2)),
      deliveryFee: fees.total,
      totalDue,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order creation failed'
    const status = message === 'Unauthorized' ? 401 : 400
    return jsonResponse({ success: false, error: message }, status)
  }
})
