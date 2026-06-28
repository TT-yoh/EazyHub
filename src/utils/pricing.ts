// ⭐ Cost setup constants for fair recommended baseline engine
const SHOP_LAT = -20.172207244021752;
const SHOP_LNG = 28.57547755155542;
const BASE_DELIVERY_FEE = 3.00; // Minimum starting charge for rider dispatch
const RATE_PER_KM = 0.50;       // Additional dynamic rate multiplier per kilometer

/**
 * Haversine Trigonometric Distance Calculator Matrix Engine
 * Computes exact straight-line distance and a fixed delivery fee.
 */
export function calculateDeliveryCharges(customerLat: number, customerLng: number): { distanceKm: number; flatFee: number } {
  const R = 6371; // Earth absolute mean radius scale in kilometers
  
  const dLat = (customerLat - SHOP_LAT) * (Math.PI / 180);
  const dLng = (customerLng - SHOP_LNG) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(SHOP_LAT * (Math.PI / 180)) * Math.cos(customerLat * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // Calculate dynamic fare based on base fee + variable distance rates
  const calculatedFee = BASE_DELIVERY_FEE + (distanceKm * RATE_PER_KM);
  
  // Format to two decimal places for currency compatibility
  const flatFee = parseFloat(calculatedFee.toFixed(2));

  return {
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    flatFee
  };
}

/**
 * Reconstructs the exact delivery fee breakdown for historical accounting.
 * Uses the saved total_fee from the database and divides it based on current logic ratios.
 */
export function calculateHistoricalDeliveryBreakdown(
  totalSavedFee: number,
  deliveryLat: number | null,
  deliveryLng: number | null,
  hasMineazy: boolean,
  hasFarmeazy: boolean,
  logisticsConfig: {
    mineazy: { basePrice: number; pricePerKm: number };
    farmeazy: { basePrice: number; pricePerKm: number };
  }
) {
  // If no delivery fee was charged, return 0s
  if (!totalSavedFee || totalSavedFee <= 0) {
    return { mineazyFee: 0, farmeazyFee: 0 };
  }

  // If only one company was involved, they get 100% of the saved fee
  if (hasMineazy && !hasFarmeazy) return { mineazyFee: totalSavedFee, farmeazyFee: 0 };
  if (hasFarmeazy && !hasMineazy) return { mineazyFee: 0, farmeazyFee: totalSavedFee };
  if (!hasMineazy && !hasFarmeazy) return { mineazyFee: 0, farmeazyFee: 0 }; // eazyhub internal items only?

  // Fallback for no coordinates
  const lat = Number(deliveryLat || SHOP_LAT);
  const lng = Number(deliveryLng || SHOP_LNG);

  // Calculate theoretical distance using Haversine
  const R = 6371;
  const dLat = (lat - SHOP_LAT) * (Math.PI / 180);
  const dLng = (lng - SHOP_LNG) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(SHOP_LAT * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // Calculate theoretical current fees
  const theoreticalMineazy = logisticsConfig.mineazy.basePrice + (distanceKm * logisticsConfig.mineazy.pricePerKm);
  const theoreticalFarmeazy = logisticsConfig.farmeazy.basePrice + (distanceKm * logisticsConfig.farmeazy.pricePerKm);
  const theoreticalTotal = theoreticalMineazy + theoreticalFarmeazy;

  if (theoreticalTotal <= 0) return { mineazyFee: 0, farmeazyFee: 0 };

  // Determine ratio and apply to ACTUAL saved fee
  const mineazyRatio = theoreticalMineazy / theoreticalTotal;
  
  const mineazyFee = Number((totalSavedFee * mineazyRatio).toFixed(2));
  const farmeazyFee = Number((totalSavedFee - mineazyFee).toFixed(2)); // Ensures perfect total sum

  return { mineazyFee, farmeazyFee };
}