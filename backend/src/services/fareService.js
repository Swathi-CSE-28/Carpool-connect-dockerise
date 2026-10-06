/**
 * Fare policy.
 *
 * The project's existing pricing rule is a flat `pricePerSeat` per ride plus an
 * estimated `distanceKm` (there was no separate billing/payment module), so the
 * distance-based fare is derived from those two numbers:
 *
 *     ratePerKm = pricePerSeat / plannedDistanceKm
 *
 * Two billing bases exist, chosen by the driver when offering the ride:
 *
 *  - "estimated" (default): every passenger pays the price quoted for their pickup x seats
 *    (pricePerSeat, or the per-pickup road-route fare). Route deviations are NEVER charged.
 *  - "actual": price scales with the GPS distance the server measured, i.e.
 *    ratePerKm x actualKm x seats - but only for passengers who explicitly
 *    agreed to that policy when booking (Booking.acceptedDistanceBilling), and
 *    never more than FARE_MAX_ACTUAL_FACTOR x the planned distance. If the GPS
 *    data is too thin to trust, we fall back to the estimated fare and say so.
 *
 * Shared rides: each booking snapshots the price quoted for ITS pickup stop
 * (rides created with fareMode "auto" price every stop by the road distance left
 * from that stop to the destination; otherwise everyone pays the listed price), so the
 * allocation is simply that per-seat quote x the passenger's seats.
 */
const cfg = require('../config/tracking');

const round2 = (n) => Math.round(n * 100) / 100;

function plannedDistanceKm(ride) {
  if (ride.distanceKm > 0) return ride.distanceKm;
  const routeM = ride.tracking?.route?.distanceMeters;
  return routeM > 0 ? round2(routeM / 1000) : 0;
}

/** The per-seat price this booking was quoted (falls back to the ride's listed price for older bookings). */
function quotedPerSeat(ride, booking) {
  return booking?.quotedPerSeat ?? ride.pricePerSeat ?? 0;
}

/** Planned road distance for THIS passenger: from their pickup stop to the destination when known. */
function passengerPlannedKm(ride, booking) {
  const stop = booking?.pickupPointId && ride.pickupPoints?.id ? ride.pickupPoints.id(booking.pickupPointId) : null;
  return (ride.fareMode === 'auto' && stop?.distanceToDestKm > 0) ? stop.distanceToDestKm : plannedDistanceKm(ride);
}

/** Fare shown before the ride: always the estimated (quoted) fare. */
function estimateFare(ride, seats = 1, booking = null) {
  const perSeat = quotedPerSeat(ride, booking);
  return {
    basis: 'estimated',
    perSeatAmount: perSeat,
    seats,
    totalAmount: round2(perSeat * seats),
    plannedDistanceKm: passengerPlannedKm(ride, booking) || null,
    policy: ride.fareBasis || 'estimated',
    fromRoadRoute: ride.fareMode === 'auto'
  };
}

/**
 * Final fare for one booking, given the server-measured distance of the whole ride.
 * For "actual" billing the passenger's quoted fare is scaled by how far the real drive
 * deviated from the plan:   quoted x (actual km / planned km),  capped at FARE_MAX_ACTUAL_FACTOR.
 * (Identical to ratePerKm x actual km when the passenger rides the whole route.)
 */
function finalizeFare({ ride, booking, actualMeters }) {
  const seats = booking.seatsRequested || 1;
  const quoted = quotedPerSeat(ride, booking);
  const ridePlannedKm = plannedDistanceKm(ride);
  const myPlannedKm = passengerPlannedKm(ride, booking);
  const actualKm = round2((actualMeters || 0) / 1000);
  const ratePerKm = myPlannedKm > 0 ? quoted / myPlannedKm : null;

  const base = {
    currency: 'INR',
    seats,
    plannedDistanceKm: ridePlannedKm || null,
    actualDistanceKm: actualKm,
    ratePerKm: ratePerKm !== null ? round2(ratePerKm) : null,
    capped: false,
    finalizedAt: new Date()
  };

  const estimated = (reason) => ({
    ...base,
    basis: 'estimated',
    basisReason: reason,
    perSeatAmount: quoted,
    totalAmount: round2(quoted * seats)
  });

  if (ride.fareBasis !== 'actual') return estimated('Ride uses the quoted (estimated route) price.');
  if (!booking.acceptedDistanceBilling) {
    return estimated('You did not agree to distance-based billing, so the quoted price applies.');
  }
  if (!(ridePlannedKm > 0)) return estimated('No planned distance is available, so the quoted price applies.');
  if ((actualMeters || 0) < cfg.FARE_MIN_ACTUAL_METERS) {
    return estimated('Not enough reliable GPS distance was recorded, so the quoted price applies.');
  }

  const ratio = actualKm / ridePlannedKm;
  const capped = ratio > cfg.FARE_MAX_ACTUAL_FACTOR;
  const perSeat = round2(quoted * (capped ? cfg.FARE_MAX_ACTUAL_FACTOR : ratio));

  return {
    ...base,
    basis: 'actual',
    basisReason: capped
      ? `Billed on GPS distance travelled, capped at ${Math.round((cfg.FARE_MAX_ACTUAL_FACTOR - 1) * 100)}% above the planned distance.`
      : 'Billed on the GPS distance actually travelled, as agreed when booking.',
    capped,
    perSeatAmount: perSeat,
    totalAmount: round2(perSeat * seats)
  };
}

module.exports = { estimateFare, finalizeFare, plannedDistanceKm, passengerPlannedKm, quotedPerSeat, round2 };
