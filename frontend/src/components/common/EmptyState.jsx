export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-16 text-center px-6">
      {Icon && <Icon className="h-10 w-10 text-slate-400" />}
      <h3 className="font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {message && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action}
    </div>
  );
}
