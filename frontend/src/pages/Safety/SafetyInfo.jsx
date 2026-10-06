import { ShieldCheck, AlertTriangle, Phone } from 'lucide-react';

export default function SafetyInfo() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <ShieldCheck className="h-6 w-6 text-brand-600" /> Safety Information
      </h1>
      <div className="card mb-4">
        <h3 className="font-semibold">Women-Only rides are a matching preference, not a guarantee</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The Women-Only badge means eligibility is checked on our servers before a booking is
          allowed. It helps people find rides they're more comfortable with, but it does not
          replace your own judgment or verify anyone's identity beyond their account details.
        </p>
      </div>
      <div className="card mb-4">
        <h3 className="font-semibold">Profile verification</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          A "verified" badge reflects profile checks we perform, not government identity
          verification. Always use good judgment when meeting anyone in person.
        </p>
      </div>
      <div className="card">
        <h3 className="flex items-center gap-2 font-semibold text-rose-600">
          <AlertTriangle className="h-4.5 w-4.5" /> Report a concern
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You can report a safety concern from any ride's details page. Reports go straight to our
          moderation team.
        </p>
      </div>
    </div>
  );
}
