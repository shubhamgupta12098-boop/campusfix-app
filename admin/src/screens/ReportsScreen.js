import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import { formatDate } from '@/lib/constants';
import { downloadTextFile } from '@/lib/download';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  MessageCircle,
  RefreshCw,
  Star,
  Wrench,
} from 'lucide-react';

const PALETTE = ['#7c3aed', '#2f80ed', '#35b768', '#ff8a1f', '#ec4899', '#20c8e7'];

const safeDate = (value) => (value ? new Date(value) : null);

const toInputDate = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const defaultAdminDates = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { start: toInputDate(start), end: toInputDate(end) };
};

function statusBucket(status) {
  const value = String(status || '').toLowerCase();
  if (['closed', 'resolved', 'completed', 'rejected'].includes(value)) return 'closed';
  if (['in_progress', 'waiting_approval', 'awaiting_approval', 'rework_required'].includes(value)) return 'in_progress';
  return 'open';
}

function displayStatus(status) {
  const bucket = statusBucket(status);
  if (bucket === 'in_progress') return 'In Progress';
  if (bucket === 'closed') return 'Closed';
  return 'Open';
}

function periodBounds(days) {
  if (days === 'all') return { start: null, end: null };
  const dayCount = Number(days);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - dayCount + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function dateBounds(startValue, endValue) {
  const start = startValue ? new Date(`${startValue}T00:00:00`) : null;
  const end = endValue ? new Date(`${endValue}T23:59:59.999`) : null;
  return { start, end };
}

function filterByPeriod(rows, bounds) {
  if (!bounds.start && !bounds.end) return rows;
  return rows.filter((row) => {
    const date = safeDate(row.created_at);
    if (!date || Number.isNaN(date.getTime())) return false;
    if (bounds.start && date < bounds.start) return false;
    if (bounds.end && date > bounds.end) return false;
    return true;
  });
}

function rangeLabel(bounds) {
  if (!bounds.start && !bounds.end) return 'All available data';
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = bounds.start ? bounds.start.toLocaleDateString('en-US', options) : 'Beginning';
  const end = bounds.end ? bounds.end.toLocaleDateString('en-US', options) : 'Today';
  return `${start} – ${end}`;
}

function countStatuses(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[statusBucket(row.status)] += 1;
      return acc;
    },
    { total: 0, open: 0, in_progress: 0, closed: 0 },
  );
}

