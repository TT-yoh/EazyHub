const HUB_LAT = Number(Deno.env.get('HUB_LAT') ?? '-20.1406')
const HUB_LNG = Number(Deno.env.get('HUB_LNG') ?? '28.5833')

export function haversineKm(lat: number, lng: number): number {
  const R = 6371
  const dLat = (lat - HUB_LAT) * (Math.PI / 180)
  const dLng = (lng - HUB_LNG) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(HUB_LAT * (Math.PI / 180)) *
      Math.cos(lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(2))
}

export type LogisticsRates = {
  mineazy: { basePrice: number; pricePerKm: number }
  farmeazy: { basePrice: number; pricePerKm: number }
}

export function deliveryFeesForCart(
  companyIds: number[],
  distanceKm: number,
  rates: LogisticsRates,
) {
  const hasMineazy = companyIds.includes(1)
  const hasFarmeazy = companyIds.includes(2)
  const mineazy = hasMineazy
    ? Number((rates.mineazy.basePrice + distanceKm * rates.mineazy.pricePerKm).toFixed(2))
    : 0
  const farmeazy = hasFarmeazy
    ? Number((rates.farmeazy.basePrice + distanceKm * rates.farmeazy.pricePerKm).toFixed(2))
    : 0
  return { mineazy, farmeazy, total: Number((mineazy + farmeazy).toFixed(2)) }
}

export async function loadLogisticsRates(admin: { from: (table: string) => any }) {
  const { data } = await admin
    .from('app_settings')
    .select('meta_key, meta_value')
    .in('meta_key', [
      'mineazy_base_price',
      'mineazy_price_per_km',
      'farmeazy_base_price',
      'farmeazy_price_per_km',
    ])

  const find = (key: string, fallback: number) =>
    Number(data?.find((r: { meta_key: string }) => r.meta_key === key)?.meta_value ?? fallback)

  return {
    mineazy: { basePrice: find('mineazy_base_price', 15), pricePerKm: find('mineazy_price_per_km', 2.5) },
    farmeazy: { basePrice: find('farmeazy_base_price', 5), pricePerKm: find('farmeazy_price_per_km', 1) },
  }
}
