import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { onImageError } from '@/lib/constants';
import { CheckCircle2, XCircle, Image, ShieldCheck, User, MapPin, Mail, Phone, Video } from 'lucide-react';
export function ApprovalScreen({ onOpenComplaint }) {
    const { profile } = useAuthStore();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [remarks, setRemarks] = useState({});
    const [busy, setBusy] = useState(null);
    const load = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('work_orders')
            .select('*, profiles!work_orders_technician_id_fkey(*), complaints(*, complaint_categories(*), buildings(*), profiles!complaints_user_id_fkey(*))')
            .eq('approval_status', 'pending')
            .order('created_at', { ascending: false });
        setOrders((data || []));
        setLoading(false);
    };
    useEffect(() => { void load(); }, []);
    const decide = async (wo, approved) => {
        setBusy(wo.id);
        const note = remarks[wo.id]?.trim() || (approved ? 'Work verified and approved by admin.' : 'Work rejected. Please fix the issue and submit again.');
        await supabase.from('work_orders').update({
            approval_status: approved ? 'approved' : 'rejected',
            approval_remarks: note,
            approved_by: profile?.id,
            approved_at: new Date().toISOString(),
            status: approved ? 'completed' : 'rework_required',
        }).eq('id', wo.id);
        const complaint = wo.complaints || await (async () => {
            const r = await supabase.from('complaints').select('*').eq('id', wo.complaint_id).maybeSingle();
            return r.data;
        })();
        if (complaint) {
            const completedAt = new Date().toISOString();
            await supabase.from('complaints').update({
                status: approved ? 'closed' : 'in_progress',
                closed_at: approved ? completedAt : undefined,
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
            const alerts = [];
            if (approved) {
                // A student gets exactly one notification for a complaint: when
                // the completed work is approved. Re-opening/approving the same
                // record cannot create a duplicate completion alert.
                const existing = await supabase.from('notifications')
                    .select('*')
                    .eq('user_id', complaint.user_id)
                    .eq('related_id', complaint.id)
                    .eq('type', 'work_completed')
                    .maybeSingle();
                if (!existing.data) {
                    alerts.push(supabase.from('notifications').insert({
                        user_id: complaint.user_id,
                        title: 'Work Completed',
                        message: `${complaint.title} has been completed and approved. Tap to view the complaint details.`,
                        type: 'work_completed',
                        related_id: complaint.id,
                        is_read: false,
                    }));
                }
            }
            if (wo.technician_id) {
                alerts.push(supabase.from('notifications').insert({
                    user_id: wo.technician_id,
                    title: approved ? 'Work Approved' : 'Rework Required',
                    message: `${complaint.title} — ${note}`,
                    type: 'approval',
                    related_id: complaint.id,
                }));
            }
            await Promise.all(alerts);
        }
        setBusy(null);
        void load();
    };
    if (loading)
        return <Spinner />;
    return <div className="max-w-5xl mx-auto">
    <PageHeader title="Work Approvals" subtitle={`${orders.length} submissions waiting for verification`}/>
    {orders.length === 0 ? <Card className="p-0"><EmptyState icon={ShieldCheck} title="No pending approvals" description="Staff completion submissions will appear here."/></Card> :
            <div className="space-y-4">{orders.map(wo => <Card key={wo.id} className="p-5">
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div><button onClick={() => onOpenComplaint(wo.complaint_id)} className="font-bold text-slate-900 hover:text-blue-600">{wo.complaints?.title || wo.work_order_no}</button><p className="text-xs text-slate-500 mt-1">{wo.work_order_no} · {wo.profiles?.full_name || 'Staff member'}</p></div>
              <Badge className="bg-violet-50 text-violet-700">Waiting Approval</Badge>
            </div>
            {wo.complaints && (<div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 p-3 bg-white">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5 mb-2"><User className="w-4 h-4 text-blue-600"/>Student details</p>
                  <p className="font-semibold text-slate-700">{wo.complaints.profiles?.full_name || 'Student'}</p>
                  {wo.complaints.profiles?.email && <p className="text-slate-500 flex items-center gap-1 mt-1"><Mail className="w-3 h-3"/>{wo.complaints.profiles.email}</p>}
                  {wo.complaints.profiles?.phone && <p className="text-slate-500 flex items-center gap-1 mt-1"><Phone className="w-3 h-3"/>{wo.complaints.profiles.phone}</p>}
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-white">
                  <p className="font-bold text-slate-800 mb-2">Complaint details</p>
                  <p className="text-slate-600">{wo.complaints.description}</p>
                  <p className="text-slate-500 flex items-center gap-1 mt-2"><MapPin className="w-3 h-3"/>{wo.complaints.buildings?.name || 'Location'}{wo.complaints.location_description ? ` · ${wo.complaints.location_description}` : ''}</p>
                  {((wo.complaints.photo_urls || []).length > 0 || (wo.complaints.video_urls || []).length > 0) && (<div className="flex gap-1.5 mt-2 flex-wrap">
                      {(wo.complaints.photo_urls || []).map((url, i) => (<a key={`p-${i}`} href={url} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                          <img src={url} alt={`Complaint photo ${i + 1}`} className="w-full h-full object-cover" onError={onImageError}/>
                        </a>))}
                      {(wo.complaints.video_urls || []).map((url, i) => (<div key={`v-${i}`} className="w-20 rounded-lg overflow-hidden border border-slate-200 bg-black"><video src={url} controls preload="metadata" className="w-full h-12 object-contain"/><div className="flex items-center gap-1 bg-white px-1.5 py-1 text-[9px] text-slate-600"><Video className="w-3 h-3"/>Video</div></div>))}
                    </div>)}
                </div>
              </div>)}
            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl mt-3"><span className="font-semibold">Staff remarks:</span> {wo.repair_notes || 'No completion remarks supplied.'}</p>
            <div className="mt-3 grid sm:grid-cols-2 gap-4">
              <div><p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><Image className="w-3.5 h-3.5"/>Before repair</p><div className="flex flex-wrap gap-2">{(wo.before_photo_urls || []).length === 0 ? <p className="text-xs text-slate-400">Not provided</p> : (wo.before_photo_urls || []).map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Before repair ${i + 1}`} className="w-24 h-24 object-cover rounded-xl border border-slate-200" onError={onImageError}/></a>)}</div></div>
              <div><p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><Image className="w-3.5 h-3.5"/>After repair <span className="text-red-600">*</span></p><div className="flex flex-wrap gap-2">{(wo.completion_photo_urls || []).map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`After repair ${i + 1}`} className="w-24 h-24 object-cover rounded-xl border border-slate-200" onError={onImageError}/></a>)}</div></div>
            </div>
          </div>
          <div className="lg:w-80">
            <textarea value={remarks[wo.id] || ''} onChange={e => setRemarks(v => ({ ...v, [wo.id]: e.target.value }))} rows={4} placeholder="Approval/rejection remarks…" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"/>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button disabled={busy === wo.id} onClick={() => void decide(wo, true)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"><CheckCircle2 className="w-4 h-4"/>Approve</button>
              <button disabled={busy === wo.id} onClick={() => void decide(wo, false)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-60"><XCircle className="w-4 h-4"/>Reject</button>
            </div>
          </div>
        </div>
      </Card>)}</div>}
  </div>;
}
