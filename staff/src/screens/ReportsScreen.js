import { useEffect, useMemo, useState } from 'react';
import { localData } from '@/lib/localDataClient';
import { useAuthStore } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import { formatDate } from '@/lib/constants';
import { downloadTextFile, exportPageAsPdf } from '@/lib/download';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Info,
  MessageCircle,
  FileSpreadsheet,
  FileText,
  PieChart,
  Star,
  UserRoundCog,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

const PALETTE = ['#6d40d8', '#2e7be6', '#37ad62', '#f28a2c', '#e8505b', '#14a7b8'];

const isResolved = (complaint) => ['resolved', 'closed'].includes(complaint.status);
const safeDate = (value) => value ? new Date(value) : null;
const hoursBetween = (from, to) => {
  const start = safeDate(from);
  const end = safeDate(to);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, (end.getTime() - start.getTime()) / 3600000);
};

function periodBounds(days) {
  if (days === 'all') return { start: null, previousStart: null, previousEnd: null };
  const dayCount = Number(days);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - dayCount + 1);
  start.setHours(0, 0, 0, 0);
  const previousEnd = new Date(start);
  previousEnd.setMilliseconds(-1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - dayCount + 1);
  previousStart.setHours(0, 0, 0, 0);
  return { start, end, previousStart, previousEnd };
}

function filterByPeriod(rows, bounds, previous = false) {
  if (!bounds.start) return previous ? [] : rows;
  const start = previous ? bounds.previousStart : bounds.start;
  const end = previous ? bounds.previousEnd : bounds.end;
  return rows.filter((row) => {
    const date = safeDate(row.created_at);
    return date && date >= start && date <= end;
  });
}

function summarize(rows) {
  const total = rows.length;
  const resolvedRows = rows.filter(isResolved);
  const resolved = resolvedRows.length;
  const resolutionHours = resolvedRows
    .map((row) => hoursBetween(row.created_at, row.resolved_at || row.updated_at))
    .filter((value) => value !== null);
  const avgResolutionHours = resolutionHours.length
    ? resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length
    : 0;
  const reopened = rows.filter((row) => row.status === 'reopened' || row.reopened_at || Number(row.reopen_count || 0) > 0).length;
  const reopenedRate = total ? (reopened / total) * 100 : 0;
  return { total, resolved, avgResolutionHours, reopened, reopenedRate };
}

