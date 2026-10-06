const VARIANTS = {
  purple: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  red: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

export default function Badge({ children, variant = 'slate', icon: Icon }) {
  return (
    <span className={`badge ${VARIANTS[variant] || VARIANTS.slate}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}
