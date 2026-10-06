import { useEffect, useMemo, useState } from 'react';
import { Route as RouteIcon, Clock, Loader2, AlertTriangle, Receipt, MapPin } from 'lucide-react';
import LiveMap from '../tracking/LiveMap';
import { fareService } from '../../services/fareService';
import { decodePolyline, formatKm, money } from '../../utils/tracking';

const hasCoords = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/**
 * Asks the server for the ROAD route + fare as soon as origin and destination are located on the map,
 * shows it on a map, and reports the quote (or null) to the parent through onQuote.
 */
export default function RoadFarePreview({ origin, destination, pickups, onQuote }) {
  const [state, setState] = useState({ status: 'idle', quote: null, error: '' });

  const located = useMemo(() => pickups.filter(hasCoords).map((p, i) => ({ lat: p.lat, lng: p.lng, label: p.label, order: i })), [pickups]);
  const key = JSON.stringify([origin?.lat, origin?.lng, destination?.lat, destination?.lng, located.map((p) => [p.lat, p.lng])]);
  const ready = hasCoords(origin) && hasCoords(destination);

  useEffect(() => {
    if (!ready) {
      setState({ status: 'idle', quote: null, error: '' });
      onQuote(null);
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    onQuote(null);
    const id = setTimeout(async () => {
      try {
        const quote = await fareService.quote({
          origin: { label: origin.label, lat: origin.lat, lng: origin.lng },
          destination: { label: destination.label, lat: destination.lat, lng: destination.lng },
          pickupPoints: located
        });
        if (cancelled) return;
        setState({ status: 'ok', quote, error: '' });
        onQuote(quote);
      } catch (err) {
        if (cancelled) return;
        setState({ status: 'error', quote: null, error: typeof err === 'string' ? err : 'Could not calculate the road route.' });
        onQuote(null);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const line = useMemo(() => decodePolyline(state.quote?.geometry), [state.quote?.geometry]);
  const { status, quote, error } = state;

  if (!ready) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Choose the origin and destination from the search suggestions. The road route, distance and fare are then calculated automatically.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {status === 'loading' && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Calculating the road route…</p>}
      {status === 'error' && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{error}<br /><span className="text-xs">You can switch to “Manual” to enter a price yourself.</span></div>
        </div>
      )}
      <LiveMap origin={origin} destination={destination} pickups={located} route={line} autoFit hideRecenter height="h-64" />
      {quote && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-200 p-2 dark:border-slate-800"><p className="flex items-center justify-center gap-1 text-xs text-slate-500"><RouteIcon className="h-3.5 w-3.5" /> Road distance</p><p className="font-bold">{formatKm(quote.distanceKm)}</p></div>
            <div className="rounded-xl border border-slate-200 p-2 dark:border-slate-800"><p className="flex items-center justify-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" /> Drive time</p><p className="font-bold">{quote.durationMin} min</p></div>
            <div className="rounded-xl border border-brand-300 bg-brand-50 p-2 dark:border-brand-800 dark:bg-brand-900/20"><p className="flex items-center justify-center gap-1 text-xs text-slate-500"><Receipt className="h-3.5 w-3.5" /> Fare / seat</p><p className="font-bold text-brand-700 dark:text-brand-300">{money(quote.pricePerSeat)}</p></div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Fare = {quote.pricing.formula}. Calculated by the server from the road network.</p>
          {located.length > 0 && quote.pickups.some(Boolean) && (
            <ul className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
              <li className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Fare by boarding point</li>
              <li className="flex justify-between"><span>{origin.label.split(',')[0]} (start)</span><span className="font-medium">{money(quote.pricePerSeat)}</span></li>
              {pickups.filter(hasCoords).map((p, i) => quote.pickups[i] && (
                <li key={i} className="flex justify-between">
                  <span>{p.label.split(',')[0]} <span className="text-xs text-slate-500">({formatKm(quote.pickups[i].distanceToDestKm)} left)</span></span>
                  <span className="font-medium">{money(quote.pickups[i].fare)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