function changePercent(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function DonutChart({ items, total }) {
  let angle = 0;
  const segments = items.map((item) => {
    const start = angle;
    const share = total ? (item.total / total) * 360 : 0;
    angle += share;
    return `${item.color} ${start}deg ${angle}deg`;
  });
  const background = segments.length ? `conic-gradient(${segments.join(', ')})` : '#e9eef5';

  return (
    <div className="flex items-center gap-5 min-h-[172px]">
      <div className="relative w-32 h-32 flex-none rounded-full" style={{ background }}>
        <div className="absolute inset-[27px] rounded-full bg-white grid place-items-center shadow-inner">
          <div className="text-center">
            <strong className="block text-2xl text-slate-900 leading-none">{total}</strong>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total</span>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 min-w-0">
        {items.slice(0, 4).map((item) => (
          <div key={item.id || item.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: item.color }}/>
            <span className="text-slate-600 truncate flex-1">{item.name}</span>
            <span className="font-bold text-slate-900">{total ? Math.round((item.total / total) * 100) : 0}%</span>
            <span className="text-slate-400 w-8 text-right">({item.total})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResolutionBars({ buckets }) {
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  return (
    <div className="h-[172px] flex items-end gap-4 px-2 pt-4">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex-1 h-full flex flex-col justify-end items-center min-w-0">
          <span className="text-xs font-bold text-slate-700 mb-1">{bucket.value}</span>
          <div className="w-full max-w-[54px] rounded-t-md" style={{ height: `${Math.max(7, (bucket.value / max) * 115)}px`, backgroundColor: bucket.color }}/>
          <span className="mt-2 text-[11px] font-semibold text-slate-500 whitespace-nowrap">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}

function StaffBars({ rows }) {
  const topRows = rows.slice(0, 5);
  return (
    <div className="space-y-3 pt-2">
      {topRows.length === 0 && <p className="text-sm text-slate-400 py-12 text-center">No staff performance data yet</p>}
      {topRows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-[112px_1fr_38px] items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700 truncate">{row.full_name}</span>
          <div className="h-4 rounded-sm bg-slate-100 overflow-hidden">
            <div className="h-full rounded-sm" style={{ width: `${row.rate}%`, backgroundColor: PALETTE[index % PALETTE.length] }}/>
          </div>
          <span className="font-bold text-slate-800 text-right">{row.rate}%</span>
        </div>
      ))}
    </div>
  );
}

function TrendLine({ points }) {
  const width = 360;
  const height = 150;
  const padX = 24;
  const padTop = 18;
  const padBottom = 28;
  const max = Math.max(...points.map((point) => point.value), 1);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padX + (index * (width - padX * 2)) / (points.length - 1);
    const y = padTop + (1 - point.value / max) * (height - padTop - padBottom);
    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="h-[172px] w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" role="img" aria-label="Monthly complaints trend">
        {[0.25, 0.5, 0.75, 1].map((line) => (
          <line key={line} x1={padX} x2={width - padX} y1={padTop + (1 - line) * (height - padTop - padBottom)} y2={padTop + (1 - line) * (height - padTop - padBottom)} stroke="#e8edf3" strokeDasharray="4 5"/>
        ))}
        <path d={path} fill="none" stroke="#6d40d8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {coordinates.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="#6d40d8" stroke="white" strokeWidth="2"/>
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Metric({ icon: Icon, label, value, delta, inverse = false, colorClass = 'bg-blue-50 text-blue-600' }) {
  const improved = inverse ? delta <= 0 : delta >= 0;
  const DeltaIcon = improved ? TrendingUp : TrendingDown;
  return (
    <div className="px-4 py-4 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-9 h-9 rounded-full grid place-items-center ${colorClass}`}><Icon size={18}/></span>
        <span className="text-xs font-semibold text-slate-600">{label}</span>
      </div>
      <strong className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</strong>
      <div className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${improved ? 'text-emerald-600' : 'text-rose-500'}`}>
        <DeltaIcon size={12}/>
        {Math.abs(delta).toFixed(1)}% vs previous period
      </div>
    </div>
  );
}

export function ReportsScreen({ onNavigate }) {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rangeDays, setRangeDays] = useState('30');

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    let complaintQuery = localData
      .from('complaints')
      .select('*, complaint_categories(*), buildings(*), profiles!complaints_assigned_to_fkey(*)')
      .order('created_at', { ascending: false });
    if (profile?.role === 'staff') complaintQuery = complaintQuery.eq('assigned_to', profile.id);

    const [complaintResult, categoryResult, technicianResult] = await Promise.all([
      complaintQuery,
      localData.from('complaint_categories').select('*'),
      localData.from('profiles').select('*').eq('role', 'staff'),
    ]);
    setComplaints(complaintResult.data || []);
    setCategories(categoryResult.data || []);
    setTechnicians(technicianResult.data || []);
    setLoading(false);
  };

  const report = useMemo(() => {
    const bounds = periodBounds(rangeDays);
    const currentRows = filterByPeriod(complaints, bounds);
    const previousRows = filterByPeriod(complaints, bounds, true);
    const current = summarize(currentRows);
    const previous = summarize(previousRows);

    const byCategory = categories
      .map((category, index) => ({
        ...category,
        color: category.color || PALETTE[index % PALETTE.length],
        total: currentRows.filter((row) => row.category_id === category.id).length,
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);

    const resolutionBuckets = [
      { label: '< 4', min: 0, max: 4, color: '#6d40d8' },
      { label: '4 – 12', min: 4, max: 12, color: '#2e7be6' },
      { label: '12 – 24', min: 12, max: 24, color: '#37ad62' },
      { label: '> 24', min: 24, max: Infinity, color: '#f28a2c' },
    ].map((bucket) => ({
      ...bucket,
      value: currentRows.filter((row) => {
        if (!isResolved(row)) return false;
        const hours = hoursBetween(row.created_at, row.resolved_at || row.updated_at);
        return hours !== null && hours >= bucket.min && hours < bucket.max;
      }).length,
    }));

    const byTechnician = technicians.map((technician) => {
      const assigned = currentRows.filter((row) => row.assigned_to === technician.id);
      const resolved = assigned.filter(isResolved).length;
      return {
        ...technician,
        assigned: assigned.length,
        resolved,
        rate: assigned.length ? Math.round((resolved / assigned.length) * 100) : 0,
      };
    }).filter((row) => row.assigned > 0).sort((a, b) => b.rate - a.rate || b.resolved - a.resolved);

    const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short' });
    const now = new Date();
    const monthlyTrend = Array.from({ length: 6 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
      const value = complaints.filter((row) => {
        const created = safeDate(row.created_at);
        return created && created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
      }).length;
      return { label: monthFormatter.format(date), value };
    });

    const rangeLabel = !bounds.start
      ? 'All available data'
      : `${bounds.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${bounds.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return {
      currentRows,
      current,
      previous,
      byCategory,
      resolutionBuckets,
      byTechnician,
      monthlyTrend,
      rangeLabel,
      deltas: {
        total: changePercent(current.total, previous.total),
        resolved: changePercent(current.resolved, previous.resolved),
        avgResolution: changePercent(current.avgResolutionHours, previous.avgResolutionHours),
        reopened: changePercent(current.reopenedRate, previous.reopenedRate),
      },
    };
  }, [complaints, categories, technicians, rangeDays]);

  const exportCSV = async () => {
    const rows = [['Complaint No', 'Title', 'Category', 'Priority', 'Status', 'Created', 'Resolved', 'Rating']];
    report.currentRows.forEach((complaint) => {
      rows.push([
        complaint.complaint_no,
        complaint.title,
        complaint.complaint_categories?.name || '',
        complaint.priority,
        complaint.status,
        formatDate(complaint.created_at),
        complaint.resolved_at ? formatDate(complaint.resolved_at) : '',
        complaint.feedback_rating?.toString() || '',
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    setExporting(true);
    try {
      await downloadTextFile(`campusfix-report-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('Could not export the report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Spinner/>;

  if (profile?.role === 'admin') {
    const rated = report.currentRows.filter((row) => Number(row.feedback_rating) > 0);
    const avgRating = rated.length ? (rated.reduce((sum, row) => sum + Number(row.feedback_rating || 0), 0) / rated.length).toFixed(1) : '—';
    const staffAverage = report.byTechnician.length ? Math.round(report.byTechnician.reduce((sum, row) => sum + row.rate, 0) / report.byTechnician.length) : 0;
    const resolvedDelta = report.deltas.resolved;
    const avgDays = (report.current.avgResolutionHours / 24).toFixed(1);
    return (
      <div className="admin-screen admin-reports-screen">
        <div className="admin-report-metrics">
          <section className="admin-report-metric"><span><CheckCircle2/></span><div><small>Resolved this month</small><strong>{report.current.resolved}</strong><em className={resolvedDelta >= 0 ? 'up' : 'down'}>{resolvedDelta >= 0 ? '↑' : '↓'} {Math.abs(resolvedDelta).toFixed(0)}% <i>vs last month</i></em></div></section>
          <section className="admin-report-metric"><span><Clock/></span><div><small>Avg Resolution Time</small><strong>{avgDays}<b> days</b></strong><em className={report.deltas.avgResolution <= 0 ? 'up' : 'down'}>{report.deltas.avgResolution <= 0 ? '↓' : '↑'} {Math.abs(report.deltas.avgResolution / 100 * Number(avgDays || 0)).toFixed(1)} days <i>vs last month</i></em></div></section>
          <section className="admin-report-metric admin-category-metric"><span><PieChart/></span><div className="admin-report-category-wrap"><small>Top Categories</small><DonutChart items={report.byCategory} total={report.current.total}/></div></section>
          <button type="button" className="admin-report-metric admin-staff-metric admin-rating-link" onClick={() => onNavigate?.('feedback')} aria-label="Open feedback and ratings"><span><UserRoundCog/></span><div><small>Staff Performance</small><p>Average Rating</p><strong className="rating"><Star fill="currentColor"/>{avgRating}<b>/5</b></strong><em className="up">↑ {staffAverage}% completion</em></div></button>
        </div>

        <div className="admin-report-range">
          <CalendarDays size={27}/><div><small>Date Range</small><strong>{report.rangeLabel}</strong></div>
          <label><CalendarDays size={20}/><select value={rangeDays} onChange={(e) => setRangeDays(e.target.value)}><option value="7">Last 7 days</option><option value="30">Change Range</option><option value="90">Last 90 days</option><option value="all">All time</option></select></label>
        </div>

        <section className="admin-download-panel">
          <h2><Download size={21}/>Downloadable Reports</h2>
          {[
            ['Monthly Maintenance Report','Summary of complaints with resolutions and performance'],
            ['Complaint Trend','Trend analysis of complaints over time by status'],
            ['Staff Workload','Workload distribution and performance summary for staff members'],
          ].map(([title, desc]) => <div className="admin-download-row" key={title}><span><FileText size={21}/></span><div><strong>{title}</strong><small>{desc}</small></div><button type="button" onClick={exportCSV}><Download size={19}/>Export</button></div>)}
          <p className="admin-report-note"><Info size={16}/>Reports export using the data in the selected range.</p>
        </section>

        <div className="admin-report-export-all"><strong><FileText size={20}/>Export All Reports</strong><button type="button" onClick={exportPageAsPdf}><FileText size={19}/>Export as PDF</button><button type="button" onClick={exportCSV} disabled={exporting}><FileSpreadsheet size={19}/>{exporting ? 'Exporting…' : 'Export as CSV'}</button></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[.16em] font-bold text-blue-600 mb-1">Campus administration</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Live complaint, resolution and staff performance insights</p>
        </div>
        <button onClick={load} className="w-10 h-10 rounded-xl border border-slate-200 bg-white grid place-items-center text-slate-500 hover:text-blue-600 hover:bg-blue-50" aria-label="Refresh report">
          <RefreshCw size={17}/>
        </button>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-4 sm:px-5 py-3.5 flex items-center gap-3">
        <CalendarDays className="text-blue-600 flex-none" size={21}/>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-400">Report period</p>
          <p className="text-sm font-bold text-slate-800 truncate">{report.rangeLabel}</p>
        </div>
        <select value={rangeDays} onChange={(event) => setRangeDays(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100">
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-extrabold text-slate-900">Complaints by Category</h2>
            <Info size={16} className="text-slate-400"/>
          </div>
          <DonutChart items={report.byCategory} total={report.current.total}/>
          <p className="text-xs text-slate-400 mt-1">Total Complaints: <span className="font-bold text-slate-600">{report.current.total}</span></p>
        </section>

        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-slate-900">Resolution Time (Hours)</h2>
            <Info size={16} className="text-slate-400"/>
          </div>
          <ResolutionBars buckets={report.resolutionBuckets}/>
          <p className="text-xs text-slate-400">Average Resolution Time: <span className="font-bold text-slate-600">{report.current.avgResolutionHours.toFixed(1)} hours</span></p>
        </section>

        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-extrabold text-slate-900">Staff Performance</h2>
            <Info size={16} className="text-slate-400"/>
          </div>
          <StaffBars rows={report.byTechnician}/>
          <p className="text-xs text-slate-400 mt-5">Resolved Complaints (%)</p>
        </section>

        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-slate-900">Monthly Trend</h2>
            <Info size={16} className="text-slate-400"/>
          </div>
          <TrendLine points={report.monthlyTrend}/>
          <p className="text-xs text-slate-400">Complaints Over Time</p>
        </section>
      </div>

      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 flex items-center gap-2">
          <h2 className="font-extrabold text-slate-900">Summary</h2>
          <Info size={16} className="text-slate-400"/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <Metric icon={MessageCircle} label="Total Complaints" value={report.current.total} delta={report.deltas.total} colorClass="bg-violet-50 text-violet-600"/>
          <Metric icon={CheckCircle2} label="Resolved" value={report.current.resolved} delta={report.deltas.resolved} colorClass="bg-blue-50 text-blue-600"/>
          <Metric icon={Clock} label="Avg Resolution Time" value={`${report.current.avgResolutionHours.toFixed(1)} hrs`} delta={report.deltas.avgResolution} inverse colorClass="bg-emerald-50 text-emerald-600"/>
          <Metric icon={RefreshCw} label="Reopened Rate" value={`${report.current.reopenedRate.toFixed(1)}%`} delta={report.deltas.reopened} inverse colorClass="bg-orange-50 text-orange-600"/>
        </div>
      </section>

      <button onClick={exportCSV} disabled={exporting} className="w-full min-h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-60">
        <Download size={21}/>
        {exporting ? 'Exporting Report…' : 'Export Report'}
      </button>
    </div>
  );
}
