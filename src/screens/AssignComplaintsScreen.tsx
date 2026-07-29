import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate } from '@/lib/constants';
import type { Complaint, Profile, Technician } from '@/lib/supabase';
import { ClipboardList, Wrench, MapPin, User, Clock, X, Send } from 'lucide-react';

export function AssignComplaintsScreen() {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [technicians, setTechnicians] = useState<(Profile & { technician?: Technician })[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<Complaint | null>(null);
  const [selectedTech, setSelectedTech] = useState('');

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const [c, t] = await Promise.all([
      supabase.from('complaints').select('*, complaint_categories(*), buildings(*), profiles!complaints_assigned_to_fkey(*)').in('status', ['submitted', 'verified', 'assigned']).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*, technicians(*)').eq('role', 'technician').eq('is_active', true),
    ]);
    setComplaints((c.data || []) as unknown as Complaint[]);
    setTechnicians((t.data || []) as unknown as (Profile & { technician?: Technician })[]);
    setLoading(false);
  };

  const verify = async (c: Complaint) => {
    await supabase.from('complaints').update({ status: 'verified', updated_at: new Date().toISOString() }).eq('id', c.id);
    await supabase.from('complaint_status_history').insert({
      complaint_id: c.id, old_status: c.status, new_status: 'verified', changed_by: profile?.id, remarks: 'Complaint verified',
    });
    await supabase.from('notifications').insert({
      user_id: c.user_id, title: 'Complaint Verified', message: `${c.title} has been verified and is pending assignment.`, type: 'status_changed', related_id: c.id,
    });
    void load();
  };

  const assign = async () => {
    if (!assignModal || !selectedTech) return;
    await supabase.from('complaints').update({
      status: 'assigned', assigned_to: selectedTech, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', assignModal.id);
    await supabase.from('complaint_status_history').insert({
      complaint_id: assignModal.id, old_status: assignModal.status, new_status: 'assigned', changed_by: profile?.id, remarks: 'Assigned to technician',
    });
    await supabase.from('notifications').insert([
      { user_id: selectedTech, title: 'New Job Assigned', message: assignModal.title, type: 'assigned', related_id: assignModal.id },
      { user_id: assignModal.user_id, title: 'Technician Assigned', message: `${assignModal.title} — a technician has been assigned.`, type: 'assigned', related_id: assignModal.id },
    ]);
    // Update technician workload
    await supabase.from('technicians').update({ current_workload: (technicians.find((t) => t.id === selectedTech)?.technician?.current_workload || 0) + 1 }).eq('id', selectedTech);
    setAssignModal(null);
    setSelectedTech('');
    void load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Assign Complaints" subtitle={`${complaints.length} pending complaints`} />

      {complaints.length === 0 ? (
        <Card className="p-0"><EmptyState icon={ClipboardList} title="All caught up" description="No complaints pending assignment." /></Card>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const sc = STATUS_CONFIG[c.status];
            const pc = PRIORITY_CONFIG[c.priority];
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.complaint_categories?.color || '#3B82F6') + '15' }}>
                    <Wrench className="w-5 h-5" style={{ color: c.complaint_categories?.color || '#3B82F6' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">{c.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{c.complaint_no} · {c.complaint_categories?.name} · {formatDate(c.created_at)}</p>
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{c.description}</p>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <Badge className={`${sc.bg} ${sc.color}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}</Badge>
                      <Badge className={`${pc.bg} ${pc.color} border ${pc.border}`}>{pc.label}</Badge>
                      {c.buildings && <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.buildings.name}</span>}
                      {c.assigned_profile && <span className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" />{c.assigned_profile.full_name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  {c.status === 'submitted' && (
                    <button onClick={() => verify(c)} className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100">
                      Verify
                    </button>
                  )}
                  <button onClick={() => setAssignModal(c)} className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700">
                    {c.assigned_to ? 'Reassign' : 'Assign Technician'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAssignModal(null)}>
          <Card className="p-6 w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Assign Technician</h3>
                <button onClick={() => setAssignModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-slate-600 mb-1">{assignModal.title}</p>
              <p className="text-xs text-slate-400 mb-4">{assignModal.complaint_categories?.name} · {PRIORITY_CONFIG[assignModal.priority].label}</p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {technicians.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No technicians available</p>
                ) : (
                  technicians.map((t) => {
                    const workload = t.technician?.current_workload || 0;
                    const isAvailable = t.technician?.availability_status !== 'busy';
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTech(t.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedTech === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Wrench className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{t.full_name}</p>
                          <p className="text-xs text-slate-500">{t.technician?.employee_code || 'No code'}</p>
                          {t.technician?.skills && t.technician.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {t.technician.skills.slice(0, 3).map((s: string) => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{s}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <Badge className={isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
                            {isAvailable ? 'Available' : 'Busy'}
                          </Badge>
                          <p className="text-xs text-slate-500 mt-1">{workload} active</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                onClick={assign}
                disabled={!selectedTech}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Assign
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
