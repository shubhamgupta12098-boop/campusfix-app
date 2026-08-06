import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate, onImageError } from '@/lib/constants';
import type { Complaint, ComplaintStatus } from '@/lib/supabase';
import { Wrench, Clock, MapPin, CheckCircle2, Play, Pause, Camera, X, AlertCircle, Image, FileText, Tag } from 'lucide-react';

export function TechnicianJobsScreen({ onOpenComplaint }: { onOpenComplaint: (id: string) => void }) {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [startModal, setStartModal] = useState<Complaint | null>(null);
  const [workModal, setWorkModal] = useState<Complaint | null>(null);
  const [activeWorkOrderId, setActiveWorkOrderId] = useState<string | null>(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [workError, setWorkError] = useState('');
  const [loadingWorkOrder, setLoadingWorkOrder] = useState(false);

  useEffect(() => {
    if (profile?.id) void load();
  }, [profile?.id]);

  const load = async () => {
    if (!profile?.id) { setComplaints([]); setLoading(false); return; }
    setLoading(true);
    setWorkError('');
    const { data, error } = await supabase
      .from('complaints')
      .select('*, complaint_categories(*), buildings(*)')
      .eq('assigned_to', profile.id)
      .order('created_at', { ascending: false });
    if (error) {
      setWorkError(error.message);
      setComplaints([]);
    } else {
      setComplaints((data || []) as unknown as Complaint[]);
    }
    setLoading(false);
  };

  // Open the "Start Work" modal — shows full complaint detail + requires a
  // before-repair photo before the job can move to in_progress.
  const openStartWork = (c: Complaint) => {
    setWorkError('');
    setBeforePhotos([]);
    setStartModal(c);
  };

  // Open the "Complete Work" modal — loads the before photo already captured
  // at start time (read-only) and only asks for the after-repair photo.
  const openCompleteWork = async (c: Complaint) => {
    setWorkError('');
    setRepairNotes('');
    setCompletionPhotos([]);
    setBeforePhotos([]);
    setActiveWorkOrderId(null);
    setWorkModal(c);
    setLoadingWorkOrder(true);
    const { data } = await supabase
      .from('work_orders')
      .select('*')
      .eq('complaint_id', c.id)
      .eq('technician_id', profile?.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const wo = ((data || []) as any[])[0];
    if (wo) {
      setActiveWorkOrderId(wo.id);
      setBeforePhotos(wo.before_photo_urls || []);
    }
    setLoadingWorkOrder(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'before' | 'after') => {
    const existing = kind === 'before' ? beforePhotos : completionPhotos;
    const files = Array.from(e.target.files || []).slice(0, 5 - existing.length);
    if (!files.length) return;
    setUploading(true);
    setWorkError('');
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
        if (file.size > 8 * 1024 * 1024) throw new Error('Each photo must be smaller than 8 MB.');
      }
      const jobId = (kind === 'before' ? startModal?.id : workModal?.id) || 'job';
      const urls = await Promise.all(files.map((file) => uploadImage(file)));
      if (kind === 'before') setBeforePhotos((prev) => [...prev, ...urls].slice(0, 5));
      else setCompletionPhotos((prev) => [...prev, ...urls].slice(0, 5));
    } catch (error) {
      setWorkError(error instanceof Error ? error.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Confirm Start Work: saves the before-repair photo, opens a work order and
  // flips the complaint to in_progress.
  const confirmStartWork = async () => {
    if (!startModal) return;
    if (beforePhotos.length < 1) { setWorkError('Please add at least one before-repair photo showing the issue.'); return; }
    setUploading(true);
    try {
      const updates: any = { status: 'in_progress', updated_at: new Date().toISOString() };
      if (!startModal.assigned_at) updates.assigned_at = new Date().toISOString();
      await supabase.from('complaints').update(updates).eq('id', startModal.id);

      await supabase.from('work_orders').insert({
        complaint_id: startModal.id,
        technician_id: profile?.id,
        work_order_no: `WO-${Date.now().toString().slice(-8)}`,
        before_photo_urls: beforePhotos,
        completion_photo_urls: [],
        tools_required: [],
        materials_used: [],
        material_cost: 0,
        start_time: new Date().toISOString(),
        status: 'in_progress',
        approval_status: 'pending',
        created_by: profile?.id,
      });

      await supabase.from('complaint_status_history').insert({
        complaint_id: startModal.id,
        old_status: startModal.status,
        new_status: 'in_progress',
        changed_by: profile?.id,
        remarks: 'Work started — before-repair photo captured',
      });

      await supabase.from('notifications').insert({
        user_id: startModal.user_id,
        title: 'Work Started',
        message: `${startModal.title} — Staff has started work on your complaint.`,
        type: 'status_changed',
        related_id: startModal.id,
      });

      setStartModal(null);
      setBeforePhotos([]);
      void load();
    } finally {
      setUploading(false);
    }
  };

  const completeJob = async () => {
    if (!workModal) return;
    if (completionPhotos.length < 1) { setWorkError('At least one after-repair photo is required.'); return; }
    if (!repairNotes.trim()) { setWorkError('Completion remarks are required.'); return; }
    await supabase.from('complaints').update({
      status: 'waiting_approval',
      updated_at: new Date().toISOString(),
    }).eq('id', workModal.id);

    if (activeWorkOrderId) {
      // Update the same work order that was opened at "Start Work" time so
      // the before photo captured then stays attached to this job.
      await supabase.from('work_orders').update({
        repair_notes: repairNotes.trim(),
        completion_photo_urls: completionPhotos,
        completion_time: new Date().toISOString(),
        status: 'awaiting_approval',
        approval_status: 'pending',
      }).eq('id', activeWorkOrderId);
    } else {
      // Fallback for older jobs that don't have a work order yet.
      await supabase.from('work_orders').insert({
        complaint_id: workModal.id,
        technician_id: profile?.id,
        work_order_no: `WO-${Date.now().toString().slice(-8)}`,
        repair_notes: repairNotes.trim(),
        before_photo_urls: beforePhotos,
        completion_photo_urls: completionPhotos,
        tools_required: [],
        materials_used: [],
        material_cost: 0,
        start_time: workModal.assigned_at || new Date().toISOString(),
        completion_time: new Date().toISOString(),
        status: 'awaiting_approval',
        approval_status: 'pending',
        created_by: profile?.id,
      });
    }

    await supabase.from('complaint_status_history').insert({
      complaint_id: workModal.id,
      old_status: workModal.status,
      new_status: 'waiting_approval',
      changed_by: profile?.id,
      remarks: repairNotes || 'Job completed',
    });

    await supabase.from('notifications').insert({
      user_id: workModal.user_id,
      title: 'Work Submitted for Approval',
      message: `${workModal.title} — Staff has submitted completion evidence for admin verification.`,
      type: 'approval_pending',
      related_id: workModal.id,
    });

    const admins = await supabase.from('profiles').select('*').eq('role', 'admin').eq('is_active', true);
    await Promise.all(((admins.data || []) as any[]).map((admin) => supabase.from('notifications').insert({
      user_id: admin.id,
      title: 'Work Approval Required',
      message: `${workModal.title} has been submitted by ${profile?.full_name || 'staff'}.`,
      type: 'approval_pending',
      related_id: workModal.id,
    })));

    setWorkModal(null);
    setActiveWorkOrderId(null);
    setRepairNotes('');
    setBeforePhotos([]);
    setCompletionPhotos([]);
    void load();
  };

  if (loading) return <Spinner />;

  const active = complaints.filter((c) => ['assigned', 'in_progress', 'waiting_approval'].includes(c.status));
  const completed = complaints.filter((c) => ['resolved', 'closed'].includes(c.status));
  const list = activeTab === 'active' ? active : completed;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="My Jobs" subtitle={`${active.length} active · ${completed.length} completed`} />

      {workError && !workModal && (
        <Card className="p-4 mb-4 border border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">Assigned jobs could not be loaded</p>
          <p className="text-xs text-red-600 mt-1 break-words">{workError}</p>
          <button onClick={() => void load()} className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold">Retry</button>
        </Card>
      )}

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
            const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.assigned;
            const pc = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.medium;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  {c.photo_urls && c.photo_urls.length > 0 ? (
                    <button onClick={() => onOpenComplaint(c.id)} className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200">
                      <img src={c.photo_urls[0]} alt={c.title} className="w-full h-full object-cover" onError={onImageError} />
                    </button>
                  ) : (
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.complaint_categories?.color || '#3B82F6') + '15' }}>
                      <Wrench className="w-5 h-5" style={{ color: c.complaint_categories?.color || '#3B82F6' }} />
                    </div>
                  )}
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
                      {c.photo_urls && c.photo_urls.length > 0 && (
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Image className="w-3 h-3" />{c.photo_urls.length} student photo{c.photo_urls.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  {activeTab === 'active' && c.status === 'assigned' && (
                    <button onClick={() => openStartWork(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">
                      <Play className="w-3.5 h-3.5" /> Start Work
                    </button>
                  )}
                  {activeTab === 'active' && c.status === 'in_progress' && (
                    <button onClick={() => void openCompleteWork(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complete Work
                    </button>
                  )}
                  <button onClick={() => onOpenComplaint(c.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 hover:border-slate-400 transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Details
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Start Work modal: full complaint detail + required before-repair photo */}
      {startModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setStartModal(null); setWorkError(''); }}>
          <Card className="p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Start Work</h3>
                <button onClick={() => { setStartModal(null); setWorkError(''); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4 space-y-2">
                <p className="text-sm font-semibold text-slate-900">{startModal.title}</p>
                <p className="text-xs text-slate-500">{startModal.complaint_no}</p>
                <div className="flex items-start gap-1.5 text-xs text-slate-700">
                  <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span>{startModal.description || 'No additional description provided.'}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-600 pt-1">
                  {startModal.complaint_categories?.name && (
                    <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5 text-slate-400" />{startModal.complaint_categories.name}</span>
                  )}
                  {(startModal.buildings?.name || startModal.location_description) && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{startModal.buildings?.name}{startModal.location_description ? ` · ${startModal.location_description}` : ''}{startModal.floor ? ` · Floor ${startModal.floor}` : ''}</span>
                  )}
                  {startModal.expected_completion && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />Due {formatDate(startModal.expected_completion)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Badge className={`${PRIORITY_CONFIG[startModal.priority]?.bg} ${PRIORITY_CONFIG[startModal.priority]?.color} border ${PRIORITY_CONFIG[startModal.priority]?.border}`}>{PRIORITY_CONFIG[startModal.priority]?.label}</Badge>
                </div>
              </div>

              {startModal.photo_urls && startModal.photo_urls.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Student's complaint photo — what needs to be fixed</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {startModal.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                        <img src={url} alt={`Complaint photo ${i + 1}`} className="w-full h-full object-cover" onError={onImageError} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Before repair photo <span className="text-red-600">*</span></p>
                <label className="block">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Camera className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-600">Take/upload before photo (required)</span>
                  </div>
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void handlePhotoUpload(e, 'before')} />
                </label>
                {beforePhotos.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{beforePhotos.map((url, i) => <div key={url} className="relative"><img src={url} alt={`Before repair ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" onError={onImageError}/><button type="button" onClick={() => setBeforePhotos(v => v.filter((_, index) => index !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"><X className="w-3 h-3"/></button></div>)}</div>}
              </div>

              {workError && <p className="text-xs text-red-600 mt-3">{workError}</p>}
              {uploading && <p className="text-xs text-blue-600 mt-3">Please wait…</p>}
              <button disabled={uploading} onClick={confirmStartWork} className="w-full mt-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                Confirm &amp; Start Work
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Complete Work modal: before photo shown read-only, after photo required */}
      {workModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setWorkModal(null); setWorkError(''); }}>
          <Card className="p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Complete Job</h3>
                <button onClick={() => { setWorkModal(null); setWorkError(''); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-slate-600 mb-1">{workModal.title}</p>
              {workModal.photo_urls && workModal.photo_urls.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Student's complaint photo</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {workModal.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                        <img src={url} alt={`Complaint photo ${i + 1}`} className="w-full h-full object-cover" onError={onImageError} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <textarea value={repairNotes} onChange={(e) => setRepairNotes(e.target.value)} rows={3} placeholder="Repair notes…"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm resize-none mb-3" />
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Before repair photo</p>
                  {loadingWorkOrder ? (
                    <p className="text-xs text-slate-400">Loading…</p>
                  ) : beforePhotos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">{beforePhotos.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Before repair ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" onError={onImageError}/></a>)}</div>
                  ) : (
                    <p className="text-xs text-slate-400">No before photo was captured for this job.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">After repair photo <span className="text-red-600">*</span></p>
                  <label className="block">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-emerald-300 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-colors">
                      <Camera className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm text-slate-600">Upload after photo (required)</span>
                    </div>
                    <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void handlePhotoUpload(e, 'after')} />
                  </label>
                  {completionPhotos.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{completionPhotos.map((url, i) => <div key={url} className="relative"><img src={url} alt={`After repair ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" onError={onImageError}/><button type="button" onClick={() => setCompletionPhotos(v => v.filter((_, index) => index !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"><X className="w-3 h-3"/></button></div>)}</div>}
                </div>
              </div>
              {workError && <p className="text-xs text-red-600 mt-3">{workError}</p>}
              {uploading && <p className="text-xs text-blue-600 mt-3">Uploading photo…</p>}
              <button disabled={uploading} onClick={completeJob} className="w-full mt-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                Submit for Admin Approval
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
