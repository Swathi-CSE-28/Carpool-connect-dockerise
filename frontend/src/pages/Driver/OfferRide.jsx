import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import { rideService } from '../../services/rideService';
import { useAuth } from '../../hooks/useAuth';
import PlaceInput from '../../components/tracking/PlaceInput';
import RoadFarePreview from '../../components/rides/RoadFarePreview';

const emptyPickup = () => ({ label: '', approxTime: '' });
const place = (p) => ({ label: p.label, ...(Number.isFinite(p.lat) && Number.isFinite(p.lng) ? { lat: p.lat, lng: p.lng } : {}) });

export default function OfferRide() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    origin: { label: '' }, destination: { label: '' }, fareMode: 'auto', fareBasis: 'estimated', departureTime: '', totalSeats: 3, pricePerSeat: 0,
    womenOnly: false, distanceKm: '', notes: ''
  });
  const [pickups, setPickups] = useState([emptyPickup()]);
  const [preferences, setPreferences] = useState({ music: false, smoking: false, pets: false, luggage: true });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null); // road-route quote from the server (auto fare mode)

  const canOfferWomenOnly = user?.gender === 'female';

  const updatePickup = (idx, field, value) => {
    setPickups((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        const payload = {
          origin: place(form.origin),
          destination: place(form.destination),
          fareBasis: form.fareBasis,
          fareMode: form.fareMode,
          pickupPoints: pickups.filter((p) => p.label.trim()).map((p, idx) => ({ ...place(p), approxTime: p.approxTime, order: idx })),
          departureTime: form.departureTime,
          totalSeats: Number(form.totalSeats),
          womenOnly: form.womenOnly,
          preferences,
          notes: form.notes,
          // In auto mode the SERVER computes distance and price from the road route; nothing is sent from here.
          ...(form.fareMode === 'manual'
            ? { pricePerSeat: Number(form.pricePerSeat) || 0, distanceKm: Number(form.distanceKm) || 0 }
            : {})
        };
        await rideService.create(payload);
        navigate('/driver/my-rides');
      } catch (err) {
        setError(typeof err === 'string' ? err : 'Could not create ride');
      } finally {
        setLoading(false);
      }
    },
    [form, pickups, preferences, navigate]
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Offer a ride</h1>

      {error && <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-600">{error}</div>}

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Origin</label>
            <PlaceInput required placeholder="Search a place" value={form.origin} onChange={(v) => setForm((f) => ({ ...f, origin: v }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Destination</label>
            <PlaceInput required placeholder="Search a place" value={form.destination} onChange={(v) => setForm((f) => ({ ...f, destination: v }))} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Departure time</label>
          <input type="datetime-local" required className="input" value={form.departureTime} onChange={(e) => setForm((f) => ({ ...f, departureTime: e.target.value }))} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">Pickup points</label>
            <button type="button" onClick={() => setPickups((p) => [...p, emptyPickup()])} className="flex items-center gap-1 text-xs font-medium text-brand-600">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {pickups.map((p, idx) => (
            <div key={idx} className="mb-2 flex gap-2">
              <PlaceInput placeholder="Pickup point" value={p} onChange={(v) => setPickups((prev) => prev.map((x, i) => (i === idx ? { ...x, ...v, lat: v.lat, lng: v.lng } : x)))} />
              <input className="input" placeholder="Approx time" value={p.approxTime} onChange={(e) => updatePickup(idx, 'approxTime', e.target.value)} />
              {pickups.length > 1 && (
                <button type="button" onClick={() => setPickups((prev) => prev.filter((_, i) => i !== idx))} className="rounded-lg p-2 text-rose-600">
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Seats</label>
          <input type="number" min={1} className="input max-w-[8rem]" value={form.totalSeats} onChange={(e) => setForm((f) => ({ ...f, totalSeats: e.target.value }))} />
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <label className="text-sm font-medium">Fare &amp; distance</label>
            <div role="group" aria-label="Fare mode" className="inline-flex overflow-hidden rounded-xl border border-slate-200 text-xs font-semibold dark:border-slate-700">
              {[['auto', 'Auto (road route)'], ['manual', 'Manual']].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={form.fareMode === value}
                  onClick={() => setForm((f) => ({ ...f, fareMode: value }))}
                  className={`px-3 py-1.5 ${form.fareMode === value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.fareMode === 'auto' ? (
            <RoadFarePreview origin={form.origin} destination={form.destination} pickups={pickups} onQuote={setQuote} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Price / seat (₹)</label>
                <input type="number" min={0} className="input" value={form.pricePerSeat} onChange={(e) => setForm((f) => ({ ...f, pricePerSeat: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Est. distance (km)</label>
                <input type="number" min={0} className="input" value={form.distanceKm} onChange={(e) => setForm((f) => ({ ...f, distanceKm: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">How are passengers billed?</label>
          <select className="input" value={form.fareBasis} onChange={(e) => setForm((f) => ({ ...f, fareBasis: e.target.value }))}>
            <option value="estimated">Fixed price for the planned route (recommended)</option>
            <option value="actual">By distance actually travelled (GPS) — passengers must agree when booking</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {form.fareBasis === 'actual'
              ? 'Your quoted fare is scaled by (GPS distance ÷ planned distance), capped at 125% of the plan, and set by the server from GPS data.'
              : 'Passengers always pay the listed price; route deviations are never charged.'}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Ride preferences</label>
          <div className="flex flex-wrap gap-4">
            {Object.keys(preferences).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm capitalize">
                <input type="checkbox" checked={preferences[key]} onChange={(e) => setPreferences((p) => ({ ...p, [key]: e.target.checked }))} />
                {key}
              </label>
            ))}
          </div>
        </div>

        <label className={`flex items-center gap-2 text-sm ${!canOfferWomenOnly ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            disabled={!canOfferWomenOnly}
            checked={form.womenOnly}
            onChange={(e) => setForm((f) => ({ ...f, womenOnly: e.target.checked }))}
          />
          <ShieldCheck className="h-4 w-4 text-brand-600" /> Women-Only ride
        </label>
        {!canOfferWomenOnly && (
          <p className="text-xs text-slate-400">Only available for drivers whose profile gender is set to female.</p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>

        {form.fareMode === 'auto' && !quote && (
          <p className="text-xs text-slate-500">Publishing unlocks once the road route and fare have been calculated.</p>
        )}
        <button type="submit" disabled={loading || (form.fareMode === 'auto' && !quote)} className="btn-primary">{loading ? 'Publishing...' : 'Publish ride'}</button>
      </form>
    </div>
  );
}
