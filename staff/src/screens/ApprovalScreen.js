import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Spinner, EmptyState } from '@/components/ui';
import { onImageError, timeAgo } from '@/lib/constants';
import { Check, ClipboardCheck, UserRound, X } from 'lucide-react';

export function ApprovalScreen({ onOpenComplaint }) {
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [tab, setTab] = useState('pending');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('work_orders')
      .select('*, profiles!work_orders_technician_id_fkey(*), complaints(*, complaint_categories(*), buildings(*), profiles!complaints_user_id_fkey(*))')
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const decide = async (wo, approved) => {
    setBusy(wo.id);
    const note = approved ? 'Work verified and approved by admin.' : 'Work rejected. Please fix the issue and submit again.';
    await supabase.from('work_orders').update({
      approval_status: approved ? 'approved' : 'rejected',
      approval_remarks: note,
      approved_by: profile?.id,
      approved_at: new Date().toISOString(),
      status: approved ? 'completed' : 'rework_required',
    }).eq('id', wo.id);

    const complaint = wo.complaints;
    if (complaint) {
      const completedAt = new Date().toISOString();
      await supabase.from('complaints').update({
        status: approved ? 'closed' : 'in_progress',
        closed_at: approved ? completedAt : complaint.closed_at,
        resolved_at: approved ? completedAt : complaint.resolved_at,
        updated_at: completedAt,
      }).eq('id', complaint.id);
      await supabase.from('complaint_status_history').insert({
        complaint_id: complaint.id,
        old_status: 'waiting_approval',
        new_status: approved ? 'closed' : 'in_progress',
        changed_by: profile?.id,
        changed_by_name: profile?.full_name,
        remarks: note,
      });
      if (approved) {
        const existing = await supabase.from('notifications')
          .select('*').eq('user_id', complaint.user_id).eq('related_id', complaint.id).eq('type', 'work_completed').maybeSingle();
        if (!existing.data) {
          await supabase.from('notifications').insert({
            user_id: complaint.user_id,
            title: 'Work Completed',
            message: `${complaint.title} has been completed and approved.`,
            type: 'work_completed',
            related_id: complaint.id,
            is_read: false,
          });
        }
      }
      if (wo.technician_id) {
        await supabase.from('notifications').insert({
          user_id: wo.technician_id,
          title: approved ? 'Work Approved' : 'Rework Required',
          message: `${complaint.title} — ${note}`,
          type: 'approval',
          related_id: complaint.id,
          is_read: false,
        });
      }
    }
    setBusy(null);
    void load();
  };

  const counts = useMemo(() => ({
    pending: orders.filter((o) => !o.approval_status || o.approval_status === 'pending').length,
    approved: orders.filter((o) => o.approval_status === 'approved').length,
    rejected: orders.filter((o) => o.approval_status === 'rejected').length,
  }), [orders]);

  const filtered = useMemo(() => orders.filter((o) => {
    const status = o.approval_status || 'pending';
    return status === tab;
  }), [orders, tab]);

  if (loading) return <Spinner/>;

  return <div className="admin-screen admin-approvals-screen">
    <div className="admin-segmented-tabs" role="tablist" aria-label="Approval status">
      {['pending', 'approved', 'rejected'].map((item) => (
        <button key={item} type="button" onClick={() => setTab(item)} className={tab === item ? 'is-active' : ''}>
          <span>{item[0].toUpperCase() + item.slice(1)}</span>
          {item === 'pending' && counts.pending > 0 && <b>{counts.pending}</b>}
        </button>
      ))}
    </div>

    {filtered.length === 0 ? (
      <div className="admin-empty-card"><EmptyState icon={ClipboardCheck} title={`No ${tab} approvals`} description="Work completion submissions will appear here."/></div>
    ) : (
      <div className="admin-approval-list">
        {filtered.map((wo) => {
          const photos = [...(wo.completion_photo_urls || []), ...(wo.before_photo_urls || [])].slice(0, 3);
          return <article key={wo.id} className="admin-approval-card">
            <button type="button" className="admin-approval-title" onClick={() => wo.complaint_id && onOpenComplaint(wo.complaint_id)}>
              <span className="admin-dot"/> {wo.work_order_no || 'WORK ORDER'}
            </button>
            <time>{timeAgo(wo.updated_at || wo.created_at)}</time>

            <div className="admin-approval-line"><UserRound size={18}/><span>Staff:</span><strong>{wo.profiles?.full_name || 'Maintenance Staff'}</strong></div>
            <div className="admin-approval-line"><ClipboardCheck size={18}/><span>Task:</span><strong>{wo.complaints?.title || wo.repair_notes || 'Maintenance work'}</strong></div>

            <div className="admin-approval-photos">
              <span>Photos:</span>
              <div>
                {photos.length ? photos.map((url, i) => <button key={`${url}-${i}`} type="button" onClick={() => wo.complaint_id && onOpenComplaint(wo.complaint_id)}><img src={url} alt={`Work evidence ${i + 1}`} onError={onImageError}/></button>) : (
                  [0,1,2].map((i) => <span className="admin-photo-placeholder" key={i}><ClipboardCheck size={20}/></span>)
                )}
              </div>
            </div>

            {tab === 'pending' ? <div className="admin-approval-actions">
              <button disabled={busy === wo.id} onClick={() => void decide(wo, true)} className="approve"><Check size={22}/>Approve</button>
              <button disabled={busy === wo.id} onClick={() => void decide(wo, false)} className="reject"><X size={22}/>Reject</button>
            </div> : <div className={`admin-decision-banner ${tab}`}><span>{tab === 'approved' ? 'Approved' : 'Rejected'}</span>{wo.approval_remarks && <small>{wo.approval_remarks}</small>}</div>}
          </article>;
        })}
      </div>
    )}
  </div>;
}
