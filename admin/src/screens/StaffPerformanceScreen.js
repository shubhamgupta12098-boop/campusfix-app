import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Star, TrendingUp } from 'lucide-react';
import { localData } from '@/lib/localDataClient';
import { Spinner } from '@/components/ui';

function statusBucket(status) {
  const value = String(status || '').toLowerCase();
  if (['closed', 'resolved', 'completed'].includes(value)) return 'closed';
  if (['in_progress', 'waiting_approval', 'awaiting_approval', 'rework_required'].includes(value)) return 'in_progress';
  return 'open';
}

function initials(name) {
  return String(name || 'Staff')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function staffMetrics(technicians, complaints) {
  return technicians.map((technician) => {
    const assigned = complaints.filter((row) => row.assigned_to === technician.id && String(row.status || '').toLowerCase() !== 'rejected');
    const closed = assigned.filter((row) => statusBucket(row.status) === 'closed').length;
    const ratings = assigned
      .map((row) => Number(row.feedback_rating))
      .filter((value) => Number.isFinite(value) && value > 0);
    const rating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
    const rate = assigned.length ? Math.round((closed / assigned.length) * 100) : 0;
    return {
      ...technician,
      assigned: assigned.length,
      closed,
      rating,
      ratingCount: ratings.length,
      rate,
      active: technician.is_active !== false,
    };
  }).sort((a, b) => b.rate - a.rate || (b.rating || 0) - (a.rating || 0) || b.closed - a.closed);
}

export function StaffPerformanceScreen() {
  const [technicians, setTechnicians] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [staffResult, complaintsResult] = await Promise.all([
        localData.from('profiles').select('*').eq('role', 'staff').order('full_name'),
        localData.from('complaints').select('*').order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      setTechnicians(staffResult.data || []);
      setComplaints(complaintsResult.data || []);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const toggleFilter = () => setFilterOpen((value) => !value);
    const focusSearch = () => searchRef.current?.focus();
    window.addEventListener('campusfix:staff-performance-filter-toggle', toggleFilter);
    window.addEventListener('campusfix:staff-performance-focus-search', focusSearch);
    return () => {
      window.removeEventListener('campusfix:staff-performance-filter-toggle', toggleFilter);
      window.removeEventListener('campusfix:staff-performance-focus-search', focusSearch);
    };
  }, []);

  const rows = useMemo(() => staffMetrics(technicians, complaints), [technicians, complaints]);

  const summary = useMemo(() => {
    const rated = rows.filter((row) => row.rating !== null);
    const avgRating = rated.length
      ? rated.reduce((sum, row) => sum + row.rating, 0) / rated.length
      : null;
    const assigned = rows.reduce((sum, row) => sum + row.assigned, 0);
    const closed = rows.reduce((sum, row) => sum + row.closed, 0);
    return {
      avgRating,
      completion: assigned ? Math.round((closed / assigned) * 100) : 0,
      totalStaff: rows.length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !q || [row.full_name, row.department, row.email, row.college_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
      const matchesFilter = filter === 'all'
        || (filter === 'active' && row.active)
        || (filter === 'top' && row.rate >= 80)
        || (filter === 'attention' && row.rate < 80);
      return matchesSearch && matchesFilter;
    });
  }, [rows, search, filter]);

  if (loading) return <Spinner/>;

  return (
    <div className="admin-screen admin-staff-performance-screen">
      <section className="staff-performance-summary" aria-label="Staff performance summary">
        <div className="staff-performance-star" aria-hidden="true"><Star fill="currentColor"/></div>
        <div className="staff-performance-rating-copy">
          <span>Average Rating</span>
          <div><strong>{summary.avgRating ? summary.avgRating.toFixed(1) : '—'}</strong><b>/5</b></div>
        </div>
        <div className="staff-performance-summary-divider" aria-hidden="true"/>
        <div className="staff-performance-summary-side">
          <strong><TrendingUp/> {summary.completion}% <span>completion</span></strong>
          <small>Total Staff: {summary.totalStaff}</small>
        </div>
      </section>

      <section className="staff-performance-search-shell">
        <Search aria-hidden="true"/>
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search staff..."
          aria-label="Search staff"
        />
        {filter !== 'all' && <span className="staff-performance-filter-badge">{filter === 'active' ? 'Active' : filter === 'top' ? 'Top' : 'Needs attention'}</span>}
      </section>

      {filterOpen && (
        <section className="staff-performance-filter-panel" aria-label="Staff performance filters">
          {[
            ['all', 'All Staff'],
            ['active', 'Active'],
            ['top', '80%+ Completion'],
            ['attention', 'Below 80%'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? 'is-active' : ''}
              onClick={() => { setFilter(id); setFilterOpen(false); }}
            >
              {label}
            </button>
          ))}
        </section>
      )}

      <section className="staff-performance-list" aria-label="Staff performance list">
        {filteredRows.length === 0 ? (
          <div className="staff-performance-empty">No staff match this search or filter.</div>
        ) : filteredRows.map((row) => (
          <article className="staff-performance-card" key={row.id}>
            <div className="staff-performance-avatar" aria-hidden="true"><span>{initials(row.full_name)}</span></div>

            <div className="staff-performance-main">
              <div className="staff-performance-name-line">
                <div>
                  <h2>{row.full_name || 'Maintenance Staff'}</h2>
                  <p>{row.department || 'Campus Maintenance'}</p>
                </div>
                <strong>{row.rate}%</strong>
              </div>

              <div className="staff-performance-progress" aria-label={`${row.rate}% completion`}>
                <i style={{ width: `${Math.max(0, Math.min(100, row.rate))}%` }}/>
              </div>

              <div className="staff-performance-card-stats">
                <div><span>Complaints Handled:</span><strong>{row.closed}</strong></div>
                <div><span>Avg Rating:</span><strong>{row.rating ? row.rating.toFixed(1) : '—'} <Star size={14} fill="currentColor"/></strong></div>
                <div><span>Status:</span><strong className={row.active ? 'is-active' : 'is-inactive'}><i/>{row.active ? 'Active' : 'Inactive'}</strong></div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
