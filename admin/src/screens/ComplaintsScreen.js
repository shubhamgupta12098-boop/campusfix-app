import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Filter,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { localData } from '@/lib/localDataClient';
import { EmptyState, Spinner } from '@/components/ui';
import { timeAgo } from '@/lib/constants';

const FILTERS = [
  { id: 'total', label: 'Total' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'closed', label: 'Closed' },
];

const OPEN_STATUSES = new Set(['submitted', 'verified']);
const PROGRESS_STATUSES = new Set(['assigned', 'in_progress', 'waiting_approval']);
const CLOSED_STATUSES = new Set(['resolved', 'closed']);

const priorityRank = { emergency: 4, high: 3, medium: 2, low: 1 };

function normaliseFilter(value) {
  if (value === 'in-progress' || value === 'progress') return 'in_progress';
  return FILTERS.some((item) => item.id === value) ? value : 'total';
}

function matchesStatus(complaint, filter) {
  if (filter === 'total') return true;
  if (filter === 'open') return OPEN_STATUSES.has(complaint.status);
  if (filter === 'in_progress') return PROGRESS_STATUSES.has(complaint.status);
  if (filter === 'closed') return CLOSED_STATUSES.has(complaint.status);
  return true;
}

function statusMeta(status) {
  if (CLOSED_STATUSES.has(status)) return { label: 'Closed', tone: 'closed' };
  if (PROGRESS_STATUSES.has(status)) return { label: 'In Progress', tone: 'progress' };
  return { label: 'Open', tone: 'open' };
}

function priorityMeta(priority) {
  const value = String(priority || 'medium').toLowerCase();
  if (value === 'emergency') return { label: 'Emergency', tone: 'emergency' };
  if (value === 'high') return { label: 'High', tone: 'high' };
  if (value === 'low') return { label: 'Low', tone: 'low' };
  return { label: 'Medium', tone: 'medium' };
}

function ComplaintIcon({ complaint }) {
  const category = String(complaint.complaint_categories?.name || '').toLowerCase();
  const status = statusMeta(complaint.status);
  if (status.tone === 'closed' && category.includes('civil')) return <CheckCircle2 />;
  if (status.tone === 'open' && (complaint.priority === 'high' || complaint.priority === 'emergency')) return <AlertTriangle />;
  if (category.includes('safety')) return <AlertTriangle />;
  if (category.includes('furniture')) return <ClipboardList />;
  return <Wrench />;
}

export function ComplaintsScreen({ initialFilter = 'total', onOpenComplaint, onFilterChange }) {
  const [complaints, setComplaints] = useState([]);
  const [activeFilter, setActiveFilter] = useState(normaliseFilter(initialFilter));
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    setActiveFilter(normaliseFilter(initialFilter));
  }, [initialFilter]);

  useEffect(() => {
    const toggleFilters = () => setShowFilters((value) => !value);
    const focusSearch = () => {
      searchRef.current?.focus();
      searchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    window.addEventListener('campusfix:complaints-filter-toggle', toggleFilters);
    window.addEventListener('campusfix:complaints-focus-search', focusSearch);
    return () => {
      window.removeEventListener('campusfix:complaints-filter-toggle', toggleFilters);
      window.removeEventListener('campusfix:complaints-focus-search', focusSearch);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: loadError } = await localData
          .from('complaints')
          .select('*, complaint_categories(*), buildings(*), profiles!complaints_user_id_fkey(*), profiles!complaints_assigned_to_fkey(*)')
          .order('created_at', { ascending: false });
        if (loadError) throw new Error(loadError.message);
        if (active) setComplaints(Array.isArray(data) ? data : []);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load complaints.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter((item) => matchesStatus(item, 'open')).length,
    in_progress: complaints.filter((item) => matchesStatus(item, 'in_progress')).length,
    closed: complaints.filter((item) => matchesStatus(item, 'closed')).length,
  }), [complaints]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return complaints
      .filter((item) => matchesStatus(item, activeFilter))
      .filter((item) => priorityFilter === 'all' || String(item.priority || 'medium').toLowerCase() === priorityFilter)
      .filter((item) => {
        if (!needle) return true;
        return [
          item.title,
          item.complaint_no,
          item.complaint_categories?.name,
          item.buildings?.name,
          item.profiles?.full_name,
          item.profiles?.email,
        ].some((value) => String(value || '').toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        if (bTime !== aTime) return bTime - aTime;
        return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      });
  }, [complaints, activeFilter, priorityFilter, query]);

  if (loading) return <Spinner />;

  return (
    <section className="admin-complaints-page" aria-label="Complaints">
      <div className="admin-complaints-tabs" role="tablist" aria-label="Complaint status">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter.id}
            className={activeFilter === filter.id ? 'is-active' : ''}
            onClick={() => { setActiveFilter(filter.id); onFilterChange?.(filter.id); }}
          >
            <span>{filter.label}</span>
            <small>{counts[filter.id]}</small>
          </button>
        ))}
      </div>

      <label className="admin-complaints-search">
        <Search />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search complaints..."
          aria-label="Search complaints"
        />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X /></button>}
      </label>

      {showFilters && (
        <div className="admin-complaints-filter-panel">
          <div><Filter size={16}/><strong>Priority</strong></div>
          <div className="admin-priority-filter-row">
            {['all', 'emergency', 'high', 'medium', 'low'].map((priority) => (
              <button
                key={priority}
                type="button"
                className={priorityFilter === priority ? 'is-active' : ''}
                onClick={() => setPriorityFilter(priority)}
              >
                {priority === 'all' ? 'All' : priority[0].toUpperCase() + priority.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <div className="admin-complaints-error">{error}</div>
      ) : visible.length === 0 ? (
        <div className="admin-complaints-empty">
          <EmptyState icon={ClipboardList} title="No complaints found" description="Try another status, priority or search." />
        </div>
      ) : (
        <div className="admin-complaints-list">
          {visible.map((complaint) => {
            const status = statusMeta(complaint.status);
            const priority = priorityMeta(complaint.priority);
            const category = complaint.complaint_categories?.name || 'Campus';
            return (
              <button
                key={complaint.id}
                type="button"
                className={`admin-complaint-card status-${status.tone}`}
                onClick={() => onOpenComplaint(complaint.id)}
              >
                <span className={`admin-complaint-card-icon tone-${status.tone}`}><ComplaintIcon complaint={complaint}/></span>
                <span className="admin-complaint-card-main">
                  <span className="admin-complaint-title-row">
                    <strong>{complaint.title || 'Campus maintenance request'}</strong>
                    <span className={`admin-complaint-status ${status.tone}`}>{status.label}<i /></span>
                  </span>
                  <span className="admin-complaint-meta">
                    <span>{complaint.complaint_no || 'Complaint'}</span><i />
                    <span>{category}</span><i />
                    <span>{complaint.created_at ? timeAgo(complaint.created_at) : 'recently'}</span>
                  </span>
                  <span className="admin-complaint-priority">Priority: <b className={priority.tone}>{priority.label}</b></span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
