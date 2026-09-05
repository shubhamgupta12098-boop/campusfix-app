import { useEffect, useMemo, useState } from 'react';
import { localData } from '@/lib/localDataClient';
import { useAuthStore } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import { formatDate } from '@/lib/constants';
import { downloadTextFile, shareTextFile } from '@/lib/download';
import {
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Send,
  Star,
  TrendingUp,
} from 'lucide-react';

const PALETTE = ['#20d5e8', '#2f80ed', '#8b4cf2', '#b743df', '#ec4899', '#35b768'];

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
      const ratings = assigned
        .map((row) => Number(row.feedback_rating))
        .filter((value) => Number.isFinite(value) && value > 0);
      const rating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
      return {
        ...technician,
        assigned: assigned.length,
        closed,
        rate: assigned.length ? Math.round((closed / assigned.length) * 100) : 0,
        rating,
        ratingCount: ratings.length,
      };
    })
    .filter((row) => row.assigned > 0)
    .sort((a, b) => b.rate - a.rate || (b.rating || 0) - (a.rating || 0) || b.closed - a.closed);
}

function monthlyTrend(rows, anchorDate) {
  const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short' });
  const anchor = anchorDate && !Number.isNaN(anchorDate.getTime()) ? anchorDate : new Date();
  return Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - (5 - offset), 1);
    const value = rows.filter((row) => {
      const created = safeDate(row.created_at);
      return created && created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
    }).length;
    return { label: monthFormatter.format(date), value };
  });
}

