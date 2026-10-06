/**
 * Simple, explainable matching service.
 *
 * This is intentionally NOT a real geospatial engine. It matches on
 * case-insensitive substring overlap of location labels and on time
 * proximity. No real distances or travel times are claimed anywhere
 * in this service's output — only approximate, explainable signals.
 */

const MS_PER_MINUTE = 60 * 1000;

function normalize(str = '') {
  return str.toLowerCase().trim();
}

function labelsOverlap(a, b) {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // crude "nearby" heuristic: shared significant word (>3 chars)
  const wordsA = na.split(/[\s,]+/).filter((w) => w.length > 3);
  const wordsB = nb.split(/[\s,]+/).filter((w) => w.length > 3);
  return wordsA.some((w) => wordsB.includes(w));
}

function minutesApart(dateA, dateB) {
  return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / MS_PER_MINUTE;
}

/**
 * Given a search request and a pool of candidate rides, returns rides
 * scored/annotated as "alternative" matches with a human-readable reason.
 */
function findAlternativeRides({ origin, destination, departureTime, flexibleMinutes = 30 }, candidateRides) {
  const results = [];

  for (const ride of candidateRides) {
    const reasons = [];
    let score = 0;

    const originExact = normalize(ride.origin.label) === normalize(origin);
    const destExact = normalize(ride.destination.label) === normalize(destination);

    if (originExact) score += 2;
    else if (labelsOverlap(ride.origin.label, origin)) {
      score += 1;
      reasons.push(`Pickup near "${origin}" (matched: "${ride.origin.label}")`);
    }

    if (destExact) score += 2;
    else if (labelsOverlap(ride.destination.label, destination)) {
      score += 1;
      reasons.push(`Destination near "${destination}" (matched: "${ride.destination.label}")`);
    }

    // Also check pickup points for nearby-origin matches
    const nearbyPickup = (ride.pickupPoints || []).find((p) => labelsOverlap(p.label, origin));
    if (nearbyPickup && !originExact) {
      score += 1;
      reasons.push(`Alternate pickup point available: "${nearbyPickup.label}"`);
    }

    if (departureTime) {
      const diff = minutesApart(ride.departureTime, departureTime);
      if (diff <= flexibleMinutes) {
        score += 1;
        reasons.push(`Departs ${Math.round(diff)} min from your requested time (within your ${flexibleMinutes}-min window)`);
      }
    }

    const isExactMatch = originExact && destExact;

    if (!isExactMatch && score > 0) {
      results.push({
        ride,
        matchType: 'alternative',
        approximateScore: score,
        reasons: reasons.length ? reasons : ['Partial route overlap detected'],
      });
    }
  }

  return results.sort((a, b) => b.approximateScore - a.approximateScore);
}

module.exports = { findAlternativeRides, labelsOverlap, minutesApart };
