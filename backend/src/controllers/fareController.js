const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { quoteRoadFare, resolvePlaces } = require('../services/fareQuoteService');
const { isValidLatLng } = require('../utils/geo');

const checkPlace = (p, name) => {
  if (!p) throw new ApiError(400, `${name} is required`);
  if (p.lat !== undefined || p.lng !== undefined) {
    if (!isValidLatLng(Number(p.lat), Number(p.lng))) throw new ApiError(400, `${name} has invalid coordinates`);
  }
};

// POST /api/fare/quote  { origin, destination, pickupPoints? }  -> road distance, duration, route, fare
const quote = asyncHandler(async (req, res) => {
  const { origin, destination } = req.body;
  const pickupPoints = Array.isArray(req.body.pickupPoints) ? req.body.pickupPoints.slice(0, 10) : [];
  checkPlace(origin, 'origin');
  checkPlace(destination, 'destination');
  pickupPoints.forEach((p, i) => checkPlace(p, `pickupPoints[${i}]`));

  const failed = await resolvePlaces([origin, destination]);
  if (failed.length) throw new ApiError(422, `Could not find "${failed[0]}" on the map. Pick it from the search results.`);

  const result = await quoteRoadFare({ origin, destination, pickupPoints });
  if (!result.ok) {
    const status = result.reason === 'no_route' ? 422 : result.reason === 'invalid_input' || result.reason === 'missing_coordinates' ? 400 : 503;
    throw new ApiError(status, result.message || 'The road route could not be calculated');
  }
  const { ok, ...quoteBody } = result;
  res.json({ success: true, ...quoteBody });
});

module.exports = { quote };
