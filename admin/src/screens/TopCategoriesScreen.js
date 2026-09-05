import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  MonitorWifi,
  MoreHorizontal,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { localData } from '@/lib/localDataClient';
import { Spinner } from '@/components/ui';

const GROUPS = [
  {
    id: 'electrical',
    name: 'Electrical',
    color: '#20dbea',
    tone: 'cyan',
    icon: Zap,
    matches: (value) => /electrical|electric|power|light|lighting/.test(value),
  },
  {
    id: 'facilities',
    name: 'Facilities',
    color: '#9748f2',
    tone: 'purple',
    icon: Building2,
    matches: (value) => /facility|plumb|carpent|civil|clean|hvac|\bac\b|building|furniture|water/.test(value),
  },
  {
    id: 'safety',
    name: 'Safety & Security',
    color: '#2f8df4',
    tone: 'blue',
    icon: ShieldCheck,
    matches: (value) => /safety|security|fire|hazard|emergency/.test(value),
  },
  {
    id: 'network',
    name: 'IT & Network',
    color: '#31d46f',
    tone: 'green',
    icon: MonitorWifi,
    matches: (value) => /internet|wi-?fi|network|\bit\b|computer|system/.test(value),
  },
  {
    id: 'other',
    name: 'Others',
    color: '#ff982d',
    tone: 'orange',
    icon: MoreHorizontal,
    matches: () => true,
  },
];

function categoryText(row) {
  return `${row?.category_id || ''} ${row?.category_name || ''} ${row?.complaint_categories?.name || ''}`.toLowerCase();
}

function beginningOfRange(days) {
  if (days === 'all') return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, Number(days) - 1));
  return start;
}

function endOfToday() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

function dateLabel(start, end, allTime = false) {
  if (allTime && !start) return 'All available data';
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function donutGradient(rows, total) {
  if (!total) return 'conic-gradient(#132633 0 100%)';
  let cursor = 0;
  const pieces = [];
  rows.forEach((row) => {
    if (!row.count) return;
    const share = (row.count / total) * 100;
    const next = Math.min(100, cursor + share);
    pieces.push(`${row.color} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`);
    cursor = next;
  });
  if (cursor < 100) pieces.push(`#132633 ${cursor.toFixed(2)}% 100%`);
  return `conic-gradient(${pieces.join(', ')})`;
}

export function TopCategoriesScreen() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState('30');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const result = await localData
        .from('complaints')
        .select('*, complaint_categories(*)')
        .order('created_at', { ascending: false });
      if (!active) return;
      setComplaints(result.data || []);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const toggle = () => setFilterOpen((value) => !value);
    window.addEventListener('campusfix:top-categories-filter-toggle', toggle);
    return () => window.removeEventListener('campusfix:top-categories-filter-toggle', toggle);
  }, []);

  const report = useMemo(() => {
    const end = endOfToday();
    const requestedStart = beginningOfRange(rangeDays);
    const periodRows = requestedStart
      ? complaints.filter((row) => {
          const created = new Date(row.created_at);
          return !Number.isNaN(created.getTime()) && created >= requestedStart && created <= end;
        })
      : complaints;

    const grouped = GROUPS.map((group) => ({ ...group, count: 0 }));
    periodRows.forEach((row) => {
      const value = categoryText(row);
      const index = grouped.findIndex((group) => group.matches(value));
      grouped[index === -1 ? grouped.length - 1 : index].count += 1;
    });

    const total = periodRows.length;
    const highestCount = Math.max(0, ...grouped.map((row) => row.count));
    const highestIndex = highestCount > 0 ? grouped.findIndex((row) => row.count === highestCount) : -1;
    const rows = grouped.map((row, index) => ({
      ...row,
      percent: total ? Math.round((row.count / total) * 100) : 0,
      isHighest: index === highestIndex,
    }));

    let labelStart = requestedStart;
    if (!labelStart && periodRows.length) {
      const dates = periodRows
        .map((row) => new Date(row.created_at))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a - b);
      labelStart = dates[0] || null;
    }

    return {
      total,
      rows,
      donut: donutGradient(rows, total),
      label: dateLabel(labelStart, end, rangeDays === 'all'),
    };
  }, [complaints, rangeDays]);

  if (loading) return <Spinner/>;

  return (
    <div className="admin-screen admin-top-categories-screen">
      <section className="top-categories-date" aria-label="Selected report period">
        <span>{report.label}</span>
      </section>

      {filterOpen && (
        <section className="top-categories-filter-panel" aria-label="Top category date filter">
          {[
            ['7', 'Last 7 days'],
            ['30', 'Last 30 days'],
            ['90', 'Last 90 days'],
            ['all', 'All time'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={rangeDays === id ? 'is-active' : ''}
              onClick={() => { setRangeDays(id); setFilterOpen(false); }}
            >
              {label}
            </button>
          ))}
        </section>
      )}

      <section className="top-categories-donut-shell" aria-label={`${report.total} total complaints`}>
        <div className="top-categories-donut-glow"/>
        <div className="top-categories-donut" style={{ background: report.donut }}>
          <div className="top-categories-donut-core">
            <strong>{report.total}</strong>
            <span>Total Complaints</span>
          </div>
        </div>
      </section>

      <section className="top-categories-list" aria-label="Complaint categories">
        {report.rows.map((row) => {
          const Icon = row.icon;
          return (
            <article className={`top-category-row tone-${row.tone} ${row.isHighest ? 'is-highest' : ''}`} key={row.id}>
              <div className="top-category-icon"><Icon/></div>
              <div className="top-category-main">
                <div className="top-category-title-line">
                  <div>
                    <h2>{row.name}</h2>
                    <p><strong>{row.percent}%</strong><span>•</span>{row.count} complaint{row.count === 1 ? '' : 's'}</p>
                  </div>
                  {row.isHighest && <div className="top-category-status"><span>Status</span><strong>Highest</strong></div>}
                </div>
                <div className="top-category-progress" aria-label={`${row.name}: ${row.percent}%`}>
                  <span style={{ width: `${row.percent}%` }}/>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="top-categories-total-card">
        <span>Total Complaints:</span>
        <strong>{report.total}</strong>
      </section>
    </div>
  );
}
