import { useEffect, useMemo, useState } from 'react';
import { localData } from '@/lib/localDataClient';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, StatCard, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, timeAgo } from '@/lib/constants';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, PlusCircle, ArrowRight, Wrench, Users, UserCog, BarChart3, Star } from 'lucide-react';
const ACTIVE_STATUSES = ['submitted', 'verified', 'assigned', 'in_progress', 'waiting_approval'];
const COMPLETED_STATUSES = ['resolved', 'closed'];
export function DashboardScreen({ onNavigate, onOpenComplaint, onOpenComplaints }) {
    const { profile } = useAuthStore();
    const [complaints, setComplaints] = useState([]);
    const [categories, setCategories] = useState([]);
    const [, setBuildings] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const role = profile?.role ?? 'student';
    const isAdmin = role === 'admin';
    const isStaff = role === 'staff';
    const isStudent = role === 'student';
    useEffect(() => {
        void loadData();
    }, [profile?.id, role]);
    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [catRes, bldRes, profileRes] = await Promise.all([
                localData.from('complaint_categories').select('*').order('name'),
                localData.from('buildings').select('*').order('name'),
                isAdmin ? localData.from('profiles').select('*').order('full_name') : Promise.resolve({ data: [], error: null }),
            ]);
            const firstError = catRes.error || bldRes.error || profileRes.error;
            if (firstError)
                throw new Error(firstError.message);
            setCategories((catRes.data || []));
            setBuildings((bldRes.data || []));
            setProfiles((profileRes.data || []).map((p) => ({
                ...p,
                full_name: p.full_name || p.email?.split('@')[0] || 'Unnamed user',
                role: String(p.role || 'student').toLowerCase(),
                is_active: p.is_active !== false,
            })));
            let query = localData
                .from('complaints')
                .select('*, complaint_categories(*), buildings(*), profiles!complaints_user_id_fkey(*), profiles!complaints_assigned_to_fkey(*)')
                .order('created_at', { ascending: false });
            if (isStaff)
                query = query.eq('assigned_to', profile?.id);
            else if (!isAdmin)
                query = query.eq('user_id', profile?.id);
            const { data, error: complaintError } = await query;
            if (complaintError)
                throw new Error(complaintError.message);
            setComplaints((data || []));
        }
        catch (e) {
            console.error('Dashboard load failed:', e);
            setError(e instanceof Error ? e.message : 'Unable to load dashboard data.');
        }
        finally {
            setLoading(false);
        }
    };
    const reportableComplaints = useMemo(
        () => complaints.filter((c) => String(c.status || '').toLowerCase() !== 'rejected'),
        [complaints],
    );
    // Rejected complaints are intentionally visible only on the Admin Home/Dashboard.
    // They stay excluded from Total/Open/In Progress/Closed, Reports and Top Categories.
    const rejectedComplaints = useMemo(
        () => complaints.filter((c) => String(c.status || '').toLowerCase() === 'rejected'),
        [complaints],
    );
    const stats = useMemo(() => {
        const now = new Date();
        const total = reportableComplaints.length;
        const open = reportableComplaints.filter((c) => ACTIVE_STATUSES.includes(c.status)).length;
        const resolved = reportableComplaints.filter((c) => COMPLETED_STATUSES.includes(c.status)).length;
        const overdue = reportableComplaints.filter((c) => c.expected_completion &&
            new Date(c.expected_completion) < now &&
            !COMPLETED_STATUSES.includes(c.status)).length;
        const emergency = reportableComplaints.filter((c) => c.priority === 'emergency' && !COMPLETED_STATUSES.includes(c.status)).length;
        const unassigned = reportableComplaints.filter((c) => !c.assigned_to && ACTIVE_STATUSES.includes(c.status)).length;
        return { total, open, resolved, overdue, emergency, unassigned };
    }, [reportableComplaints]);
    const recent = reportableComplaints.slice(0, isAdmin ? 7 : 5);
    const categoryStats = useMemo(() => categories.map((cat) => ({
        ...cat,
        count: reportableComplaints.filter((c) => c.category_id === cat.id).length,
    })).sort((a, b) => b.count - a.count).slice(0, 5), [categories, reportableComplaints]);
    const staff = profiles.filter((p) => p.role === 'staff');
    const activeStaff = staff.filter((p) => p.is_active !== false).length;
    const todayLabel = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date()).toUpperCase();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = profile?.full_name?.split(' ')[0] || (isAdmin ? 'Administrator' : 'User');
    const maxCat = Math.max(...categoryStats.map((c) => c.count), 1);
    if (loading)
        return <Spinner />;
    if (error)
        return (<div className="max-w-3xl mx-auto">
      <Card className="p-6 border border-red-100 bg-red-50">
        <h2 className="text-lg font-bold text-red-800">Dashboard could not load</h2>
        <p className="text-sm text-red-700 mt-2 break-words">{error}</p>
        <button onClick={() => void loadData()} className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Retry</button>
      </Card>
    </div>);
    if (isAdmin) {
        const openCount = reportableComplaints.filter((c) => ['submitted', 'verified'].includes(c.status)).length;
        const inProgress = reportableComplaints.filter((c) => ['assigned', 'in_progress', 'waiting_approval'].includes(c.status)).length;
        const ratedComplaints = reportableComplaints.filter((c) => Number(c.feedback_rating) > 0);
        const averageRating = ratedComplaints.length
            ? (ratedComplaints.reduce((sum, c) => sum + Number(c.feedback_rating || 0), 0) / ratedComplaints.length).toFixed(1)
            : '—';
        const resolvedRate = stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0;
        const activeRate = stats.total ? Math.round((inProgress / stats.total) * 100) : 0;
        const overdueRate = stats.total ? Math.round((stats.overdue / stats.total) * 100) : 0;
        const fullStars = averageRating === '—' ? 0 : Math.round(Number(averageRating));
        return (<div className="admin-dashboard-page admin-mobile-reference-page">
          <div className="admin-dashboard-heading">
            <div>
              <h2>Campus Maintenance</h2>
              <p>Overview of complaints, work orders and staff activity.</p>
            </div>
            <button onClick={() => onNavigate('assign')} className="admin-primary-action"><UserCog className="w-4 h-4"/> Assign Complaint</button>
          </div>

          <div className="admin-section-kicker">OVERALL STATS</div>
          <div className="admin-mobile-stat-row">
            <AdminReferenceStat icon={ClipboardList} tone="blue" label="Total Complaints" value={stats.total} meta={`${openCount + inProgress} active`} onClick={() => onOpenComplaints?.('total')}/>
            <AdminReferenceStat icon={AlertTriangle} tone="green" label="Open" value={openCount} meta={`${stats.unassigned} unassigned`} onClick={() => onOpenComplaints?.('open')}/>
            <AdminReferenceStat icon={Wrench} tone="cyan" label="In Progress" value={inProgress} meta={`${Math.max(activeStaff, 1)} staff`} onClick={() => onOpenComplaints?.('in_progress')}/>
          </div>

          <RejectedHomePanel complaints={rejectedComplaints} onOpenComplaint={onOpenComplaint}/>

          <button type="button" onClick={() => onNavigate('feedback')} className="admin-rating-card admin-rating-card-button" aria-label="Open feedback and ratings">
            <span>Average Rating</span>
            <strong>{averageRating}<small>/5</small></strong>
            <div className="admin-rating-stars" aria-label={`${averageRating} out of 5 stars`}>{[1,2,3,4,5].map((n) => <Star key={n} size={23} fill={n <= fullStars ? 'currentColor' : 'none'}/>)}</div>
          </button>

          <div className="admin-section-kicker admin-quick-kicker">QUICK ACTIONS</div>
          <div className="admin-quick-grid">
            <button onClick={() => onNavigate('assign')}><span><PlusCircle/></span><b>+ New<br/>Complaint</b><small>Create a complaint</small></button>
            <button onClick={() => onNavigate('assign')}><span><UserCog/></span><b>Assign Work</b><small>Allocate pending tasks</small></button>
            <button onClick={() => onNavigate('reports')}><span><BarChart3/></span><b>View Reports</b><small>Performance analytics</small></button>
            <button onClick={() => onNavigate('users')}><span><Users/></span><b>User<br/>Management</b><small>Manage staff access</small></button>
          </div>

          <div className="admin-recent-heading">
            <div className="admin-section-kicker">RECENT ACTIVITY</div>
            <button onClick={() => onNavigate('work-orders')}>View All <ArrowRight size={16}/></button>
          </div>
          <Card className="admin-reference-panel admin-recent-panel">
            <ComplaintList complaints={recent.slice(0, 3)} onOpenComplaint={onOpenComplaint}/>
          </Card>

          <Card className="admin-reference-panel admin-service-panel">
            <div className="admin-reference-panel-head"><div><h3>Service Health</h3><p>Current workload snapshot</p></div></div>
            <div className="admin-service-health">
              <div className="admin-service-donut" style={{ '--value': resolvedRate }}><span>{resolvedRate}%</span></div>
              <div className="admin-service-legend">
                <div><i className="resolved"/><span>Resolved</span><b>{resolvedRate}%</b></div>
                <div><i className="progress"/><span>In progress</span><b>{activeRate}%</b></div>
                <div><i className="overdue"/><span>Overdue</span><b>{overdueRate}%</b></div>
              </div>
            </div>
          </Card>
        </div>);
    }
    return (<div className="max-w-7xl mx-auto">
      <PageHeader eyebrow={todayLabel} title={greeting + ', ' + firstName} subtitle={isStaff ? 'Your assigned jobs and tasks are ready.' : 'Here is what’s happening with your campus requests.'} action={isStudent && (<button onClick={() => onNavigate('raise')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all">
            <PlusCircle className="w-4 h-4"/> New Complaint
          </button>)}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Complaints" value={stats.total} icon={ClipboardList} color="blue"/>
        <StatCard label="Open" value={stats.open} icon={Clock} color="amber"/>
        <StatCard label="Closed" value={stats.resolved} icon={CheckCircle2} color="emerald"/>
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} color="rose"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Recent Complaints</h3>
            {isStudent && <button onClick={() => onNavigate('my-complaints')} className="text-xs font-semibold text-blue-600 flex items-center gap-1">View all <ArrowRight className="w-3 h-3"/></button>}
          </div>
          <ComplaintList complaints={recent} onOpenComplaint={onOpenComplaint}/>
        </Card>
        <div className="space-y-6">
          <InsightCard title="By Category" items={categoryStats.map((c) => ({ id: c.id, name: c.name, count: c.count, color: c.color }))} max={maxCat}/>
          {isStaff && <Card className="p-5"><h3 className="font-bold text-slate-900 mb-3">My Workload</h3><p className="text-sm text-slate-600">Active jobs <strong className="float-right text-slate-900">{stats.open}</strong></p><p className="text-sm text-slate-600 mt-3">Completed <strong className="float-right text-emerald-600">{stats.resolved}</strong></p><button onClick={() => onNavigate('technician-jobs')} className="w-full mt-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">View My Jobs</button></Card>}
        </div>
      </div>
    </div>);
}
function RejectedHomePanel({ complaints, onOpenComplaint }) {
    const visible = complaints.slice(0, 3);
    return <section className="admin-rejected-home" aria-label="Rejected complaints">
      <div className="admin-rejected-home-head">
        <span className="admin-rejected-home-icon"><AlertTriangle/></span>
        <div><small>HOME ONLY</small><strong>Rejected Complaints</strong><p>Not included in totals, reports or categories.</p></div>
        <b>{complaints.length}</b>
      </div>
      {visible.length > 0 && <div className="admin-rejected-home-list">
        {visible.map((complaint) => <button key={complaint.id} type="button" onClick={() => onOpenComplaint?.(complaint.id)}>
          <span><strong>{complaint.title || 'Rejected complaint'}</strong><small>{complaint.complaint_no || 'Complaint'} · {complaint.buildings?.name || complaint.location_description || 'Campus'}</small></span>
          <em>Rejected</em>
        </button>)}
      </div>}
      {complaints.length === 0 && <p className="admin-rejected-home-empty">No rejected complaints.</p>}
    </section>;
}

