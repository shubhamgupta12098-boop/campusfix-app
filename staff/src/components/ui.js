export function PageHeader({ title, subtitle, action, eyebrow = 'CAMPUS OPERATIONS' }) {
    return (<div className="campus-page-header flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <p className="campus-eyebrow">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>);
}
export function StatCard({ label, value, icon: Icon, trend, color = 'blue', }) {
    return (<div className="campus-stat-card">
      <div className={'campus-stat-icon campus-stat-' + color}>
        <Icon className="w-5 h-5"/>
      </div>
      <p className="campus-stat-label">{label}</p>
      <p className="campus-stat-value">{value}</p>
      {trend && <p className={'campus-stat-trend campus-stat-' + color}>{trend}</p>}
    </div>);
}
export function Card({ children, className = '' }) {
    return <div className={'campus-card bg-white rounded-2xl border border-slate-200 ' + className}>{children}</div>;
}
export function Badge({ children, className = '' }) {
    return (<span className={'campus-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ' + className}>
      {children}
    </span>);
}
export function EmptyState({ icon: Icon, title, description }) {
    return (<div className="campus-empty-state flex flex-col items-center justify-center py-16 text-center">
      <div className="campus-empty-icon w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400"/>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
    </div>);
}
export function Spinner() {
    return (<div className="campus-spinner flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"/>
    </div>);
}