function periodTrend(rows, bounds) {
  if (!bounds.start || !bounds.end) return monthlyTrend(rows, bounds.end || new Date());
  const spanMs = Math.max(1, bounds.end.getTime() - bounds.start.getTime());
  const spanDays = spanMs / 86400000;
  if (spanDays > 75) return monthlyTrend(rows, bounds.end);

  const count = 6;
  const bucketMs = spanMs / count;
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return Array.from({ length: count }, (_, index) => {
    const startMs = bounds.start.getTime() + bucketMs * index;
    const endMs = index === count - 1 ? bounds.end.getTime() + 1 : bounds.start.getTime() + bucketMs * (index + 1);
    const value = rows.filter((row) => {
      const created = safeDate(row.created_at);
      if (!created || Number.isNaN(created.getTime())) return false;
      const time = created.getTime();
      return time >= startMs && time < endMs;
    }).length;
    return { label: formatter.format(new Date(startMs)), value };
  });
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function detailedReportCsv(report) {
  const rows = [['Complaint No', 'Title', 'Category', 'Priority', 'Status', 'Assigned Staff', 'Created', 'Closed Date', 'Rating']];
  report.periodRows.forEach((complaint) => {
    rows.push([
      complaint.complaint_no,
      complaint.title,
      complaint.complaint_categories?.name || '',
      complaint.priority,
      displayStatus(complaint.status),
      complaint.profiles?.full_name || '',
      formatDate(complaint.created_at),
      complaint.resolved_at ? formatDate(complaint.resolved_at) : '',
      complaint.feedback_rating || '',
    ]);
  });
  return rowsToCsv(rows);
}

function trendReportCsv(report) {
  return rowsToCsv([
    ['Period', 'Complaints'],
    ...report.trend.map((point) => [point.label, point.value]),
  ]);
}

function staffReportCsv(report) {
  return rowsToCsv([
    ['Staff Member', 'Assigned', 'Closed', 'Completion %', 'Average Rating', 'Ratings Received'],
    ...report.byTechnician.map((row) => [
      row.full_name,
      row.assigned,
      row.closed,
      row.rate,
      row.rating ? row.rating.toFixed(1) : '',
      row.ratingCount,
    ]),
  ]);
}


function fullReportCsv(report) {
  const rows = [
    ['CCMMS Reports & Analytics'],
    ['Date Range', report.rangeLabel],
    [],
    ['Summary'],
    ['Total Complaints', 'Open', 'In Progress', 'Closed', 'Completion %', 'Average Rating'],
    [report.counts.total, report.counts.open, report.counts.in_progress, report.counts.closed, report.completionRate, report.avgRating],
    [],
    ['Top Categories'],
    ['Category', 'Complaints', 'Share %'],
    ...report.byCategory.map((row) => [row.name, row.total, report.counts.total ? Math.round((row.total / report.counts.total) * 100) : 0]),
    [],
    ['Complaint Trend'],
    ['Period', 'Complaints'],
    ...report.trend.map((point) => [point.label, point.value]),
    [],
    ['Staff Performance'],
    ['Staff Member', 'Assigned', 'Closed', 'Completion %', 'Average Rating', 'Ratings Received'],
    ...report.byTechnician.map((row) => [row.full_name, row.assigned, row.closed, row.rate, row.rating ? row.rating.toFixed(1) : '', row.ratingCount]),
    [],
    ['Complaint Details'],
    ['Complaint No', 'Title', 'Category', 'Priority', 'Status', 'Assigned Staff', 'Created', 'Closed Date', 'Rating'],
    ...report.periodRows.map((complaint) => [
      complaint.complaint_no,
      complaint.title,
      complaint.complaint_categories?.name || '',
      complaint.priority,
      displayStatus(complaint.status),
      complaint.profiles?.full_name || '',
      formatDate(complaint.created_at),
      complaint.resolved_at ? formatDate(complaint.resolved_at) : '',
      complaint.feedback_rating || '',
    ]),
  ];
  return rowsToCsv(rows);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
      <div className="admin-report-category-layout">
        <div className="admin-report-category-donut" style={{ background }}>
          <span />
        </div>
        <div className="admin-report-category-legend">
          {items.slice(0, 3).map((item) => (
            <div key={item.id || item.name}>
              <i style={{ backgroundColor: item.color }}/>
              <span>{item.name}</span>
              <strong>{total ? Math.round((item.total / total) * 100) : 0}%</strong>
            </div>
          ))}
          {!items.length && <p>No category data</p>}
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
      <div className="admin-reference-staff-bars">
        {!topRows.length && <p className="admin-reference-empty">No staff performance data in this range</p>}
        {topRows.map((row) => (
          <div key={row.id} className="admin-reference-staff-row">
            <span>{row.full_name}</span>
            <div className="admin-reference-staff-track"><i style={{ width: `${row.rate}%` }}/></div>
            <strong>{row.rate}%</strong>
            <em title={`${row.ratingCount} rating${row.ratingCount === 1 ? '' : 's'}`}>
              <Star size={10} fill="currentColor"/>{row.rating ? row.rating.toFixed(1) : '—'}
            </em>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {!topRows.length && <p className="text-sm text-slate-400 py-12 text-center">No staff performance data yet</p>}
      {topRows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-[112px_1fr_42px_46px] items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700 truncate">{row.full_name}</span>
          <div className="h-4 rounded-sm bg-slate-100 overflow-hidden">
            <div className="h-full rounded-sm" style={{ width: `${row.rate}%`, backgroundColor: PALETTE[index % PALETTE.length] }}/>
          </div>
          <span className="font-bold text-slate-800 text-right">{row.rate}%</span>
          <span className="font-bold text-amber-500 text-right">★ {row.rating ? row.rating.toFixed(1) : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function TrendLine({ points, admin = false }) {
  const width = 500;
  const height = 145;
  const padX = 38;
  const padTop = 16;
  const padBottom = 30;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const niceMax = Math.max(4, Math.ceil(maxValue / 4) * 4);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padX + (index * (width - padX - 10)) / (points.length - 1);
    const y = padTop + (1 - point.value / niceMax) * (height - padTop - padBottom);
    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = coordinates.length ? `${path} L ${coordinates.at(-1).x} ${height - padBottom} L ${coordinates[0].x} ${height - padBottom} Z` : '';
  const gridColor = admin ? '#1d2a38' : '#e8edf3';
  const textColor = admin ? '#d7dbe1' : '#64748b';
  const stroke = admin ? '#9b55f6' : '#6d40d8';

  return (
    <div className={admin ? 'admin-reference-trend' : 'h-[172px] w-full overflow-hidden'}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" role="img" aria-label="Complaint trend">
        <defs>
          <linearGradient id={admin ? 'adminReferenceTrendFill' : 'trendFill'} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={admin ? '.24' : '.12'}/>
            <stop offset="100%" stopColor={stroke} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0, .25, .5, .75, 1].map((line) => {
          const y = padTop + (1 - line) * (height - padTop - padBottom);
          const labelValue = Math.round(niceMax * line);
          return (
            <g key={line}>
              <line x1={padX} x2={width - 8} y1={y} y2={y} stroke={gridColor} strokeDasharray="4 4"/>
              <text x={padX - 10} y={y + 3} textAnchor="end" fontSize="9" fill={textColor}>{labelValue}</text>
            </g>
          );
        })}
        {areaPath && <path d={areaPath} fill={`url(#${admin ? 'adminReferenceTrendFill' : 'trendFill'})`}/>}        
        <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {coordinates.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="4" fill={stroke} stroke={admin ? '#d8c2ff' : 'white'} strokeWidth="1.5"/>
            <text x={point.x} y={height - 7} textAnchor="middle" fontSize="9" fill={textColor}>{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ReportsScreen({ onNavigate }) {
  const { profile } = useAuthStore();
  const initialDates = useMemo(() => defaultAdminDates(), []);
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState('30');
  const [adminStartDate, setAdminStartDate] = useState(initialDates.start);
  const [adminEndDate, setAdminEndDate] = useState(initialDates.end);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [busyAction, setBusyAction] = useState('');

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
    const isAdmin = profile?.role === 'admin';
    const bounds = isAdmin ? dateBounds(adminStartDate, adminEndDate) : periodBounds(rangeDays);
    const periodRows = filterByPeriod(complaints, bounds);
    const counts = countStatuses(periodRows);
    const categoriesForView = categoryRows(categories, periodRows);
    const staffForView = staffRows(technicians, periodRows);
    const trend = periodTrend(periodRows, bounds);
    const rated = periodRows.filter((row) => Number(row.feedback_rating) > 0);
    const avgRatingNumber = rated.length
      ? rated.reduce((sum, row) => sum + Number(row.feedback_rating || 0), 0) / rated.length
      : null;
    const completionRate = counts.total ? Math.round((counts.closed / counts.total) * 100) : 0;

    return {
      bounds,
      periodRows,
      counts,
      byCategory: categoriesForView,
      byTechnician: staffForView,
      trend,
      avgRatingNumber,
      avgRating: avgRatingNumber ? avgRatingNumber.toFixed(1) : '—',
      ratingCount: rated.length,
      completionRate,
      rangeLabel: rangeLabel(bounds),
    };
  }, [complaints, categories, technicians, profile?.role, rangeDays, adminStartDate, adminEndDate]);

  const exportDefinitions = useMemo(() => ({
    full: {
      title: 'CCMMS Reports & Analytics',
      description: 'Full analytics summary, staff ratings, trend and complaint details',
      filename: `campuscare-report-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: fullReportCsv(report),
    },
    maintenance: {
      title: 'Monthly Maintenance Report',
      description: 'Complaint details, status, assignment and ratings',
      filename: `monthly-maintenance-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: detailedReportCsv(report),
    },
    trend: {
      title: 'Complaint Trend',
      description: 'Complaint volume across the selected report period',
      filename: `complaint-trend-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: trendReportCsv(report),
    },
    staff: {
      title: 'Staff Workload',
      description: 'Assigned work, completion score and staff ratings',
      filename: `staff-workload-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: staffReportCsv(report),
    },
  }), [report]);

  const summaryText = useMemo(() => (
    `CCMMS Reports & Analytics — ${report.rangeLabel}. ` +
    `${report.counts.total} complaints: ${report.counts.open} open, ${report.counts.in_progress} in progress, ` +
    `${report.counts.closed} closed. Average rating ${report.avgRating}/5. Completion ${report.completionRate}%.`
  ), [report]);

  const handleExport = async (type = 'full') => {
    const item = exportDefinitions[type] || exportDefinitions.full;
    setBusyAction(`export-${type}`);
    try {
      await downloadTextFile(item.filename, item.csv, 'text/csv;charset=utf-8');
    } catch (error) {
      console.error('Report export failed:', error);
      alert('Could not export the report. Please try again.');
    } finally {
      setBusyAction('');
    }
  };

  const handleSend = async (type = 'full') => {
    const item = exportDefinitions[type] || exportDefinitions.full;
    setBusyAction(`send-${type}`);
    try {
      await shareTextFile({
        filename: item.filename,
        content: item.csv,
        mimeType: 'text/csv;charset=utf-8',
        title: item.title,
        text: summaryText,
      });
    } catch (error) {
      console.error('Report send failed:', error);
      alert('Could not send the report. Please try again.');
    } finally {
      setBusyAction('');
    }
  };

  const openPrintableReport = () => {
    const win = window.open('', '_blank', 'width=920,height=760');
    if (!win) {
      alert('Please allow pop-ups to preview/print this report.');
      return;
    }
    win.opener = null;
    const categoryRowsHtml = report.byCategory.slice(0, 8).map((row) => (
      `<tr><td>${escapeHtml(row.name)}</td><td>${row.total}</td><td>${report.counts.total ? Math.round((row.total / report.counts.total) * 100) : 0}%</td></tr>`
    )).join('');
    const staffRowsHtml = report.byTechnician.slice(0, 12).map((row) => (
      `<tr><td>${escapeHtml(row.full_name)}</td><td>${row.assigned}</td><td>${row.closed}</td><td>${row.rate}%</td><td>${row.rating ? row.rating.toFixed(1) : '—'}/5</td></tr>`
    )).join('');

    win.document.write(`<!doctype html><html><head><title>CCMMS Report</title><style>
      *{box-sizing:border-box}body{margin:0;padding:34px;font:14px/1.45 Arial,sans-serif;color:#111827;background:#fff}
      header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #7c3aed;padding-bottom:18px;margin-bottom:24px}
      h1{margin:0;font-size:30px}header p{margin:5px 0 0;color:#6b7280}.brand{font-weight:800;color:#7c3aed}
      .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:18px 0}.stat{border:1px solid #e5e7eb;border-radius:10px;padding:12px}.stat b{display:block;font-size:22px;margin-top:4px}
      h2{font-size:18px;margin:26px 0 10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:9px;text-align:left}th{background:#f5f3ff}
      .note{margin-top:28px;color:#6b7280;font-size:12px}@media print{body{padding:0}.no-print{display:none!important}}
    </style></head><body>
      <header><div><div class="brand">CCMMS Admin</div><h1>Reports &amp; Analytics</h1><p>${escapeHtml(report.rangeLabel)}</p></div><button class="no-print" onclick="window.print()">Print / Save PDF</button></header>
      <div class="stats"><div class="stat">Total<b>${report.counts.total}</b></div><div class="stat">Open<b>${report.counts.open}</b></div><div class="stat">In Progress<b>${report.counts.in_progress}</b></div><div class="stat">Closed<b>${report.counts.closed}</b></div><div class="stat">Avg Rating<b>${escapeHtml(report.avgRating)}/5</b></div></div>
      <h2>Top Categories</h2><table><thead><tr><th>Category</th><th>Complaints</th><th>Share</th></tr></thead><tbody>${categoryRowsHtml || '<tr><td colspan="3">No category data</td></tr>'}</tbody></table>
      <h2>Staff Performance</h2><table><thead><tr><th>Staff</th><th>Assigned</th><th>Closed</th><th>Completion</th><th>Rating</th></tr></thead><tbody>${staffRowsHtml || '<tr><td colspan="5">No staff data</td></tr>'}</tbody></table>
      <p class="note">Generated from live CCMMS complaint data for the selected date range.</p>
    </body></html>`);
    win.document.close();
    win.focus();
  };

  const resetAdminDates = () => {
    const next = defaultAdminDates();
    setAdminStartDate(next.start);
    setAdminEndDate(next.end);
  };

  const openStaffPerformance = () => onNavigate?.('staff-performance');
  const onStaffPerformanceKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openStaffPerformance();
    }
  };

  if (loading) return <Spinner/>;

  if (profile?.role === 'admin') {
    const reportRows = [
      ['maintenance', exportDefinitions.maintenance],
      ['trend', exportDefinitions.trend],
      ['staff', exportDefinitions.staff],
    ];

    return (
      <div className="admin-screen admin-reports-screen admin-report-reference">
        <div className="admin-reference-report-heading">
          <h1>Reports &amp; Analytics</h1>
        </div>

        <section className="admin-reference-date-shell">
          <button type="button" className="admin-reference-date-trigger" onClick={() => setCalendarOpen((value) => !value)} aria-expanded={calendarOpen}>
            <CalendarDays/>
            <strong>{report.rangeLabel}</strong>
            <ChevronDown className={calendarOpen ? 'is-open' : ''}/>
          </button>
          {calendarOpen && (
            <div className="admin-reference-calendar-panel">
              <label>From<input type="date" value={adminStartDate} max={adminEndDate || undefined} onChange={(event) => setAdminStartDate(event.target.value)}/></label>
              <label>To<input type="date" value={adminEndDate} min={adminStartDate || undefined} onChange={(event) => setAdminEndDate(event.target.value)}/></label>
              <div>
                <button type="button" onClick={() => {
                  const end = new Date();
                  const start = new Date(end);
                  start.setDate(start.getDate() - 6);
                  setAdminStartDate(toInputDate(start));
                  setAdminEndDate(toInputDate(end));
                }}>7 days</button>
                <button type="button" onClick={resetAdminDates}>30 days</button>
                <button type="button" onClick={() => { setAdminStartDate(''); setAdminEndDate(''); }}>All time</button>
                <button type="button" className="primary" onClick={() => setCalendarOpen(false)}>Done</button>
              </div>
            </div>
          )}
        </section>

        <div className="admin-reference-top-grid">
          <section className="admin-reference-card admin-reference-categories-card">
            <h2>Top Categories</h2>
            <DonutChart items={report.byCategory} total={report.counts.total} admin/>
          </section>

          <section className="admin-reference-card admin-reference-rating-card admin-reference-clickable-card" role="button" tabIndex={0} onClick={openStaffPerformance} onKeyDown={onStaffPerformanceKeyDown} aria-label="Open Staff Performance">
            <h2>Staff Performance</h2>
            <span>Average Rating</span>
            <div className="admin-reference-rating-value"><Star fill="currentColor"/><strong>{report.avgRating}</strong><b>/5</b></div>
            <p><TrendingUp/> {report.completionRate}% <span>completion</span></p>
            <small>{report.ratingCount} feedback rating{report.ratingCount === 1 ? '' : 's'}</small>
          </section>
        </div>

        <section className="admin-reference-card admin-reference-staff-card admin-reference-clickable-card" role="button" tabIndex={0} onClick={openStaffPerformance} onKeyDown={onStaffPerformanceKeyDown} aria-label="Open detailed Staff Performance">
          <div className="admin-reference-section-head">
            <h2>Staff Performance</h2>
            <span><Star size={12} fill="currentColor"/> rating</span>
          </div>
          <StaffBars rows={report.byTechnician} admin/>
        </section>

        <section className="admin-reference-card admin-reference-trend-card">
          <div className="admin-reference-section-head">
            <h2>Complaint Trend</h2>
            <span className="trend-key"><i/>Complaints</span>
          </div>
          <TrendLine points={report.trend} admin/>
        </section>

        <section className="admin-reference-total-card">
          <span><FileText/></span>
          <div><small>Total Complaints</small><strong>{report.counts.total}</strong></div>
          <div className="admin-reference-status-mini" aria-label="Complaint status summary">
            <em>{report.counts.open} open</em>
            <em>{report.counts.in_progress} in progress</em>
            <em>{report.counts.closed} closed</em>
          </div>
        </section>

        <section className="admin-reference-downloads">
          <h2>Downloadable Reports</h2>
          {reportRows.map(([id, item]) => (
            <div className="admin-reference-download-row" key={id}>
              <span><FileText size={21}/></span>
              <div><strong>{item.title}</strong><small>{item.description}</small></div>
              <div className="admin-reference-download-actions">
                <button type="button" onClick={() => handleExport(id)} disabled={Boolean(busyAction)} aria-label={`Export ${item.title}`}>
                  <Download size={16}/><b>{busyAction === `export-${id}` ? '...' : 'Export'}</b>
                </button>
                <button type="button" className="send" onClick={() => handleSend(id)} disabled={Boolean(busyAction)} aria-label={`Send ${item.title}`} title={`Send ${item.title}`}>
                  <Send size={16}/>
                </button>
              </div>
            </div>
          ))}
        </section>

        <div className="admin-reference-secondary-actions">
          <button type="button" onClick={openPrintableReport}><Eye size={18}/>View / PDF</button>
          <button type="button" onClick={() => handleSend('full')} disabled={Boolean(busyAction)}><Send size={18}/>{busyAction === 'send-full' ? 'Opening…' : 'Send Report'}</button>
        </div>

        <button type="button" className="admin-reference-export-button" onClick={() => handleExport('full')} disabled={Boolean(busyAction)}>
          <FileSpreadsheet size={21}/>{busyAction === 'export-full' ? 'Exporting Report…' : 'Export Report'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[.16em] font-bold text-blue-600 mb-1">Campus administration</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Live complaint status, staff completion and rating insights</p>
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
          <h2 className="font-extrabold text-slate-900 mb-1">Complaints by Category</h2>
          <DonutChart items={report.byCategory} total={report.counts.total}/>
        </section>

        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
          <h2 className="font-extrabold text-slate-900">Complaint Trend</h2>
          <TrendLine points={report.trend}/>
        </section>

        <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-4"><h2 className="font-extrabold text-slate-900">Staff Performance</h2><span className="text-sm font-bold text-amber-500">★ {report.avgRating}/5</span></div>
          <StaffBars rows={report.byTechnician}/>
        </section>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => handleSend('full')} disabled={Boolean(busyAction)} className="min-h-14 rounded-2xl border border-blue-200 bg-white text-blue-700 font-extrabold text-base flex items-center justify-center gap-2 disabled:opacity-60"><Send size={20}/>Send Report</button>
        <button onClick={() => handleExport('full')} disabled={Boolean(busyAction)} className="min-h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-60"><Download size={21}/>Export Report</button>
      </div>
    </div>
  );
}
