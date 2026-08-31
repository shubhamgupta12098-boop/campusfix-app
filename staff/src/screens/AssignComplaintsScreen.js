import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Spinner, EmptyState } from '@/components/ui';
import { PRIORITY_CONFIG, formatDate } from '@/lib/constants';
import { ChevronDown, ClipboardList, Filter, Search, Send, UserRound, Wrench, X } from 'lucide-react';

export function AssignComplaintsScreen({ onOpenComplaint }) {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedTech, setSelectedTech] = useState('');
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [status, setStatus] = useState('all');

  useEffect(() => { if (profile?.id) void load(); }, [profile?.id]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [c, t] = await Promise.all([
        supabase.from('complaints').select('*, complaint_categories(*), buildings(*), profiles!complaints_assigned_to_fkey(*)').in('status', ['submitted', 'verified', 'assigned']).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*, technicians(*)').eq('role', 'staff').eq('is_active', true),
      ]);
      if (c.error) throw new Error(c.error.message);
      if (t.error) throw new Error(t.error.message);
      setComplaints(c.data || []);
      setTechnicians(t.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load complaints.');
      setComplaints([]);
      setTechnicians([]);
    } finally {
      setLoading(false);
    }
  };

  const assign = async () => {
    if (!assignModal || !selectedTech || assigning) return;
    if (!['verified', 'assigned'].includes(assignModal.status)) {
      setError('Open the complaint detail first and mark it as genuine before assigning staff.');
      return;
    }
    setAssigning(true);
    setError('');
    try {
      const chosenStaff = technicians.find((t) => t.id === selectedTech);
      const result = await supabase.from('complaints').update({
        status: 'assigned', assigned_to: selectedTech, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', assignModal.id);
      if (result.error) throw new Error(result.error.message);
      await supabase.from('complaint_status_history').insert({
        complaint_id: assignModal.id, old_status: assignModal.status, new_status: 'assigned', changed_by: profile?.id, remarks: `Assigned to ${chosenStaff?.full_name || 'staff'}`,
      });
      await supabase.from('notifications').insert({
        user_id: selectedTech, title: 'New Complaint Assigned', message: assignModal.title, type: 'assigned', related_id: assignModal.id, is_read: false,
      });
      await supabase.from('technicians').update({ current_workload: (chosenStaff?.technician?.current_workload || 0) + 1 }).eq('id', selectedTech);
      setAssignModal(null);
      setSelectedTech('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Complaint could not be assigned.');
    } finally {
      setAssigning(false);
    }
  };

  const filtered = useMemo(() => complaints.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [c.title, c.complaint_no, c.location_description, c.buildings?.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    const matchesPriority = priority === 'all' || c.priority === priority;
    const matchesStatus = status === 'all' || c.status === status;
    return matchesSearch && matchesPriority && matchesStatus;
  }), [complaints, search, priority, status]);

  if (loading) return <Spinner/>;

  return <div className="admin-screen admin-assign-screen">
    <label className="admin-big-search"><Search size={23}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search"/></label>
    <div className="admin-filter-row">
      <label><Filter size={18}/><select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">Priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="emergency">Emergency</option></select><ChevronDown size={17}/></label>
      <label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Department, Status</option><option value="submitted">Needs Review</option><option value="verified">Verified</option><option value="assigned">Assigned</option></select><ChevronDown size={17}/></label>
    </div>

    {error && <div className="admin-inline-error">{error}<button onClick={() => void load()}>Retry</button></div>}

    {filtered.length === 0 ? <div className="admin-empty-card"><EmptyState icon={ClipboardList} title="All caught up" description="No complaints match the selected filters."/></div> : (
      <div className="admin-assign-list">
        {filtered.map((c) => {
          const assignedStaff = c.assigned_profile || (c.assigned_to ? c.profiles : null);
          const reporterName = c.reporter_profile?.full_name || 'Campus User';
          const initials = reporterName.split(' ').map((x) => x[0]).slice(0,2).join('').toUpperCase();
          const priorityCfg = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.medium;
          const genuineLabel = c.status === 'submitted' ? 'Pending review' : c.status === 'rejected' ? 'No' : 'Yes';
          return <article key={c.id} className="admin-assign-card">
            <div className="admin-assign-avatar">{initials || <UserRound size={24}/>}</div>
            <div className="admin-assign-copy">
              <button type="button" onClick={() => onOpenComplaint(c.id)} className="admin-assign-title">{c.title}</button>
              <span className="admin-assign-priority">{priorityCfg.label}</span>
              <div className="admin-assign-meta"><span>Genuine</span><strong className={`admin-genuine-text ${genuineLabel === 'Yes' ? 'yes' : genuineLabel === 'No' ? 'no' : ''}`}>{genuineLabel}</strong></div>
              <div className="admin-assign-meta"><span>Staff</span><strong>{assignedStaff?.full_name ? `${assignedStaff.full_name} · ${assignedStaff.department || 'Maintenance'}` : 'Not assigned yet'}</strong></div>
              <div className="admin-assign-meta"><span>Location</span><strong>{c.buildings?.name || c.location_description || 'Campus'}</strong></div>
            </div>
            <span className={`admin-assign-status ${c.status}`}>{c.status === 'submitted' ? 'Needs Review' : c.status === 'verified' ? 'Verified' : 'Assigned'}</span>
            <button type="button" className="admin-assign-button" onClick={() => {
              if (c.status === 'submitted') onOpenComplaint(c.id);
              else { setSelectedTech(c.assigned_to || ''); setAssignModal(c); }
            }}>{c.status === 'submitted' ? 'Review Complaint' : c.assigned_to ? 'Reassign Staff' : 'Assign to Staff'}</button>
          </article>;
        })}
      </div>
    )}

    {assignModal && <div className="admin-dark-modal-layer" onClick={() => setAssignModal(null)}>
      <div className="admin-dark-modal admin-assign-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-dark-modal-header"><div><h3>Assign to Staff</h3><p>{assignModal.title}</p></div><button type="button" onClick={() => setAssignModal(null)}><X size={20}/></button></div>
        {selectedTech && (() => { const picked = technicians.find((item) => item.id === selectedTech); return picked ? <div className="admin-modal-selected-staff"><span>Selected staff</span><strong>{picked.full_name}</strong><small>{picked.department || 'Maintenance'} · {picked.technician?.availability_status === 'busy' ? 'Busy' : 'Available'}</small></div> : null; })()}
        <div className="admin-technician-list">
          {technicians.length === 0 ? <p>No active staff available.</p> : technicians.map((t) => {
            const workload = t.technician?.current_workload || 0;
            return <button type="button" key={t.id} className={selectedTech === t.id ? 'is-selected' : ''} onClick={() => setSelectedTech(t.id)}>
              <span className="admin-tech-avatar"><Wrench size={18}/></span>
              <span><strong>{t.full_name}</strong><small>{t.department || 'Maintenance'} · {workload} active</small></span>
              <i>{t.technician?.availability_status === 'busy' ? 'Busy' : 'Available'}</i>
            </button>;
          })}
        </div>
        <button type="button" onClick={() => void assign()} disabled={!selectedTech || assigning} className="admin-dark-primary"><Send size={18}/>{assigning ? 'Assigning…' : 'Assign Staff'}</button>
      </div>
    </div>}
  </div>;
}
