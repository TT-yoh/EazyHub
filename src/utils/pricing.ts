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