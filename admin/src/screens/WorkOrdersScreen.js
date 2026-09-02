import { useEffect, useMemo, useState } from 'react';
import { localData } from '@/lib/localDataClient';
import { Spinner, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/constants';
import { CalendarDays, ClipboardList, Eye, Pencil, UserRound } from 'lucide-react';

const normalizeStatus = (wo) => {
  if (wo.approval_status === 'approved' || wo.status === 'completed') return 'completed';
  if (wo.status === 'in_progress' || wo.status === 'rework_required' || wo.approval_status === 'pending') return 'progress';
  return 'pending';
};

const progressFor = (wo) => normalizeStatus(wo) === 'completed' ? 100 : normalizeStatus(wo) === 'progress' ? 60 : 20;

export function WorkOrdersScreen({ onOpenComplaint }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await localData.from('work_orders').select('*').order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => orders.filter((wo) => filter === 'all' || normalizeStatus(wo) === filter), [orders, filter]);

  if (loading) return <Spinner/>;

  return <div className="admin-screen admin-work-orders-screen">
    <div className="admin-order-tabs">
      {[['all','All'],['pending','Pending'],['progress','In Progress'],['completed','Completed']].map(([id,label]) => (
        <button key={id} type="button" onClick={() => setFilter(id)} className={filter === id ? 'is-active' : ''}>{label}</button>
      ))}
    </div>

    {error && <div className="admin-inline-error">{error}<button onClick={() => void load()}>Retry</button></div>}

    {!error && filtered.length === 0 ? <div className="admin-empty-card"><EmptyState icon={ClipboardList} title="No work orders" description="Work orders will appear after staff starts assigned work."/></div> : (
      <div className="admin-order-list">
        {filtered.map((wo) => {
          const status = normalizeStatus(wo);
          const progress = progressFor(wo);
          const priority = (wo.complaints?.priority || 'medium').toLowerCase();
          const staffName = wo.profiles?.full_name || 'Maintenance Staff';
          const initials = staffName.split(' ').map((x) => x[0]).slice(0,2).join('').toUpperCase();
          const due = wo.complaints?.expected_completion || wo.completion_time || wo.created_at;
          return <article key={wo.id} className="admin-order-card">
            <div className="admin-order-topline">
              <div><span>WO-ID</span><strong>{wo.work_order_no || wo.id?.slice(-7) || 'WO'}</strong></div>
              <span className={`admin-priority-chip ${priority}`}>{priority === 'high' || priority === 'emergency' ? '↑' : priority === 'low' ? '↓' : '—'} {priority === 'emergency' ? 'HIGH' : priority.toUpperCase()}</span>
            </div>

            <div className="admin-order-linked"><span>Linked Complaint</span><strong>{wo.complaints?.title || 'Campus maintenance task'}</strong></div>

            <div className="admin-order-body">
              <div className="admin-order-staff">
                <span>Assigned Staff</span>
                <div><i>{initials || <UserRound size={18}/>}</i><p><strong>{staffName}</strong><small>{wo.profiles?.department || wo.complaints?.complaint_categories?.name || 'Maintenance'}</small></p></div>
              </div>
              <div className="admin-order-progress">
                <div><span>{status === 'completed' ? 'Completed' : status === 'progress' ? 'In Progress' : 'Pending'}</span><b>{progress}%</b></div>
                <div className="admin-progress-track"><i className={status} style={{ width: `${progress}%` }}/></div>
                <div className="admin-order-due"><CalendarDays size={16}/><span>Due Date</span><strong>{due ? formatDate(due).split(',')[0] : '—'}</strong></div>
              </div>
            </div>

            <div className="admin-order-actions">
              <button type="button" onClick={() => wo.complaint_id && onOpenComplaint(wo.complaint_id)} className="primary"><Pencil size={17}/>Update Status</button>
              <button type="button" onClick={() => wo.complaint_id && onOpenComplaint(wo.complaint_id)}><Eye size={18}/>View Details</button>
            </div>
          </article>;
        })}
      </div>
    )}
    <div className="admin-list-foot">Showing {filtered.length} work order{filtered.length === 1 ? '' : 's'}</div>
  </div>;
}
