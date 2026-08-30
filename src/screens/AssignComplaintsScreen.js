import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate, onImageError } from '@/lib/constants';
import { ClipboardList, Wrench, MapPin, User, X, Send, Image, Video } from 'lucide-react';
export function AssignComplaintsScreen({ onOpenComplaint }) {
    const { profile } = useAuthStore();
    const [complaints, setComplaints] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assignModal, setAssignModal] = useState(null);
    const [selectedTech, setSelectedTech] = useState('');
    const [error, setError] = useState('');
    const [assigning, setAssigning] = useState(false);
    useEffect(() => {
        if (profile?.id)
            void load();
    }, [profile?.id]);
    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [c, t] = await Promise.all([
                supabase.from('complaints').select('*, complaint_categories(*), buildings(*), profiles!complaints_assigned_to_fkey(*)').in('status', ['submitted', 'verified', 'assigned']).order('created_at', { ascending: false }),
                supabase.from('profiles').select('*, technicians(*)').eq('role', 'staff').eq('is_active', true),
            ]);
            if (c.error)
                throw new Error(c.error.message);
            if (t.error)
                throw new Error(t.error.message);
            setComplaints((c.data || []));
            setTechnicians((t.data || []));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load assigned complaints.');
            setComplaints([]);
            setTechnicians([]);
        }
        finally {
            setLoading(false);
        }
    };
    const assign = async () => {
        if (!assignModal || !selectedTech || assigning)
            return;
        if (!['verified', 'assigned'].includes(assignModal.status)) {
            setError('Open the complaint detail first and mark it as a genuine complaint before assigning staff.');
            return;
        }
        setAssigning(true);
        setError('');
        try {
            const chosenStaff = technicians.find((t) => t.id === selectedTech);
            const updateResult = await supabase.from('complaints').update({
                status: 'assigned', assigned_to: selectedTech, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', assignModal.id);
            if (updateResult.error)
                throw new Error(updateResult.error.message);
            await supabase.from('complaint_status_history').insert({
                complaint_id: assignModal.id, old_status: assignModal.status, new_status: 'assigned', changed_by: profile?.id, remarks: `Assigned to ${chosenStaff?.full_name || 'staff'}`,
            });
            await supabase.from('notifications').insert({
                user_id: selectedTech,
                title: 'New Job Assigned',
                message: assignModal.title,
                type: 'assigned',
                related_id: assignModal.id,
            });
            // Update technician workload
            await supabase.from('technicians').update({ current_workload: (technicians.find((t) => t.id === selectedTech)?.technician?.current_workload || 0) + 1 }).eq('id', selectedTech);
            setAssignModal(null);
            setSelectedTech('');
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Complaint could not be assigned.');
        }
        finally {
            setAssigning(false);
        }
    };
    if (loading)
        return <Spinner />;
    return (<div className="max-w-4xl mx-auto">
      <PageHeader title="Assign Complaints" subtitle="Admin review is required before any complaint can be assigned to staff"/>

      {error && (<Card className="p-4 mb-4 border border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">Assigned complaints could not be loaded</p>
          <p className="text-xs text-red-600 mt-1 break-words">{error}</p>
          <button onClick={() => void load()} className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold">Retry</button>
        </Card>)}

      {complaints.length === 0 ? (<Card className="p-0"><EmptyState icon={ClipboardList} title="All caught up" description="No complaints pending assignment."/></Card>) : (<div className="space-y-3">
          {complaints.map((c) => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.submitted;
                const pc = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.medium;
                return (<Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  {c.photo_urls && c.photo_urls.length > 0 ? (<button onClick={() => onOpenComplaint(c.id)} className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200">
                      <img src={c.photo_urls[0]} alt={c.title} className="w-full h-full object-cover" onError={onImageError}/>
                    </button>) : (<div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.complaint_categories?.color || '#3B82F6') + '15' }}>
                      <Wrench className="w-5 h-5" style={{ color: c.complaint_categories?.color || '#3B82F6' }}/>
                    </div>)}
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onOpenComplaint(c.id)} className="text-left w-full">
                      <h3 className="text-sm font-semibold text-slate-900 hover:text-blue-600">{c.title}</h3>
                    </button>
                    <p className="text-xs text-slate-500 mt-0.5">{c.complaint_no} · {c.complaint_categories?.name} · {formatDate(c.created_at)}</p>
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{c.description}</p>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <Badge className={`${sc.bg} ${sc.color}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{sc.label}</Badge>
                      <Badge className={`${pc.bg} ${pc.color} border ${pc.border}`}>{pc.label}</Badge>
                      {c.buildings && <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3"/>{c.buildings.name}</span>}
                      {c.assigned_profile && <span className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3"/>{c.assigned_profile.full_name}</span>}
                      {((c.photo_urls || []).length + (c.video_urls || []).length) > 0 && (<span className="text-xs text-slate-500 flex items-center gap-1"><Image className="w-3 h-3"/>{(c.photo_urls || []).length + (c.video_urls || []).length} media</span>)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button onClick={() => onOpenComplaint(c.id)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50">
                    View Full Detail
                  </button>
                  {c.status === 'submitted' ? (<div className="flex-1 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <span className="text-xs font-semibold text-amber-800">Review complaint detail first</span>
                      <button onClick={() => onOpenComplaint(c.id)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">Review</button>
                    </div>) : (<button onClick={() => { setSelectedTech(c.assigned_to || ''); setAssignModal(c); }} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">
                      {c.assigned_to ? 'Reassign Staff' : 'Assign Staff'}
                    </button>)}
                </div>
              </Card>);
            })}
        </div>)}

      {/* Assign modal */}
      {assignModal && (<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAssignModal(null)}>
          <Card className="p-6 w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Assign Technician</h3>
                <button onClick={() => setAssignModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
              </div>
              <p className="text-sm text-slate-600 mb-1">{assignModal.title}</p>
              <p className="text-xs text-slate-400 mb-2">{assignModal.complaint_categories?.name} · {(PRIORITY_CONFIG[assignModal.priority] || PRIORITY_CONFIG.medium).label}</p>
              <p className="text-xs text-slate-600 mb-3 line-clamp-3">{assignModal.description}</p>
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Admin verified this complaint as genuine. Staff notification will be sent only after assignment.</div>
              {((assignModal.photo_urls || []).length > 0 || (assignModal.video_urls || []).length > 0) && (<div className="flex gap-2 mb-4 overflow-x-auto">
                  {(assignModal.photo_urls || []).map((url, i) => (<a key={`p-${i}`} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                      <img src={url} alt={`Complaint photo ${i + 1}`} className="w-full h-full object-cover" onError={onImageError}/>
                    </a>))}
                  {(assignModal.video_urls || []).map((url, i) => (<div key={`v-${i}`} className="w-24 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-black"><video src={url} controls preload="metadata" className="w-full h-16 object-contain"/><div className="flex items-center gap-1 bg-white px-2 py-1 text-[10px] text-slate-600"><Video className="w-3 h-3"/>Video</div></div>))}
                </div>)}
              <button onClick={() => onOpenComplaint(assignModal.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 mb-4 -mt-1 block">
                View full complaint detail →
              </button>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {technicians.length === 0 ? (<p className="text-sm text-slate-400 text-center py-4">No technicians available</p>) : (technicians.map((t) => {
                const workload = t.technician?.current_workload || 0;
                const isAvailable = t.technician?.availability_status !== 'busy';
                return (<button key={t.id} onClick={() => setSelectedTech(t.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedTech === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Wrench className="w-4 h-4 text-amber-600"/>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{t.full_name}</p>
                          <p className="text-xs text-slate-500">{t.department || 'General Maintenance'}{t.phone ? ` · ${t.phone}` : ''}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{t.technician?.employee_code || t.email || 'Staff account'}</p>
                          {t.technician?.skills && t.technician.skills.length > 0 && (<div className="flex flex-wrap gap-1 mt-1">
                              {t.technician.skills.slice(0, 3).map((s) => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{s}</span>)}
                            </div>)}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <Badge className={isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
                            {isAvailable ? 'Available' : 'Busy'}
                          </Badge>
                          <p className="text-xs text-slate-500 mt-1">{workload} active</p>
                        </div>
                      </button>);
            }))}
              </div>

              <button onClick={assign} disabled={!selectedTech || assigning} className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                <Send className="w-4 h-4"/>
                {assigning ? 'Assigning…' : 'Assign Staff'}
              </button>
            </div>
          </Card>
        </div>)}
    </div>);
}