function categoryRows(categories, rows) {
  return categories
    .map((category, index) => ({
      ...category,
      color: PALETTE[index % PALETTE.length],
      total: rows.filter((row) => row.category_id === category.id).length,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

function staffRows(technicians, rows) {
  return technicians
    .map((technician) => {
      const assigned = rows.filter((row) => row.assigned_to === technician.id);
      const closed = assigned.filter((row) => statusBucket(row.status) === 'closed').length;
      return {
        ...technician,
        assigned: assigned.length,
        closed,
        rate: assigned.length ? Math.round((closed / assigned.length) * 100) : 0,
      };
    })
    .filter((row) => row.assigned > 0)
    .sort((a, b) => b.rate - a.rate || b.closed - a.closed);
}

function monthlyTrend(rows, endDate) {
  const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short' });
  const anchor = endDate && !Number.isNaN(endDate.getTime()) ? endDate : new Date();
  return Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - (5 - offset), 1);
    const value = rows.filter((row) => {
      const created = safeDate(row.created_at);
      return created && created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
    }).length;
    return { label: monthFormatter.format(date), value };
  });
}

function DonutChart({ items, total, admin = false }) {
  let angle = 0;
  const segments = items.map((item) => {
    const start = angle;
    const share = total ? (item.total / total) * 360 : 0;
    angle += share;
    return `${item.color} ${start}deg ${angle}deg`;
  });
  const background = segments.length ? `conic-gradient(${segments.join(', ')})` : '#183040';

  if (admin) {
    return (
      <div className="admin-analytics-donut-wrap">
        <div className="admin-analytics-donut" style={{ background }}>
          <div><strong>{total}</strong><span>Total</span></div>
        </div>
        <div className="admin-analytics-legend">
          {items.slice(0, 4).map((item) => (
            <div key={item.id || item.name}>
              <span style={{ backgroundColor: item.color }}/>
              <b>{item.name}</b>
              <strong>{total ? Math.round((item.total / total) * 100) : 0}%</strong>
              <em>({item.total})</em>
            </div>
          ))}
          {!items.length && <p>No category data in this range</p>}
        </div>
      </div>
    );
  }

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

function StaffBars({ rows, admin = false }) {
  const topRows = rows.slice(0, 5);
  if (admin) {
    return (
      <div className="admin-analytics-staff-bars">
        {!topRows.length && <p className="admin-analytics-empty">No staff performance data in this range</p>}
        {topRows.map((row) => (
          <div key={row.id} className="admin-analytics-staff-row">
            <span>{row.full_name}</span>
            <div><i style={{ width: `${row.rate}%` }}/></div>
            <strong>{row.rate}%</strong>
          </div>
        ))}
        {!!topRows.length && <div className="admin-analytics-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {!topRows.length && <p className="text-sm text-slate-400 py-12 text-center">No staff performance data yet</p>}
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

function TrendLine({ points, admin = false }) {
  const width = 360;
  const height = 150;
  const padX = 28;
  const padTop = 18;
  const padBottom = 30;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const roundedMax = Math.max(4, Math.ceil(maxValue / 4) * 4);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padX + (index * (width - padX * 2)) / (points.length - 1);
    const y = padTop + (1 - point.value / roundedMax) * (height - padTop - padBottom);
    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = coordinates.length ? `${path} L ${coordinates.at(-1).x} ${height - padBottom} L ${coordinates[0].x} ${height - padBottom} Z` : '';
  const gridColor = admin ? '#263949' : '#e8edf3';
  const textColor = admin ? '#aeb8c2' : '#64748b';
  const stroke = admin ? '#8b4cf2' : '#6d40d8';

  return (
    <div className={admin ? 'admin-analytics-trend' : 'h-[172px] w-full overflow-hidden'}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" role="img" aria-label="Monthly complaints trend">
        <defs>
          <linearGradient id={admin ? 'adminTrendFill' : 'trendFill'} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={admin ? '.28' : '.12'}/>
            <stop offset="100%" stopColor={stroke} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((line) => {
          const y = padTop + (1 - line) * (height - padTop - padBottom);
          return <line key={line} x1={padX} x2={width - 8} y1={y} y2={y} stroke={gridColor} strokeDasharray="4 5"/>;
        })}
        {areaPath && <path d={areaPath} fill={`url(#${admin ? 'adminTrendFill' : 'trendFill'})`}/>}        
        <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {coordinates.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4.5" fill={stroke} stroke={admin ? '#d8c5ff' : 'white'} strokeWidth="1.8"/>
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize="10" fill={textColor} fontWeight="600">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AdminStatusButton({ id, activeStatus, onSelect, icon: Icon, label, value, tone }) {
  const active = activeStatus === id;
  return (
    <button
      type="button"
      className={`admin-report-status-button ${tone} ${active ? 'is-active' : ''}`}
      onClick={() => onSelect(id)}
      aria-pressed={active}
    >
      <span><Icon/></span>
      <div><small>{label}</small><strong>{value}</strong></div>
    </button>
  );
}

export function ReportsScreen({ onNavigate }) {
  const { profile } = useAuthStore();
  const initialDates = useMemo(() => defaultAdminDates(), []);
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rangeDays, setRangeDays] = useState('30');
  const [adminStartDate, setAdminStartDate] = useState(initialDates.start);
  const [adminEndDate, setAdminEndDate] = useState(initialDates.end);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState('all');

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    let complaintQuery = supabase
      .from('complaints')
      .select('*, complaint_categories(*), buildings(*), profiles!complaints_assigned_to_fkey(*)')
      .order('created_at', { ascending: false });
    if (profile?.role === 'staff') complaintQuery = complaintQuery.eq('assigned_to', profile.id);

    const [complaintResult, categoryResult, technicianResult] = await Promise.all([
      complaintQuery,
      supabase.from('complaint_categories').select('*'),
      supabase.from('profiles').select('*').eq('role', 'staff'),
    ]);
    setComplaints(complaintResult.data || []);
    setCategories(categoryResult.data || []);
    setTechnicians(technicianResult.data || []);
    setLoading(false);
  };

  const report = useMemo(() => {
    const isAdmin = profile?.role === 'admin';
    const bounds = isAdmin ? dateBounds(adminStartDate, adminEndDate) : periodBounds(rangeDays);
    const periodRows = filterByPeriod(complaints, bounds);
    const counts = countStatuses(periodRows);
    const filteredRows = isAdmin && activeStatus !== 'all'
      ? periodRows.filter((row) => statusBucket(row.status) === activeStatus)
      : periodRows;
    const categoriesForView = categoryRows(categories, filteredRows);
    const staffForView = staffRows(technicians, periodRows);
    const trend = monthlyTrend(filteredRows, bounds.end || new Date());
    const rated = periodRows.filter((row) => Number(row.feedback_rating) > 0);
    const avgRating = rated.length
      ? (rated.reduce((sum, row) => sum + Number(row.feedback_rating || 0), 0) / rated.length).toFixed(1)
      : '—';

    return {
      bounds,
      periodRows,
      filteredRows,
      counts,
      byCategory: categoriesForView,
      byTechnician: staffForView,
      monthlyTrend: trend,
      avgRating,
      rangeLabel: rangeLabel(bounds),
    };
  }, [complaints, categories, technicians, profile?.role, rangeDays, adminStartDate, adminEndDate, activeStatus]);

  const exportCSV = async () => {
    const rows = [['Complaint No', 'Title', 'Category', 'Priority', 'Status', 'Created', 'Closed Date', 'Rating']];
    report.filteredRows.forEach((complaint) => {
      rows.push([
        complaint.complaint_no,
        complaint.title,
        complaint.complaint_categories?.name || '',
        complaint.priority,
        displayStatus(complaint.status),
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

  const resetAdminDates = () => {
    const next = defaultAdminDates();
    setAdminStartDate(next.start);
    setAdminEndDate(next.end);
  };

  if (loading) return <Spinner/>;

  if (profile?.role === 'admin') {
    const statusName = activeStatus === 'all' ? 'All complaints' : activeStatus === 'in_progress' ? 'In Progress' : activeStatus[0].toUpperCase() + activeStatus.slice(1);

    return (
      <div className="admin-screen admin-reports-screen admin-analytics-v2">
        <section className="admin-report-date-shell">
          <button type="button" className="admin-report-date-trigger" onClick={() => setCalendarOpen((value) => !value)} aria-expanded={calendarOpen}>
            <CalendarDays/>
            <span><small>Date Range</small><strong>{report.rangeLabel}</strong></span>
            <ChevronDown className={calendarOpen ? 'is-open' : ''}/>
          </button>
          {calendarOpen && (
            <div className="admin-report-calendar-panel">
              <label>From<input type="date" value={adminStartDate} max={adminEndDate || undefined} onChange={(event) => setAdminStartDate(event.target.value)}/></label>
              <label>To<input type="date" value={adminEndDate} min={adminStartDate || undefined} onChange={(event) => setAdminEndDate(event.target.value)}/></label>
              <div>
                <button type="button" onClick={resetAdminDates}>Last 30 days</button>
                <button type="button" onClick={() => { setAdminStartDate(''); setAdminEndDate(''); }}>All time</button>
                <button type="button" className="primary" onClick={() => setCalendarOpen(false)}>Done</button>
              </div>
            </div>
          )}
        </section>

        <div className="admin-report-status-grid" aria-label="Complaint status filters">
          <AdminStatusButton id="all" activeStatus={activeStatus} onSelect={setActiveStatus} icon={ClipboardList} label="Total Complaints" value={report.counts.total} tone="total"/>
          <AdminStatusButton id="open" activeStatus={activeStatus} onSelect={setActiveStatus} icon={MessageCircle} label="Open" value={report.counts.open} tone="open"/>
          <AdminStatusButton id="in_progress" activeStatus={activeStatus} onSelect={setActiveStatus} icon={Wrench} label="In Progress" value={report.counts.in_progress} tone="progress"/>
          <AdminStatusButton id="closed" activeStatus={activeStatus} onSelect={setActiveStatus} icon={CheckCircle2} label="Closed" value={report.counts.closed} tone="closed"/>
        </div>
        <p className="admin-report-filter-help">Tap a status to filter complaint charts · <strong>{statusName}</strong> ({report.filteredRows.length})</p>

        <div className="admin-report-chart-grid">
          <section className="admin-analytics-card">
            <h2>Complaints by Category <Info/></h2>
            <DonutChart items={report.byCategory} total={report.filteredRows.length} admin/>
            <p>Total Complaints: <strong>{report.filteredRows.length}</strong></p>
          </section>

          <section className="admin-analytics-card">
            <h2>Monthly Trend <Info/></h2>
            <TrendLine points={report.monthlyTrend} admin/>
            <p>Complaints Over Time</p>
          </section>
        </div>

        <section className="admin-analytics-card admin-staff-performance-card">
          <h2>Staff Performance <Info/></h2>
          <div className="admin-staff-performance-layout">
            <div>
              <StaffBars rows={report.byTechnician} admin/>
              {!!report.byTechnician.length && <p className="admin-performance-caption">Performance Score (%)</p>}
            </div>
            <div className="admin-performance-rating">
              <Star fill="currentColor"/>
              <strong>{report.avgRating}<b>/5</b></strong>
              <span>Average Rating</span>
            </div>
          </div>
        </section>

        <section className="admin-analytics-card admin-status-summary-card">
          <h2>Complaint Status Summary</h2>
          <div className="admin-status-summary-grid">
            <div className="total"><span><ClipboardList/></span><small>Total Complaints</small><strong>{report.counts.total}</strong></div>
            <div className="open"><span><MessageCircle/></span><small>Open</small><strong>{report.counts.open}</strong></div>
            <div className="progress"><span><Wrench/></span><small>In Progress</small><strong>{report.counts.in_progress}</strong></div>
            <div className="closed"><span><CheckCircle2/></span><small>Closed</small><strong>{report.counts.closed}</strong></div>
          </div>
        </section>

        <section className="admin-download-panel admin-download-panel-v2">
          <h2><Download size={21}/>Downloadable Reports</h2>
          {[
            ['Monthly Maintenance Report', 'Summary of complaints by status and staff performance'],
            ['Complaint Trend', 'Trend analysis of complaints over time by status'],
            ['Staff Workload', 'Workload distribution and performance summary for staff members'],
          ].map(([title, desc]) => (
            <div className="admin-download-row" key={title}>
              <span><FileText size={21}/></span>
              <div><strong>{title}</strong><small>{desc}</small></div>
              <button type="button" onClick={exportCSV}><Download size={19}/>Export</button>
            </div>
          ))}
          <p className="admin-report-note"><Info size={16}/>Exports use the selected date range and active status filter.</p>
        </section>

        <div className="admin-report-export-all">
          <strong><FileText size={20}/>Export Reports</strong>
          <button type="button" onClick={() => window.print()}><FileText size={19}/>Export as PDF</button>
          <button type="button" onClick={exportCSV} disabled={exporting}><FileSpreadsheet size={19}/>{exporting ? 'Exporting…' : 'Export as CSV'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[.16em] font-bold text-blue-600 mb-1">Campus administration</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Live complaint status and staff performance insights</p>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Total Complaints</p><strong className="text-2xl text-slate-900">{report.counts.total}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Open</p><strong className="text-2xl text-emerald-600">{report.counts.open}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">In Progress</p><strong className="text-2xl text-cyan-600">{report.counts.in_progress}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Closed</p><strong className="text-2xl text-blue-600">{report.counts.closed}</strong></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1"><h2 className="font-extrabold text-slate-900">Complaints by Category</h2><Info size={16} className="text-slate-400"/></div>
          <DonutChart items={report.byCategory} total={report.filteredRows.length}/>
          <p className="text-xs text-slate-400 mt-1">Total Complaints: <span className="font-bold text-slate-600">{report.filteredRows.length}</span></p>
        </section>

        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2"><h2 className="font-extrabold text-slate-900">Monthly Trend</h2><Info size={16} className="text-slate-400"/></div>
          <TrendLine points={report.monthlyTrend}/>
          <p className="text-xs text-slate-400">Complaints Over Time</p>
        </section>

        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4"><h2 className="font-extrabold text-slate-900">Staff Performance</h2><Info size={16} className="text-slate-400"/></div>
          <div className="grid md:grid-cols-[1fr_180px] gap-6 items-center">
            <div><StaffBars rows={report.byTechnician}/><p className="text-xs text-slate-400 mt-5">Performance Score (%)</p></div>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-center">
              <Star className="mx-auto text-amber-400 fill-amber-400" size={34}/>
              <strong className="block text-3xl text-slate-900 mt-2">{report.avgRating}<span className="text-base text-slate-500">/5</span></strong>
              <span className="text-xs text-slate-500">Average Rating</span>
            </div>
          </div>
        </section>
      </div>

      <button onClick={exportCSV} disabled={exporting} className="w-full min-h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-60">
        <Download size={21}/>{exporting ? 'Exporting Report…' : 'Export Report'}
      </button>
    </div>
  );
}
