export function PageHeader({ title, subtitle, action }) {
    return (<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>);
}
export function StatCard({ label, value, icon: Icon, trend, color = 'blue', }) {
    const colors = {
        blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
        emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
        amber: 'from-amber-500 to-amber-600 shadow-amber-500/20',
        rose: 'from-rose-500 to-rose-600 shadow-rose-500/20',
        violet: 'from-violet-500 to-violet-600 shadow-violet-500/20',
        cyan: 'from-cyan-500 to-cyan-600 shadow-cyan-500/20',
        slate: 'from-slate-500 to-slate-600 shadow-slate-500/20',
    };
    return (<div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5">{value}</p>
          {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white"/>
        </div>
      </div>
    </div>);
}
export function Card({ children, className = '' }) {
    return <div className={`bg-white rounded-2xl border border-slate-200 ${className}`}>{children}</div>;
}
export function Badge({ children, className = '' }) {
    return (<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>
      {children}
    </span>);
}
export function EmptyState({ icon: Icon, title, description }) {
    return (<div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400"/>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
    </div>);
}
export function Spinner() {
    return (<div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"/>
    </div>);
}
