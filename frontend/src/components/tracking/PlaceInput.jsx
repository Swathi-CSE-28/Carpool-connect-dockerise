import { useEffect, useRef, useState } from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
import { geoService } from '../../services/trackingService';

/**
 * Text field that resolves a typed place name to real coordinates via the
 * backend geocoding proxy. `value` = { label, lat?, lng? }. Coordinates are
 * optional: if the user just types a label the server geocodes it later.
 */
export default function PlaceInput({ value, onChange, placeholder, required }) {
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setResults([]); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const hasCoords = Number.isFinite(value.lat) && Number.isFinite(value.lng);
  const pickedRef = useRef(null); // label of the last chosen result (don't re-search it)
  const requestRef = useRef(0); // ignore answers to outdated searches

  const search = async (automatic = false) => {
    const q = (value.label || '').trim();
    if (q.length < 3) return automatic ? undefined : setMsg('Type at least 3 characters');
    const mine = ++requestRef.current;
    setBusy(true);
    setMsg('');
    try {
      const found = await geoService.search(q);
      if (mine !== requestRef.current) return;
      setResults(found);
      if (!found.length) setMsg('No matches. Try a nearby landmark or a more specific name.');
    } catch (err) {
      if (mine !== requestRef.current) return;
      setMsg(typeof err === 'string' ? err : 'Place search is unavailable right now.');
    } finally {
      if (mine === requestRef.current) setBusy(false);
    }
    return undefined;
  };

  // Search automatically shortly after the person stops typing.
  useEffect(() => {
    const q = (value.label || '').trim();
    if (hasCoords || q.length < 3 || q === pickedRef.current) return undefined;
    const id = setTimeout(() => search(true), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.label, hasCoords]);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex gap-1.5">
        <input
          required={required}
          className="input"
          placeholder={placeholder}
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })} // editing text clears stale coordinates
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(false); } }}
        />
        <button type="button" onClick={() => search(false)} className="btn-secondary !px-3" aria-label="Find on map" title="Find on map">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : hasCoords ? <Check className="h-4 w-4 text-emerald-600" /> : <Search className="h-4 w-4" />}
        </button>
      </div>
      {msg && <p className="mt-1 text-xs text-slate-500">{msg}</p>}
      {hasCoords && !msg && <p className="mt-1 text-xs text-emerald-600">Located on map</p>}
      {!hasCoords && !msg && !busy && (value.label || '').trim().length >= 3 && results.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">Choose a match from the list so the road route can be calculated.</p>
      )}
      {results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-sm shadow-card dark:border-slate-700 dark:bg-slate-900">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => { pickedRef.current = r.label.trim(); onChange({ label: r.label, lat: r.lat, lng: r.lng }); setResults([]); setMsg(''); }}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
