import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Users, Star, ShieldCheck, Music, Cigarette, PawPrint, Luggage, AlertTriangle } from 'lucide-react';
import { rideService } from '../../services/rideService';
import { bookingService } from '../../services/bookingService';
import { waitlistService } from '../../services/waitlistService';
import { reportService } from '../../services/reportService';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import { useAuth } from '../../hooks/useAuth';

export default function RideDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [selectedPickup, setSelectedPickup] = useState('');
  const [status, setStatus] = useState('');
  const [agreeDistance, setAgreeDistance] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');

  const load = useCallback(() => {
    rideService.getById(id).then((data) => {
      setRide(data.ride);
      if (data.ride.pickupPoints?.length) setSelectedPickup(data.ride.pickupPoints[0]._id);
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!ride) return <Loader label="Loading ride details..." />;

  const isFull = ride.seatsAvailable <= 0;
  // The fare for the boarding point currently selected (road-route rides price every stop separately)
  const chosenStop = ride.pickupPoints?.find((p) => p._id === selectedPickup);
  const myFare = ride.fareMode === 'auto' && chosenStop?.fare > 0 ? chosenStop.fare : ride.pricePerSeat;

  const handleBook = async () => {
    setStatus('');
    try {
      await bookingService.create({ rideId: ride._id, pickupPointId: selectedPickup, seatsRequested: 1, acceptDistanceBilling: agreeDistance });
      setStatus('Booking request sent! The driver will accept or reject it shortly.');
    } catch (err) {
      setStatus(typeof err === 'string' ? err : 'Could not create booking');
    }
  };

  const handleWaitlist = async () => {
    setStatus('');
    try {
      await waitlistService.join(ride._id);
      setStatus("You're on the waiting list. We'll notify you if a seat opens up.");
    } catch (err) {
      setStatus(typeof err === 'string' ? err : 'Could not join waiting list');
    }
  };

  const handleReport = async () => {
    try {
      await reportService.create({ reportedUserId: ride.driver?._id, rideId: ride._id, category: 'safety_concern', description: reportText });
      setShowReport(false);
      setReportText('');
      setStatus('Your safety report was submitted to our moderation team.');
    } catch (err) {
      setStatus(typeof err === 'string' ? err : 'Could not submit report');
    }
  };

  const prefIcons = [
    { key: 'music', icon: Music, label: 'Music' },
    { key: 'smoking', icon: Cigarette, label: 'Smoking OK' },
    { key: 'pets', icon: PawPrint, label: 'Pets OK' },
    { key: 'luggage', icon: Luggage, label: 'Luggage space' }
  ];

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: ride.driver?.avatarColor || '#7c3aed' }}
            >
              {ride.driver?.name?.[0]?.toUpperCase()}
            </span>
            <div>
              <p className="font-semibold">{ride.driver?.name}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {ride.driver?.ratingAverage?.toFixed(1) || 'New'} ({ride.driver?.ratingCount || 0} reviews) · {ride.driver?.completedRides || 0} completed
              </p>
            </div>
          </div>
          {ride.womenOnly && <Badge variant="purple" icon={ShieldCheck}>Women-Only</Badge>}
        </div>

        <div className="mb-4 flex items-center gap-3 text-sm">
          <MapPin className="h-4 w-4 text-brand-600" /> {ride.origin.label}
          <span className="text-slate-400">→</span>
          <MapPin className="h-4 w-4 text-accent-cyan" /> {ride.destination.label}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-slate-500 dark:text-slate-400">
          <p>Departure: {new Date(ride.departureTime).toLocaleString()}</p>
          <p className="flex items-center gap-1"><Users className="h-4 w-4" /> {ride.seatsAvailable}/{ride.totalSeats} seats available</p>
          {myFare > 0 && (
            <p>
              <b className="text-slate-800 dark:text-slate-100">₹{myFare}</b> per seat
              {ride.fareMode === 'auto' && <span className="text-xs"> · priced by road distance</span>}
            </p>
          )}
          {ride.distanceKm > 0 && <p>{ride.distanceKm} km by road{ride.fareMode === 'auto' ? '' : ' (driver’s estimate)'}</p>}
          <p className="capitalize">Status: {ride.status.replace(/_/g, ' ')}</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {prefIcons.filter(({ key }) => ride.preferences?.[key]).map(({ key, icon: Icon, label }) => (
            <Badge key={key} variant="slate" icon={Icon}>{label}</Badge>
          ))}
        </div>

        {ride.pickupPoints?.length > 0 && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Choose your pickup point</label>
            <select className="input" value={selectedPickup} onChange={(e) => setSelectedPickup(e.target.value)}>
              {ride.pickupPoints.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.label} {p.approxTime ? `(${p.approxTime})` : ''}{ride.fareMode === 'auto' && p.fare ? ` — ₹${p.fare}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {ride.fareBasis === 'actual' && user?.role === 'passenger' && (
          <label className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-900/10">
            <input type="checkbox" className="mt-1" checked={agreeDistance} onChange={(e) => setAgreeDistance(e.target.checked)} />
            <span>
              <b>Distance-based billing.</b> This driver bills by the GPS distance actually travelled instead of a fixed price:
              your quoted fare (₹{myFare}) × (distance actually driven ÷ planned {ride.distanceKm || ''} km), never more than 125% of the quote. I agree to this policy.
            </span>
          </label>
        )}

        {status && <div className="mb-4 rounded-lg bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-sm text-brand-700 dark:text-brand-300">{status}</div>}

        {user?.role === 'passenger' && (
          <div className="flex gap-3">
            {isFull ? (
              <button onClick={handleWaitlist} className="btn-secondary flex-1">Join waiting list — ride is full</button>
            ) : (
              <button onClick={handleBook} disabled={ride.fareBasis === 'actual' && !agreeDistance} className="btn-primary flex-1">Request a seat</button>
            )}
            <button onClick={() => setShowReport((v) => !v)} className="btn-secondary">
              <AlertTriangle className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {showReport && (
          <div className="mt-4 rounded-xl border border-rose-200 dark:border-rose-900 p-4">
            <label className="mb-1 block text-sm font-medium">Report a safety concern</label>
            <textarea className="input mb-2" rows={3} value={reportText} onChange={(e) => setReportText(e.target.value)} />
            <button onClick={handleReport} className="btn-primary" disabled={!reportText.trim()}>Submit report</button>
          </div>
        )}
      </div>
    </div>
  );
}
