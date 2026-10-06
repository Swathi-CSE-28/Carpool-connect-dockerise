/**
 * Eco Impact estimates.
 *
 * All figures here are ESTIMATES based on simple documented assumptions,
 * not measured/verified data. Assumptions:
 *  - AVG_CO2_PER_KM_PER_CAR: average passenger car emits ~0.192 kg CO2/km (rough public estimate)
 *  - A "vehicle trip avoided" = one passenger seat filled on a ride they did not drive themselves
 */

const AVG_CO2_KG_PER_KM = 0.192;

function estimateEcoImpact({ completedBookings }) {
  // completedBookings: array of { ride: { distanceKm } }
  let sharedRides = 0;
  let estimatedDistanceKm = 0;
  let vehicleTripsAvoided = 0;

  for (const booking of completedBookings) {
    const distance = booking.ride?.distanceKm || 0;
    sharedRides += 1;
    estimatedDistanceKm += distance;
    vehicleTripsAvoided += 1; // one passenger seat = one trip they didn't drive themselves
  }

  const estimatedCO2SavedKg = Math.round(estimatedDistanceKm * AVG_CO2_KG_PER_KM * 10) / 10;

  return {
    sharedRides,
    estimatedDistanceKm: Math.round(estimatedDistanceKm * 10) / 10,
    vehicleTripsAvoided,
    estimatedCO2SavedKg,
    assumptions: [
      `Assumes ~${AVG_CO2_KG_PER_KM} kg CO2 saved per shared km (average passenger car estimate).`,
      'Assumes each completed booking represents one vehicle trip avoided.',
      'Distances are ride-level estimates, not GPS-measured.'
    ]
  };
}

module.exports = { estimateEcoImpact };
