import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import { PRIORITY_CONFIG, formatDate, onImageError } from '@/lib/constants';
import {
    ArrowLeft,
    Bell,
    CalendarDays,
    Camera,
    Check,
    CheckCircle2,
    ChevronRight,
    Filter,
    Flag,
    Image as ImageIcon,
    Play,
    RotateCcw,
    Search,
    Tag,
    Wifi,
    Wrench,
    X,
    Zap,
    Droplets,
} from 'lucide-react';

export function TechnicianJobsScreen({ onOpenComplaint, onNavigate }) {
    const { profile } = useAuthStore();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('progress');
    const [search, setSearch] = useState('');
    const [startModal, setStartModal] = useState(null);
    const [workModal, setWorkModal] = useState(null);
    const [completedJob, setCompletedJob] = useState(null);
    const [activeWorkOrderId, setActiveWorkOrderId] = useState(null);
    const [workStartedAt, setWorkStartedAt] = useState(null);
    const [repairNotes, setRepairNotes] = useState('');
    const [beforePhotos, setBeforePhotos] = useState([]);
    const [completionPhotos, setCompletionPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [workError, setWorkError] = useState('');
    const [loadingWorkOrder, setLoadingWorkOrder] = useState(false);

    useEffect(() => {
        if (profile?.id) void load();
    }, [profile?.id]);

    const load = async () => {
        if (!profile?.id) {
            setComplaints([]);
            setLoading(false);
            return;
        }
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
            setComplaints(data || []);
        }
        setLoading(false);
    };

    const openStartWork = (complaint) => {
        setWorkError('');
        setBeforePhotos([]);
        setCompletionPhotos([]);
        setRepairNotes('');
        setStartModal(complaint);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openCompleteWork = async (complaint) => {
        setWorkError('');
        setRepairNotes('');
        setCompletionPhotos([]);
        setBeforePhotos([]);
        setActiveWorkOrderId(null);
        setWorkStartedAt(null);
        setWorkModal(complaint);
        setLoadingWorkOrder(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const { data } = await supabase
            .from('work_orders')
            .select('*')
            .eq('complaint_id', complaint.id)
            .eq('technician_id', profile?.id)
            .order('created_at', { ascending: false })
            .limit(1);
        const workOrder = (data || [])[0];
        if (workOrder) {
            setActiveWorkOrderId(workOrder.id);
            setBeforePhotos(workOrder.before_photo_urls || []);
            setCompletionPhotos(workOrder.completion_photo_urls || []);
            setRepairNotes(workOrder.repair_notes || '');
            setWorkStartedAt(workOrder.start_time || workOrder.created_at || null);
        }
        setLoadingWorkOrder(false);
    };

    const handlePhotoUpload = async (event, kind, replace = false) => {
        const existing = kind === 'before' ? beforePhotos : completionPhotos;
        const files = Array.from(event.target.files || []).slice(0, replace ? 1 : Math.max(0, 5 - existing.length));
        if (!files.length) return;
        setUploading(true);
        setWorkError('');
        try {
            for (const file of files) {
                if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
                if (file.size > 8 * 1024 * 1024) throw new Error('Each photo must be smaller than 8 MB.');
            }
            const urls = await Promise.all(files.map((file) => uploadImage(file)));
            if (kind === 'before') {
                setBeforePhotos((prev) => replace ? urls.slice(0, 1) : [...prev, ...urls].slice(0, 5));
            } else {
                setCompletionPhotos((prev) => replace ? urls.slice(0, 1) : [...prev, ...urls].slice(0, 5));
            }
        } catch (error) {
            setWorkError(error instanceof Error ? error.message : 'Photo upload failed.');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const confirmStartWork = async () => {
        if (!startModal) return;
        if (beforePhotos.length < 1) {
            setWorkError('Before photo is required before starting work.');
            return;
        }
        setUploading(true);
        setWorkError('');
        try {
            const startedAt = new Date().toISOString();
            const updates = { status: 'in_progress', updated_at: startedAt };
            if (!startModal.assigned_at) updates.assigned_at = startedAt;

            const complaintUpdate = await supabase.from('complaints').update(updates).eq('id', startModal.id);
            if (complaintUpdate.error) throw new Error(complaintUpdate.error.message);

            const workOrderResult = await supabase.from('work_orders').insert({
                complaint_id: startModal.id,
                technician_id: profile?.id,
                work_order_no: `WO-${Date.now().toString().slice(-8)}`,
                before_photo_urls: beforePhotos,
                completion_photo_urls: [],
                tools_required: [],
                materials_used: [],
                material_cost: 0,
                start_time: startedAt,
                status: 'in_progress',
                approval_status: 'pending',
                created_by: profile?.id,
            }).select('id').single();
            if (workOrderResult.error) throw new Error(workOrderResult.error.message);

            await supabase.from('complaint_status_history').insert({
                complaint_id: startModal.id,
                old_status: startModal.status,
                new_status: 'in_progress',
                changed_by: profile?.id,
                remarks: 'Work started — before photo captured',
            });

            const inProgressComplaint = { ...startModal, status: 'in_progress', assigned_at: startModal.assigned_at || startedAt };
            setActiveWorkOrderId(workOrderResult.data?.id || null);
            setWorkStartedAt(startedAt);
            setStartModal(null);
            setWorkModal(inProgressComplaint);
            setCompletionPhotos([]);
            setRepairNotes('');
            void load();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            setWorkError(error instanceof Error ? error.message : 'Unable to start work.');
        } finally {
            setUploading(false);
        }
    };

    const completeJob = async () => {
        if (!workModal) return;
        if (completionPhotos.length < 1) {
            setWorkError('After photo is required before marking work as completed.');
            return;
        }
        if (!repairNotes.trim()) {
            setWorkError('Please add a short work completion note.');
            return;
        }

        setUploading(true);
        setWorkError('');
        try {
            const completedAt = new Date().toISOString();
            const complaintUpdate = await supabase.from('complaints').update({
                status: 'waiting_approval',
                updated_at: completedAt,
            }).eq('id', workModal.id);
            if (complaintUpdate.error) throw new Error(complaintUpdate.error.message);

            if (activeWorkOrderId) {
                const result = await supabase.from('work_orders').update({
                    repair_notes: repairNotes.trim(),
                    before_photo_urls: beforePhotos,
                    completion_photo_urls: completionPhotos,
                    completion_time: completedAt,
                    status: 'awaiting_approval',
                    approval_status: 'pending',
                }).eq('id', activeWorkOrderId);
                if (result.error) throw new Error(result.error.message);
            } else {
                const result = await supabase.from('work_orders').insert({
                    complaint_id: workModal.id,
                    technician_id: profile?.id,
                    work_order_no: `WO-${Date.now().toString().slice(-8)}`,
                    repair_notes: repairNotes.trim(),
                    before_photo_urls: beforePhotos,
                    completion_photo_urls: completionPhotos,
                    tools_required: [],
                    materials_used: [],
                    material_cost: 0,
                    start_time: workStartedAt || workModal.assigned_at || completedAt,
                    completion_time: completedAt,
                    status: 'awaiting_approval',
                    approval_status: 'pending',
                    created_by: profile?.id,
                });
                if (result.error) throw new Error(result.error.message);
            }

            await supabase.from('complaint_status_history').insert({
                complaint_id: workModal.id,
                old_status: workModal.status,
                new_status: 'waiting_approval',
                changed_by: profile?.id,
                remarks: repairNotes.trim(),
            });

            const admins = await supabase.from('profiles').select('*').eq('role', 'admin').eq('is_active', true);
            await Promise.all((admins.data || []).map((admin) => supabase.from('notifications').insert({
                user_id: admin.id,
                title: 'Work Approval Required',
                message: `${workModal.title} has been completed by ${profile?.full_name || 'staff'} and is ready for approval.`,
                type: 'approval_pending',
                related_id: workModal.id,
                is_read: false,
            })));

            setCompletedJob({
                complaint: workModal,
                completedAt,
                startedAt: workStartedAt,
                beforePhotos: [...beforePhotos],
                afterPhotos: [...completionPhotos],
                repairNotes: repairNotes.trim(),
            });
            setWorkModal(null);
            setActiveWorkOrderId(null);
            setRepairNotes('');
            setBeforePhotos([]);
            setCompletionPhotos([]);
            void load();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            setWorkError(error instanceof Error ? error.message : 'Unable to complete this job.');
        } finally {
            setUploading(false);
        }
    };

    if (loading && !startModal && !workModal) return <Spinner />;

    if (completedJob) {
        return <StaffWorkCompletedScreen
          data={completedJob}
          staffName={profile?.full_name || 'Staff'}
          onBack={() => {
              setCompletedJob(null);
              setActiveTab('progress');
          }}
        />;
    }

    if (startModal) {
        return <StaffBeforePhotoScreen
          complaint={startModal}
          photos={beforePhotos}
          uploading={uploading}
          error={workError}
          onBack={() => {
              setStartModal(null);
              setBeforePhotos([]);
              setWorkError('');
          }}
          onCapture={(event) => void handlePhotoUpload(event, 'before', true)}
          onGallery={(event) => void handlePhotoUpload(event, 'before', false)}
          onRemove={(index) => setBeforePhotos((value) => value.filter((_, itemIndex) => itemIndex !== index))}
          onStart={() => void confirmStartWork()}
        />;
    }

    if (workModal) {
        return <StaffAfterPhotoScreen
          complaint={workModal}
          beforePhotos={beforePhotos}
          afterPhotos={completionPhotos}
          repairNotes={repairNotes}
          setRepairNotes={setRepairNotes}
          loadingWorkOrder={loadingWorkOrder}
          uploading={uploading}
          error={workError}
          onBack={() => {
              setWorkModal(null);
              setBeforePhotos([]);
              setCompletionPhotos([]);
              setRepairNotes('');
              setWorkError('');
          }}
          onCaptureAfter={(event) => void handlePhotoUpload(event, 'after', true)}
          onGalleryAfter={(event) => void handlePhotoUpload(event, 'after', false)}
          onRemoveAfter={(index) => setCompletionPhotos((value) => value.filter((_, itemIndex) => itemIndex !== index))}
          onComplete={() => void completeJob()}
        />;
    }

    const assigned = complaints.filter((c) => c.status === 'assigned');
    const inProgress = complaints.filter((c) => ['in_progress', 'waiting_approval'].includes(c.status));
    const closed = complaints.filter((c) => ['resolved', 'closed'].includes(c.status));
    const tabList = activeTab === 'assigned' ? assigned : activeTab === 'closed' ? closed : inProgress;
    const list = tabList.filter((complaint) => {
        const haystack = `${complaint.title || ''} ${complaint.complaint_no || ''} ${complaint.location_description || ''} ${complaint.buildings?.name || ''}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
    });

    return (<div className="staff-screen staff-jobs-screen staff-work-reference-screen">
      <div className="staff-page-titlebar staff-work-titlebar">
        <div className="staff-work-title-copy">
          <h1>My Work</h1>
          <span>{complaints.length} assigned jobs</span>
        </div>
        <button type="button" className="staff-plain-icon" aria-label="Filter jobs"><Filter size={22}/></button>
      </div>

      <div className="staff-work-tabs">
        <button type="button" className={activeTab === 'progress' ? 'is-active' : ''} onClick={() => setActiveTab('progress')}>In Progress <b>{inProgress.length}</b></button>
        <button type="button" className={activeTab === 'assigned' ? 'is-active' : ''} onClick={() => setActiveTab('assigned')}>Pending <b>{assigned.length}</b></button>
        <button type="button" className={activeTab === 'closed' ? 'is-active' : ''} onClick={() => setActiveTab('closed')}>Completed <b>{closed.length}</b></button>
      </div>

      <label className="staff-work-search">
        <Search size={19}/>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search complaints..."/>
      </label>

      {workError && <div className="staff-error-card"><strong>Jobs could not be loaded</strong><span>{workError}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

      <div className="staff-work-list">
        {!list.length ? <div className="staff-empty"><Wrench size={28}/><strong>No jobs here</strong><span>Assigned maintenance jobs will appear here.</span></div> : list.map((complaint) => {
            const Icon = iconForComplaint(complaint);
            const priority = PRIORITY_CONFIG[complaint.priority] || PRIORITY_CONFIG.medium;
            const status = statusFor(complaint.status);
            const location = [complaint.buildings?.name, complaint.location_description].filter(Boolean).join(', ') || 'Campus';
            return (<article key={complaint.id} className="staff-work-card">
              <button type="button" className="staff-work-card-main" onClick={() => onOpenComplaint(complaint.id)}>
                <span className="staff-work-card-icon"><Icon size={22}/></span>
                <span className="staff-work-card-copy">
                  <strong>{complaint.title}</strong>
                  <small>{location}</small>
                  <em>#{complaint.complaint_no || complaint.id}</em>
                </span>
                <span className={`staff-status-chip ${status.tone}`}>{status.label}</span>
              </button>
              <div className="staff-work-card-foot">
                <span className={`staff-priority-dot ${complaint.priority || 'medium'}`}><i/>{priority.label}</span>
                <span>Assigned to You</span>
                <time>{complaint.created_at ? formatDate(complaint.created_at) : ''}</time>
              </div>
              <div className="staff-work-card-actions">
                {complaint.status === 'assigned' && <button type="button" onClick={() => openStartWork(complaint)}><Play size={15}/> Start Work</button>}
                {complaint.status === 'in_progress' && <button type="button" onClick={() => void openCompleteWork(complaint)} className="complete"><Camera size={15}/> Before / After</button>}
                {complaint.status === 'waiting_approval' && <span className="staff-awaiting-pill"><CheckCircle2 size={15}/> Waiting for approval</span>}
                <button type="button" className="details" onClick={() => onOpenComplaint(complaint.id)}>Details <ChevronRight size={15}/></button>
              </div>
            </article>);
        })}
      </div>
    </div>);
}

function StaffBeforePhotoScreen({ complaint, photos, uploading, error, onBack, onCapture, onGallery, onRemove, onStart }) {
    const priority = PRIORITY_CONFIG[complaint.priority] || PRIORITY_CONFIG.medium;
    const before = photos[0];
    return (<div className="staff-screen staff-workflow-screen">
      <WorkflowHeader title="Work in Progress" onBack={onBack}/>
      <WorkflowComplaintIntro complaint={complaint}/>

      <div className="staff-workflow-meta-grid">
        <MetaCard icon={Flag} label="Priority" value={priority.label} tone={complaint.priority}/>
        <MetaCard icon={Tag} label="Category" value={complaint.complaint_categories?.name || 'Maintenance'}/>
        <MetaCard icon={CalendarDays} label="Reported On" value={formatDate(complaint.created_at)}/>
      </div>

      <section className="staff-photo-section">
        <div className="staff-photo-section-heading"><h2>Before Photo</h2><span>Required</span></div>
        <PhotoStage url={before} emptyText="Take a clear photo before starting the repair." alt="Before repair"/>
        <div className="staff-photo-actions">
          <label><RotateCcw size={19}/><span>{before ? 'Retake' : 'Take Photo'}</span><input type="file" accept="image/*" capture="environment" onChange={onCapture}/></label>
          <label><ImageIcon size={19}/><span>Gallery</span><input type="file" accept="image/*" multiple onChange={onGallery}/></label>
        </div>
        {photos.length > 1 && <div className="staff-photo-thumbs">{photos.slice(1).map((url, index) => <div key={`${url}-${index}`}><img src={url} alt={`Before repair ${index + 2}`} onError={onImageError}/><button type="button" onClick={() => onRemove(index + 1)}><X size={13}/></button></div>)}</div>}
      </section>

      {error && <p className="staff-workflow-error">{error}</p>}
      <button type="button" disabled={uploading || photos.length < 1} onClick={onStart} className="staff-workflow-primary">{uploading ? 'Please wait…' : 'Start Work'}</button>
    </div>);
}

function StaffAfterPhotoScreen({ complaint, beforePhotos, afterPhotos, repairNotes, setRepairNotes, loadingWorkOrder, uploading, error, onBack, onCaptureAfter, onGalleryAfter, onRemoveAfter, onComplete }) {
    const before = beforePhotos[0];
    const after = afterPhotos[0];
    return (<div className="staff-screen staff-workflow-screen">
      <WorkflowHeader title="Work in Progress" onBack={onBack}/>
      <WorkflowComplaintIntro complaint={complaint}/>

      <section className="staff-photo-section compact">
        <div className="staff-photo-section-heading"><h2>Before Photo</h2><span className="done"><Check size={13}/> Captured</span></div>
        {loadingWorkOrder ? <div className="staff-photo-loading">Loading before photo…</div> : <PhotoStage url={before} emptyText="No before photo found." alt="Before repair"/>}
      </section>

      <div className="staff-photo-flow-arrow">↓</div>

      <section className="staff-photo-section">
        <div className="staff-photo-section-heading"><h2>After Photo</h2><span>Required</span></div>
        <PhotoStage url={after} emptyText="Take a clear photo after finishing the repair." alt="After repair"/>
        <div className="staff-photo-actions">
          <label><RotateCcw size={19}/><span>{after ? 'Retake' : 'Take Photo'}</span><input type="file" accept="image/*" capture="environment" onChange={onCaptureAfter}/></label>
          <label><ImageIcon size={19}/><span>Gallery</span><input type="file" accept="image/*" multiple onChange={onGalleryAfter}/></label>
        </div>
        {afterPhotos.length > 1 && <div className="staff-photo-thumbs">{afterPhotos.slice(1).map((url, index) => <div key={`${url}-${index}`}><img src={url} alt={`After repair ${index + 2}`} onError={onImageError}/><button type="button" onClick={() => onRemoveAfter(index + 1)}><X size={13}/></button></div>)}</div>}
      </section>

      <label className="staff-work-note">
        <span>Work Done</span>
        <textarea value={repairNotes} onChange={(event) => setRepairNotes(event.target.value.slice(0, 600))} maxLength={600} rows={3} placeholder="Example: Fixed the leaking pipe and checked the complete line."/>
      </label>

      {error && <p className="staff-workflow-error">{error}</p>}
      <button type="button" disabled={uploading || afterPhotos.length < 1 || !repairNotes.trim()} onClick={onComplete} className="staff-workflow-primary complete">{uploading ? 'Submitting…' : 'Mark as Completed'}</button>
    </div>);
}

function StaffWorkCompletedScreen({ data, staffName, onBack }) {
    const complaint = data.complaint;
    const started = data.startedAt ? new Date(data.startedAt) : null;
    const completed = new Date(data.completedAt);
    const elapsedMinutes = started ? Math.max(1, Math.round((completed.getTime() - started.getTime()) / 60000)) : null;
    const elapsed = elapsedMinutes == null ? '—' : elapsedMinutes >= 60 ? `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m` : `${elapsedMinutes}m`;
    return (<div className="staff-screen staff-workflow-screen staff-completed-screen">
      <WorkflowHeader title="Work Completed" onBack={onBack}/>
      <div className="staff-completed-hero">
        <span className="staff-completed-check"><CheckCircle2 size={66}/></span>
        <h2>Great Job!</h2>
        <p>This work has been submitted for admin approval.</p>
      </div>

      <section className="staff-completed-summary">
        <SummaryRow label="Complaint ID" value={`#${complaint.complaint_no || complaint.id}`}/>
        <SummaryRow label="Category" value={complaint.complaint_categories?.name || 'Maintenance'}/>
        <SummaryRow label="Completed By" value={staffName}/>
        <SummaryRow label="Completed On" value={formatDate(data.completedAt)}/>
        <SummaryRow label="Time Taken" value={elapsed}/>
      </section>

      <section className="staff-completed-note"><strong>Work Done</strong><p>{data.repairNotes}</p></section>

      {(data.beforePhotos[0] || data.afterPhotos[0]) && <section className="staff-completed-photos">
        <h3>Before / After</h3>
        <div>{data.beforePhotos[0] && <figure><img src={data.beforePhotos[0]} alt="Before work" onError={onImageError}/><figcaption>Before</figcaption></figure>}{data.afterPhotos[0] && <figure><img src={data.afterPhotos[0]} alt="After work" onError={onImageError}/><figcaption>After</figcaption></figure>}</div>
      </section>}

      <button type="button" onClick={onBack} className="staff-workflow-primary">Back to My Work</button>
    </div>);
}

function WorkflowHeader({ title, onBack }) {
    return <header className="staff-workflow-header"><button type="button" onClick={onBack} aria-label="Back"><ArrowLeft size={25}/></button><h1>{title}</h1><button type="button" className="staff-workflow-bell" aria-label="Notifications"><Bell size={22}/></button></header>;
}

function WorkflowComplaintIntro({ complaint }) {
    const location = [complaint.buildings?.name, complaint.location_description].filter(Boolean).join(', ') || 'Campus';
    return <section className="staff-workflow-intro"><div><h2>{complaint.title}</h2><p>{location}</p><span>#{complaint.complaint_no || complaint.id}</span></div><span className="staff-status-chip progress">In Progress</span></section>;
}

function MetaCard({ icon: Icon, label, value, tone = '' }) {
    return <div className={`staff-workflow-meta ${tone}`}><Icon size={17}/><small>{label}</small><strong>{value}</strong></div>;
}

function PhotoStage({ url, emptyText, alt }) {
    if (!url) return <div className="staff-photo-stage is-empty"><Camera size={34}/><span>{emptyText}</span></div>;
    return <a href={url} target="_blank" rel="noreferrer" className="staff-photo-stage"><img src={url} alt={alt} onError={onImageError}/><span className="staff-photo-expand">↗</span></a>;
}

function SummaryRow({ label, value }) {
    return <div className="staff-summary-row"><span>{label}</span><strong>{value}</strong></div>;
}

function iconForComplaint(complaint) {
    const text = `${complaint?.title || ''} ${complaint?.complaint_categories?.name || ''}`.toLowerCase();
    if (text.includes('wifi') || text.includes('wi-fi') || text.includes('network')) return Wifi;
    if (text.includes('water') || text.includes('faucet') || text.includes('leak')) return Droplets;
    if (text.includes('electrical') || text.includes('light') || text.includes('fan')) return Zap;
    return Wrench;
}

function statusFor(status) {
    if (status === 'assigned') return { label: 'Pending', tone: 'assigned' };
    if (status === 'in_progress') return { label: 'In Progress', tone: 'progress' };
    if (status === 'waiting_approval') return { label: 'Under Review', tone: 'review' };
    if (['resolved', 'closed'].includes(status)) return { label: 'Closed', tone: 'closed' };
    return { label: 'Open', tone: 'open' };
}
