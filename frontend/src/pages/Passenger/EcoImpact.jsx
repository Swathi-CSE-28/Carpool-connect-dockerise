import { useEffect, useState } from 'react';
import { Leaf, Route, Car, CloudDrizzle } from 'lucide-react';
import { ecoService } from '../../services/ecoService';
import Loader from '../../components/common/Loader';

export default function EcoImpact() {
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    ecoService.getMine().then((data) => setImpact(data.impact));
  }, []);

  if (!impact) return <Loader label="Calculating your eco impact..." />;

  const stats = [
    { icon: Route, label: 'Shared rides', value: impact.sharedRides },
    { icon: Car, label: 'Est. distance shared (km)', value: impact.estimatedDistanceKm },
    { icon: Leaf, label: 'Est. vehicle trips avoided', value: impact.vehicleTripsAvoided },
    { icon: CloudDrizzle, label: 'Est. CO2 saved (kg)', value: impact.estimatedCO2SavedKg }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Leaf className="h-6 w-6 text-green-600" /> Eco Impact Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">All figures below are estimates based on documented assumptions, not measured data.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="card">
            <Icon className="mb-2 h-6 w-6 text-green-600" />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">Assumptions used</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-500 dark:text-slate-400">
          {impact.assumptions.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </div>
    </div>
  );
}
