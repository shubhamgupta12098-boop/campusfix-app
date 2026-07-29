import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate } from '@/lib/constants';
import type { Complaint, ComplaintStatus } from '@/lib/supabase';
import { Wrench, Clock, MapPin, CheckCircle2, Play, Pause, Camera, X, AlertCircle } from 'lucide-react';

export function TechnicianJobsScreen({ onOpenComplaint }: { onOpenComplaint: (id: string) => void }) {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [workModal, setWorkModal] = useState<Complaint | null>(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from('complaints')
      .select('*, complaint_categories(*), buildings(*)')
      .eq('assigned_to', profile?.id)
      .order('created_at', { ascending: false });
    setComplaints((data || []) as unknown as Complaint[]);
    setLoading(false);
  };

  const updateStatus = async (c: Complaint, newStatus: ComplaintStatus, remarks?: string) => {
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'in_progress' && !c.assigned_at) updates.assigned_at = new Date().toISOString();
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();

    await supabase.from('complaints').update(updates).eq('id', c.id);
    await supabase.from('complaint_status_history').insert({
      complaint_id: c.id,
      old_status: c.status,
      new_status: newStatus,
      changed_by: profile?.id,
      remarks: remarks || `Status changed to ${newStatus}`,
    });

    // Notify the user
    await supabase.from('notifications').insert({
      user_id: c.user_id,
      title: `Complaint ${STATUS_CONFIG[newStatus].label}`,
      message: `${c.title} — ${remarks || STATUS_CONFIG[newStatus].label}`,
      type: 'status_changed',
      related_id: c.id,
    });

    void load();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setCompletionPhotos((prev) => [...prev, reader.result as string].slice(0, 5));
      reader.readAsDataURL(file);
    });
  };

  const completeJob = async () => {
    if (!workModal) return;
    await supabase.from('complaints').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', workModal.id);

    // Create work order
    await supabase.from('work_orders').insert({
      complaint_id: workModal.id,
      technician_id: profile?.id,
      repair_notes: repairNotes,
      completion_photo_urls: completionPhotos,
      start_time: workModal.assigned_at || new Date().toISOString(),
      completion_time: new Date().toISOString(),
      status: 'completed',
      created_by: profile?.id,
    });

    await supabase.from('complaint_status_history').insert({
      complaint_id: workModal.id,
      old_status: workModal.status,
      new_status: 'resolved',
      changed_by: profile?.id,
      remarks: repairNotes || 'Job completed',
    });

    await supabase.from('notifications').insert({
      user_id: workModal.user_id,
      title: 'Complaint Resolved',
      message: `${workModal.title} — Please rate the service.`,
      type: 'feedback',
      related_id: workModal.id,
    });

    setWorkModal(null);
    setRepairNotes('');
    setCompletionPhotos([]);
    void load();
  };

  if (loading) return <Spinner />;

  const active = complaints.filter((c) => ['assigned', 'in_progress'].includes(c.status));
  const completed = complaints.filter((c) => ['resolved', 'closed'].includes(c.status));
  const list = activeTab === 'active' ? active : completed;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="My Jobs" subtitle={`${active.length} active · ${completed.length} completed`} />

      <div className="flex gap-2 mb-5">
        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          Active ({active.length})
        </button>
        <button onClick={() => setActiveTab('completed')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'completed' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          Completed ({completed.length})
        </button>
      </div>

      {list.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon={Wrench} title={activeTab === 'active' ? 'No active jobs' : 'No completed jobs'} description={activeTab === 'active' ? 'Jobs assigned to you will appear here.' : 'Completed jobs will show here.'} />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const sc = STATUS_CONFIG[c.status];
            const pc = PRIORITY_CONFIG[c.priority];
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.complaint_categories?.color || '#3B82F6') + '15' }}>
                    <Wrench className="w-5 h-5" style={{ color: c.complaint_categories?.color || '#3B82F6' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onOpenComplaint(c.id)} className="text-left w-full">
                      <h3 className="text-sm font-semibold text-slate-900 hover:text-blue-600">{c.title}</h3>
                    </button>
                    <p className="text-xs text-slate-500 mt-0.5">{c.complaint_no} · {c.complaint_categories?.name}</p>
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{c.description}</p>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <Badge className={`${sc.bg} ${sc.color}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}</Badge>
                      <Badge className={`${pc.bg} ${pc.color} border ${pc.border}`}>{pc.label}</Badge>
                      {c.buildings && <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.buildings.name}</span>}
                      {c.expected_completion && <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(c.expected_completion)}</span>}
                    </div>
                  </div>
                </div>

                {activeTab === 'active' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    {c.status === 'assigned' && (
                      <button onClick={() => updateStatus(c, 'in_progress', 'Work started')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">
                        <Play className="w-3.5 h-3.5" /> Start Work
                      </button>
                    )}
                    {c.status === 'in_progress' && (
                      <button onClick={() => setWorkModal(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    )}
                    <button onClick={() => onOpenComplaint(c.id)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50">
                      Details
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Completion modal */}
      {workModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setWorkModal(null)}>
          <Card className="p-6 w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Complete Job</h3>
                <button onClick={() => setWorkModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-slate-600 mb-4">{workModal.title}</p>
              <textarea value={repairNotes} onChange={(e) => setRepairNotes(e.target.value)} rows={3} placeholder="Repair notes…"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm resize-none mb-3" />
              <label className="block">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-600">Upload completion photos</span>
                </div>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
              {completionPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {completionPhotos.map((p, i) => (
                    <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <button onClick={completeJob} className="w-full mt-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                Mark Resolved
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