function AdminReferenceStat({ icon: Icon, tone, label, value, meta, onClick }) {
    return <button type="button" onClick={onClick} className="admin-reference-stat admin-reference-stat-button"><span className={`admin-reference-stat-icon ${tone}`}><Icon/></span><div><small>{label}</small><strong>{value}</strong><em>{meta}</em></div></button>;
}

function ComplaintList({ complaints, onOpenComplaint }) {
    if (!complaints.length)
        return <EmptyState icon={ClipboardList} title="No complaints yet" description="New complaints will appear here."/>;
    return <div className="space-y-2">{complaints.map((c) => {
            const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.submitted;
            const pc = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.medium;
            return (<button key={c.id} onClick={() => onOpenComplaint(c.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.complaint_categories?.color || '#3B82F6') + '15' }}>
          <Wrench className="w-5 h-5" style={{ color: c.complaint_categories?.color || '#3B82F6' }}/>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{c.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{c.complaint_no} · {c.buildings?.name || c.complaint_categories?.name || 'Campus'} · {c.created_at ? timeAgo(c.created_at) : 'recently'}</p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0">
          <Badge className={`${sc.bg} ${sc.color}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{sc.label}</Badge>
          <Badge className={`${pc.bg} ${pc.color} border ${pc.border}`}>{pc.label}</Badge>
        </div>
      </button>);
        })}</div>;
}
function MiniStat({ icon: Icon, label, value }) {
    return <Card className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Icon className="w-5 h-5 text-slate-600"/></div><div><p className="text-xl font-bold text-slate-900 leading-none">{value}</p><p className="text-xs text-slate-500 mt-1">{label}</p></div></Card>;
}
function InsightCard({ title, items, max }) {
    return <Card className="p-5"><h3 className="font-bold text-slate-900 mb-4">{title}</h3>{items.length === 0 ? <p className="text-sm text-slate-400">No data available</p> : <div className="space-y-3">{items.map((item) => <div key={item.id}><div className="flex items-center justify-between text-xs mb-1"><span className="font-medium text-slate-700 truncate pr-2">{item.name}</span><span className="font-semibold text-slate-900">{item.count}{item.detail ? <span className="font-normal text-slate-400 ml-1">· {item.detail}</span> : null}</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundColor: item.color }}/></div></div>)}</div>}</Card>;
}
function QuickAction({ icon: Icon, label, onClick }) {
    return <button onClick={onClick} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Icon className="w-4 h-4 text-slate-600"/></div><span className="text-sm font-medium text-slate-700">{label}</span><ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-auto"/></button>;
}
