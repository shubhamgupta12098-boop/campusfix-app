import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import {
    Bell,
    BookOpen,
    Check,
    Clock3,
    Droplets,
    Search,
    Star,
    Utensils,
    Wifi,
    Wrench,
} from 'lucide-react';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'closed', label: 'Closed' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'pending', label: 'Pending' },
];

const isClosed = (status) => ['resolved', 'closed'].includes(status);
const isProgress = (status) => ['assigned', 'in_progress'].includes(status);
const isPending = (status) => ['submitted', 'verified', 'waiting_approval'].includes(status);

function statusGroup(status) {
    if (isClosed(status)) return 'closed';
    if (isProgress(status)) return 'in_progress';
    if (isPending(status)) return 'pending';
    return 'pending';
}

function statusMeta(status) {
    if (isClosed(status)) return { label: 'Closed', tone: 'closed', Icon: Check };
    if (isProgress(status)) return { label: 'In Progress', tone: 'progress', Icon: Clock3 };
    return { label: 'Pending', tone: 'pending', Icon: Clock3 };
}

function complaintIcon(complaint) {
    const haystack = `${complaint?.title || ''} ${complaint?.complaint_categories?.name || ''} ${complaint?.category_name || ''}`.toLowerCase();
    if (haystack.includes('wifi') || haystack.includes('wi-fi') || haystack.includes('network') || haystack.includes('internet')) return Wifi;
    if (haystack.includes('food') || haystack.includes('mess') || haystack.includes('canteen')) return Utensils;
    if (haystack.includes('library') || haystack.includes('book') || haystack.includes('seat')) return BookOpen;
    if (haystack.includes('water') || haystack.includes('plumb') || haystack.includes('cooler')) return Droplets;
    return Wrench;
}

function cardTone(complaint) {
    const haystack = `${complaint?.title || ''} ${complaint?.complaint_categories?.name || ''}`.toLowerCase();
    if (haystack.includes('wifi') || haystack.includes('network')) return 'blue';
    if (haystack.includes('food') || haystack.includes('mess')) return 'green';
    if (haystack.includes('library') || haystack.includes('seat')) return 'purple';
    if (haystack.includes('water') || haystack.includes('plumb')) return 'orange';
    return 'blue';
}

function formattedDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function progressStep(status) {
    if (isClosed(status)) return 4;
    if (status === 'in_progress' || status === 'assigned') return 3;
    if (status === 'verified') return 2;
    return 1;
}

export function MyComplaintsScreen({ onOpenComplaint, onNavigate }) {
    const { profile } = useAuthStore();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        if (profile?.id) void load();
    }, [profile?.id]);

    const load = async () => {
        if (!profile?.id) return;
        setLoading(true);
        setLoadError(null);
        const { data, error } = await supabase
            .from('complaints')
            .select('*, complaint_categories(*), buildings(*)')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false });
        if (error) {
            setLoadError(error.message || 'Complaints could not be loaded.');
            setComplaints([]);
        } else {
            setComplaints(data || []);
        }
        setLoading(false);
    };

    const filtered = useMemo(() => complaints.filter((complaint) => {
        const text = `${complaint.title || ''} ${complaint.complaint_no || ''}`.toLowerCase();
        const matchesSearch = !search || text.includes(search.toLowerCase());
        const matchesFilter = statusFilter === 'all' || statusGroup(complaint.status) === statusFilter;
        return matchesSearch && matchesFilter;
    }), [complaints, search, statusFilter]);

    if (loading) return <Spinner />;

    return (
      <div className="student-screen student-track-screen">
        <div className="student-screen-heading student-track-heading">
          <div>
            <h1>Track Status</h1>
          </div>
          <button type="button" className="student-round-icon" onClick={() => onNavigate?.('notifications')} aria-label="Open notifications">
            <Bell size={24}/>
            <span className="student-notification-dot"/>
          </button>
        </div>

        <label className="student-search-box">
          <Search size={23}/>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search feedbacks..." aria-label="Search complaints"/>
        </label>

        <div className="student-segmented" role="tablist" aria-label="Complaint status filters">
          {FILTERS.map((filter) => (
            <button key={filter.id} type="button" onClick={() => setStatusFilter(filter.id)} className={statusFilter === filter.id ? 'is-active' : ''}>
              {filter.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="student-inline-error">
            <span>{loadError}</span>
            <button type="button" onClick={() => void load()}>Retry</button>
          </div>
        )}

        <div className="student-track-list">
          {!filtered.length && !loadError ? (
            <div className="student-empty-card">
              <Wrench size={30}/>
              <strong>No complaints found</strong>
              <span>Try another search or status filter.</span>
            </div>
          ) : filtered.map((complaint) => {
            const Icon = complaintIcon(complaint);
            const meta = statusMeta(complaint.status);
            const StatusIcon = meta.Icon;
            const rating = Number(complaint.feedback_rating || 0);
            const currentStep = progressStep(complaint.status);
            return (
              <button key={complaint.id} type="button" onClick={() => onOpenComplaint(complaint.id)} className="student-track-card">
                <div className={`student-category-orb ${cardTone(complaint)}`}><Icon size={28}/></div>
                <div className="student-track-card-main">
                  <div className="student-track-card-top">
                    <div className="student-track-copy">
                      <h3>{complaint.title}</h3>
                      {rating > 0 && <p className="student-rating-line"><strong>{rating.toFixed(1)}</strong><Star size={17} fill="currentColor"/></p>}
                      <p className="student-submitted-date">Submitted: {formattedDate(complaint.created_at)} <i className={meta.tone}/></p>
                    </div>
                    <span className={`student-status-pill ${meta.tone}`}><StatusIcon size={16}/>{meta.label}</span>
                  </div>

                  {!isClosed(complaint.status) && (
                    <div className="student-progress-wrap" aria-label={`Current status ${meta.label}`}>
                      <div className="student-progress-line">
                        {[1, 2, 3, 4].map((step) => <span key={step} className={step <= currentStep ? 'is-complete' : ''}/>) }
                      </div>
                      <div className="student-progress-labels">
                        <span>Submitted</span><span>Under Review</span><span>In Progress</span><span>Closed</span>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
}
