import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, STATUS_FLOW, PRIORITY_CONFIG, formatDate, onImageError } from '@/lib/constants';
import { ArrowLeft, MapPin, User, Wrench, Clock, Star, CheckCircle2, AlertCircle, LockKeyhole, X, Video, Pencil, ShieldCheck, Ban, Send, Bell, CalendarDays, Check } from 'lucide-react';
const EDIT_CATEGORIES = [
    { id: 'electrical', name: 'Electrical' },
    { id: 'plumbing', name: 'Plumbing' },
    { id: 'furniture', name: 'Furniture' },
    { id: 'it-network', name: 'IT / Network' },
    { id: 'cleanliness', name: 'Cleanliness' },
    { id: 'other', name: 'Other' },
];

export function ComplaintDetailScreen({ complaintId, onBack, onNavigate, unreadNotifications = 0 }) {
    const { profile } = useAuthStore();
    const [complaint, setComplaint] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [workOrder, setWorkOrder] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [loadError, setLoadError] = useState('');
    const [closing, setClosing] = useState(false);
    const [closeMessage, setCloseMessage] = useState('');
    const [editingComplaint, setEditingComplaint] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('electrical');
    const [editPriority, setEditPriority] = useState('medium');
    const [editLocation, setEditLocation] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [editMessage, setEditMessage] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const [selectedTech, setSelectedTech] = useState('');
    const [reviewing, setReviewing] = useState(false);
    const [assigningStaff, setAssigningStaff] = useState(false);
    const [adminMessage, setAdminMessage] = useState('');
    const role = profile?.role ?? 'student';
    const canFeedback = role === 'student' && (complaint?.status === 'resolved' || complaint?.status === 'closed') && complaint?.user_id === profile?.id && !complaint?.feedback_rating;
    const canEditComplaint = role === 'student' && complaint?.user_id === profile?.id && complaint?.status === 'submitted' && !complaint?.admin_viewed_at;
    useEffect(() => {
        setFeedbackOpen(false);
        setRating(0);
        setHoverRating(0);
        setComment('');
        setEditingComplaint(false);
        setEditMessage('');
        setAdminMessage('');
        void load();
    }, [complaintId]);
    const load = async () => {
        setLoading(true);
        setLoadError('');
        const { data, error } = await supabase
            .from('complaints')
            .select('*, complaint_categories(*), buildings(*), profiles!complaints_user_id_fkey(*), profiles!complaints_assigned_to_fkey(*)')
            .eq('id', complaintId)
            .maybeSingle();
        if (error) {
            setComplaint(null);
            setLoadError(error.message);
            setLoading(false);
            return;
        }
        let loadedComplaint = data;
        if (role === 'admin' && data?.status === 'submitted' && !data?.admin_viewed_at && profile?.id) {
            const viewedAt = new Date().toISOString();
            await supabase.from('complaints').update({
                admin_viewed_at: viewedAt,
                admin_viewed_by: profile.id,
                admin_review_status: 'pending',
            }).eq('id', complaintId);
            loadedComplaint = { ...data, admin_viewed_at: viewedAt, admin_viewed_by: profile.id, admin_review_status: 'pending' };
        }
        const shouldShowRatingOnce = role === 'student'
            && (data?.status === 'resolved' || data?.status === 'closed')
            && data?.user_id === profile?.id
            && !data?.feedback_rating
            && !data?.rating_prompt_shown_at;
        if (shouldShowRatingOnce) {
            const shownAt = new Date().toISOString();
            await supabase.from('complaints').update({ rating_prompt_shown_at: shownAt }).eq('id', complaintId);
            loadedComplaint = { ...data, rating_prompt_shown_at: shownAt };
            // Give the student a moment to see the completed complaint detail,
            // then show the rating prompt. It is automatically shown only once.
            window.setTimeout(() => setFeedbackOpen(true), 500);
        }
        setComplaint(loadedComplaint);
        const { data: histData } = await supabase
            .from('complaint_status_history')
            .select('*, profiles!changed_by(full_name)')
            .eq('complaint_id', complaintId)
            .order('created_at', { ascending: true });
        const hist = (histData || []).map((h) => ({
            id: h.id,
            old_status: h.old_status,
            new_status: h.new_status,
            remarks: h.remarks,
            created_at: h.created_at,
            changed_by_name: h.profiles?.full_name || 'System',
        }));
        setHistory(hist);
        const { data: workOrders } = await supabase
            .from('work_orders')
            .select('*')
            .eq('complaint_id', complaintId)
            .order('created_at', { ascending: false });
        setWorkOrder((workOrders || [])[0] || null);
        if (role === 'admin') {
            const { data: staffData } = await supabase.from('profiles').select('*, technicians(*)').eq('role', 'staff').eq('is_active', true);
            setTechnicians(staffData || []);
            setSelectedTech(loadedComplaint?.assigned_to || '');
        }
        else {
            setTechnicians([]);
            setSelectedTech('');
        }
        setLoading(false);
    };
    const openEditComplaint = () => {
        if (!canEditComplaint || !complaint)
            return;
        setEditTitle(complaint.title || '');
        setEditDescription(complaint.description || '');
        setEditCategoryId(complaint.category_id || 'electrical');
        setEditPriority(complaint.priority || 'medium');
        setEditLocation(complaint.location_description || '');
        setEditMessage('');
        setEditingComplaint(true);
    };
    const saveComplaintEdit = async () => {
        if (!complaint || !profile?.id || savingEdit)
            return;
        if (!editTitle.trim() || !editDescription.trim() || !editLocation.trim()) {
            setEditMessage('Title, description and location are required.');
            return;
        }
        if ((complaint.photo_urls || []).length < 1) {
            setEditMessage('Photo * is required for every complaint. Video is optional.');
            return;
        }
        setSavingEdit(true);
        setEditMessage('');
        const latest = await supabase.from('complaints').select('*').eq('id', complaint.id).maybeSingle();
        if (latest.error || !latest.data) {
            setSavingEdit(false);
            setEditMessage(latest.error?.message || 'Complaint could not be checked.');
            return;
        }
        if (latest.data.admin_viewed_at || latest.data.status !== 'submitted') {
            setSavingEdit(false);
            setEditingComplaint(false);
            setEditMessage('Editing is locked because an admin has already viewed this complaint.');
            await load();
            return;
        }
        const category = EDIT_CATEGORIES.find((item) => item.id === editCategoryId) || EDIT_CATEGORIES[0];
        const editedAt = new Date().toISOString();
        const result = await supabase.from('complaints').update({
            title: editTitle.trim(),
            description: editDescription.trim(),
            category_id: category.id,
            category_name: category.name,
            priority: editPriority,
            location_description: editLocation.trim(),
            student_last_edited_at: editedAt,
        }).eq('id', complaint.id);
        if (!result.error) {
            await supabase.from('complaint_status_history').insert({
                complaint_id: complaint.id,
                old_status: 'submitted',
                new_status: 'submitted',
                changed_by: profile.id,
                remarks: 'Complaint details edited by student before admin review.',
            });
        }
        setSavingEdit(false);
        if (result.error) {
            setEditMessage(result.error.message || 'Complaint could not be updated.');
            return;
        }
        setEditingComplaint(false);
        await load();
    };
    const reviewComplaint = async (isGenuine) => {
        if (role !== 'admin' || !complaint || complaint.status !== 'submitted' || !profile?.id || reviewing)
            return;
        setReviewing(true);
        setAdminMessage('');
        const now = new Date().toISOString();
        const nextStatus = isGenuine ? 'verified' : 'rejected';
        const result = await supabase.from('complaints').update({
            status: nextStatus,
            admin_review_status: isGenuine ? 'approved' : 'rejected',
            admin_reviewed_at: now,
            admin_reviewed_by: profile.id,
            ...(isGenuine ? { verified_at: now } : { rejected_at: now, rejection_reason: 'Admin marked this complaint as not genuine.' }),
        }).eq('id', complaint.id);
        if (!result.error) {
            await supabase.from('complaint_status_history').insert({
                complaint_id: complaint.id,
                old_status: 'submitted',
                new_status: nextStatus,
                changed_by: profile.id,
                remarks: isGenuine ? 'Admin reviewed the complaint and confirmed it is genuine.' : 'Admin reviewed the complaint and marked it as not genuine.',
            });
        }
        setReviewing(false);
        if (result.error) {
            setAdminMessage(result.error.message || 'Admin review could not be saved.');
            return;
        }
        setAdminMessage(isGenuine ? 'Complaint verified. You can now assign staff.' : 'Complaint rejected. No staff was notified.');
        await load();
    };
    const assignReviewedComplaint = async () => {
        if (role !== 'admin' || !complaint || !selectedTech || assigningStaff || !['verified', 'assigned'].includes(complaint.status))
            return;
        setAssigningStaff(true);
        setAdminMessage('');
        const selected = technicians.find((item) => item.id === selectedTech);
        const now = new Date().toISOString();
        const result = await supabase.from('complaints').update({
            status: 'assigned',
            assigned_to: selectedTech,
            assigned_at: now,
        }).eq('id', complaint.id);
        if (!result.error) {
            await supabase.from('complaint_status_history').insert({
                complaint_id: complaint.id,
                old_status: complaint.status,
                new_status: 'assigned',
                changed_by: profile.id,
                remarks: `Assigned to ${selected?.full_name || 'staff'} after admin verification.`,
            });
            await supabase.from('notifications').insert({
                user_id: selectedTech,
                title: 'New Job Assigned',
                message: `${complaint.complaint_no}: ${complaint.title}`,
                type: 'assigned',
                related_id: complaint.id,
                is_read: false,
            });
        }
        setAssigningStaff(false);
        if (result.error) {
            setAdminMessage(result.error.message || 'Staff could not be assigned.');
            return;
        }
        setAdminMessage(`Assigned to ${selected?.full_name || 'staff'}. Staff notification has now been sent.`);
        await load();
    };
    const canClose = !!complaint && complaint.status !== 'closed' && ((role === 'admin' && ['waiting_approval', 'resolved'].includes(complaint.status)) ||
        (role === 'student' && complaint.status === 'resolved' && complaint.user_id === profile?.id));
    const closeComplaint = async () => {
        if (!complaint || !profile?.id || !canClose)
            return;
        if (!window.confirm('Are you sure you want to permanently close this complaint?'))
            return;
        setClosing(true);
        setCloseMessage('');
        const now = new Date().toISOString();
        const { error } = await supabase.from('complaints').update({
            status: 'closed',
            closed_at: now,
            updated_at: now,
        }).eq('id', complaint.id);
        if (!error) {
            await supabase.from('complaint_status_history').insert({
                complaint_id: complaint.id,
                old_status: complaint.status,
                new_status: 'closed',
                changed_by: profile.id,
                changed_by_name: profile.full_name,
                remarks: role === 'admin' ? 'Complaint closed by administrator.' : 'Complaint closed by student.',
            });
        }
        setClosing(false);
        if (error)
            setCloseMessage(error.message || 'Could not close the complaint.');
        else {
            setCloseMessage('Complaint successfully closed.');
            await load();
        }
    };
    const submitFeedback = async () => {
        if (rating < 1 || rating > 5) {
            setFeedbackMessage('Please select a rating from 1 to 5 stars.');
            return;
        }
        if (!profile?.id || complaint?.user_id !== profile.id) {
            setFeedbackMessage('This complaint cannot be rated from the current account.');
            return;
        }
        setSubmittingFeedback(true);
        setFeedbackMessage('');
        const submittedAt = new Date().toISOString();
        const { data: updateResult, error } = await supabase
            .from('complaints')
            .update({
            feedback_rating: Number(rating),
            feedback_comment: comment.trim(),
            feedback_submitted_at: submittedAt,
            feedback_by: profile.id,
        })
            .eq('id', complaintId);
        setSubmittingFeedback(false);
        if (error || (typeof updateResult?.modified === 'number' && updateResult.modified < 1)) {
            setFeedbackMessage(error?.message || 'Could not save the rating. Please try again.');
            return;
        }
        setComplaint((current) => current ? { ...current, feedback_rating: Number(rating), feedback_comment: comment.trim(), feedback_submitted_at: submittedAt, feedback_by: profile.id } : current);
        setFeedbackOpen(false);
        setFeedbackMessage('Thank you! Your rating and feedback have been saved.');
        await load();
    };
    if (loading)
        return <Spinner />;
    if (!complaint) {
        return (<div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 font-medium"><ArrowLeft className="w-4 h-4"/>Back</button>
        <Card className="p-6 border border-red-200 bg-red-50">
          <EmptyState icon={AlertCircle} title="Complaint detail could not be loaded" description={loadError || 'Complaint not found or it has been removed.'}/>
          <button onClick={() => void load()} className="mx-auto mt-3 block px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold">Retry</button>
        </Card>
      </div>);
    }
    const displayStatus = complaint.status === 'resolved' ? 'closed' : complaint.status;
    const sc = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.submitted;
    const pc = PRIORITY_CONFIG[complaint.priority] || PRIORITY_CONFIG.medium;
    const currentStepIndex = displayStatus === 'rejected' ? 0 : STATUS_FLOW.indexOf(displayStatus);
    if (role === 'student') {
        return (<StudentComplaintDetailView
          complaint={complaint}
          history={history}
          workOrder={workOrder}
          onBack={onBack}
          onNavigate={onNavigate}
          unreadNotifications={unreadNotifications}
          canEditComplaint={canEditComplaint}
          openEditComplaint={openEditComplaint}
          editingComplaint={editingComplaint}
          setEditingComplaint={setEditingComplaint}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editDescription={editDescription}
          setEditDescription={setEditDescription}
          editCategoryId={editCategoryId}
          setEditCategoryId={setEditCategoryId}
          editPriority={editPriority}
          setEditPriority={setEditPriority}
          editLocation={editLocation}
          setEditLocation={setEditLocation}
          savingEdit={savingEdit}
          editMessage={editMessage}
          saveComplaintEdit={saveComplaintEdit}
          canFeedback={canFeedback}
          feedbackOpen={feedbackOpen}
          setFeedbackOpen={setFeedbackOpen}
          rating={rating}
          setRating={setRating}
          hoverRating={hoverRating}
          setHoverRating={setHoverRating}
          comment={comment}
          setComment={setComment}
          submittingFeedback={submittingFeedback}
          submitFeedback={submitFeedback}
          feedbackMessage={feedbackMessage}
        />);
    }
    return (<div className="max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 font-medium">
        <ArrowLeft className="w-4 h-4"/>
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (complaint.complaint_categories?.color || '#3B82F6') + '15' }}>
            <Wrench className="w-6 h-6" style={{ color: complaint.complaint_categories?.color || '#3B82F6' }}/>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{complaint.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{complaint.complaint_no} · {complaint.complaint_categories?.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className={`${sc.bg} ${sc.color} text-sm`}>
            <span className={`w-2 h-2 rounded-full ${sc.dot}`}/>
            {sc.label}
          </Badge>
          {canEditComplaint && <button type="button" onClick={openEditComplaint} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Pencil className="w-3.5 h-3.5"/>Edit Complaint</button>}
          {role === 'student' && complaint.user_id === profile?.id && complaint.status === 'submitted' && complaint.admin_viewed_at && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><LockKeyhole className="w-3.5 h-3.5"/>Editing locked after admin view</span>}
        </div>
      </div>

      {/* Status tracker */}
      <Card className="p-5 mb-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Status Timeline</h3>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STATUS_FLOW.map((status, idx) => {
            const cfg = STATUS_CONFIG[status];
            const isDone = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (<div key={status} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isDone ? `${cfg.dot} text-white` : 'bg-slate-100 text-slate-400'} ${isCurrent ? 'ring-4 ring-offset-1' : ''}`} style={isCurrent ? { boxShadow: `0 0 0 4px ${complaint.complaint_categories?.color || '#3B82F6'}30` } : {}}>
                    {isDone && idx < currentStepIndex ? <CheckCircle2 className="w-4 h-4"/> : idx + 1}
                  </div>
                  <span className={`text-[10px] font-semibold ${isDone ? 'text-slate-700' : 'text-slate-400'}`}>{cfg.label}</span>
                </div>
                {idx < STATUS_FLOW.length - 1 && (<div className={`h-0.5 w-8 sm:w-12 mx-1 ${idx < currentStepIndex ? cfg.dot : 'bg-slate-200'}`}/>)}
              </div>);
        })}
        </div>
      </Card>

      {role === 'admin' && (<Card className={`p-5 mb-5 border ${complaint.status === 'rejected' ? 'border-red-200 bg-red-50' : complaint.status === 'verified' || complaint.status === 'assigned' ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-white'}`}>
          <div className="flex items-start gap-3">
            <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${complaint.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}><ShieldCheck className="w-5 h-5"/></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900">Admin Complaint Verification</h3>
              {complaint.status === 'submitted' && (<>
                  <p className="mt-1 text-xs text-slate-600">You have opened the complaint detail, so student editing is now locked. Check the description and evidence below, then confirm whether this is a genuine complaint.</p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" disabled={reviewing} onClick={() => void reviewComplaint(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Ban className="w-4 h-4"/>No — Reject Complaint</button>
                    <button type="button" disabled={reviewing} onClick={() => void reviewComplaint(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><CheckCircle2 className="w-4 h-4"/>{reviewing ? 'Saving…' : 'Yes — Genuine Complaint'}</button>
                  </div>
                </>)}
              {complaint.status === 'rejected' && <p className="mt-1 text-xs font-semibold text-red-700">Marked as not genuine. No staff assignment or staff notification was created.</p>}
              {['verified', 'assigned'].includes(complaint.status) && (<div className="mt-3">
                  <p className="text-xs font-semibold text-emerald-800">Verified as genuine. Staff can be assigned now.</p>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <select value={selectedTech} onChange={(event) => setSelectedTech(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                      <option value="">Select staff member</option>
                      {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.full_name} — {tech.department || 'Maintenance'}</option>)}
                    </select>
                    <button type="button" disabled={!selectedTech || assigningStaff} onClick={() => void assignReviewedComplaint()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Send className="w-4 h-4"/>{assigningStaff ? 'Assigning…' : complaint.status === 'assigned' ? 'Reassign Staff' : 'Assign Staff'}</button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Staff receives a notification only after this assignment.</p>
                </div>)}
              {adminMessage && <p className={`mt-3 text-xs font-semibold ${adminMessage.includes('could not') ? 'text-red-700' : 'text-slate-700'}`}>{adminMessage}</p>}
            </div>
          </div>
        </Card>)}

      {(canClose || complaint.status === 'closed' || closeMessage) && (<Card className={`p-4 mb-5 border ${complaint.status === 'closed' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{complaint.status === 'closed' ? 'This complaint is closed.' : 'Final complaint closure'}</p>
              <p className="text-xs text-slate-600 mt-1">{closeMessage || (role === 'admin' ? 'Verify the work and give this complaint its final closure.' : 'Close the complaint once you have checked the work.')}</p>
            </div>
            {canClose && <button disabled={closing} onClick={() => void closeComplaint()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"><LockKeyhole className="w-4 h-4"/>{closing ? 'Closing…' : 'Close Complaint'}</button>}
          </div>
        </Card>)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left - details */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Description</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
          </Card>

          {((complaint.photo_urls || []).length > 0 || (complaint.video_urls || []).length > 0) && (<Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Student Complaint Media</h3>
              <p className="text-xs text-slate-500 mb-3">Photos and videos uploaded with the complaint.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(complaint.photo_urls || []).map((url, idx) => (<a key={`photo-${idx}`} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={url} alt={`Complaint photo ${idx + 1}`} className="w-full h-full object-cover" onError={onImageError}/>
                  </a>))}
                {(complaint.video_urls || []).map((url, idx) => (<div key={`video-${idx}`} className="rounded-xl overflow-hidden border border-slate-200 bg-black">
                    <video src={url} controls preload="metadata" className="w-full aspect-video object-contain" aria-label={`Complaint video ${idx + 1}`}/>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-600"><Video className="w-3.5 h-3.5"/>Video {idx + 1}</div>
                  </div>))}
              </div>
            </Card>)}

          {workOrder && (complaint.status === 'in_progress' || complaint.status === 'resolved' || complaint.status === 'closed' || complaint.status === 'waiting_approval') && (<Card className="p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Staff Work Evidence</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {complaint.status === 'in_progress'
                ? 'Work is currently in progress — before-repair photo captured so far.'
                : 'Review the before/after photos and remarks showing how the staff completed the work.'}
                  </p>
                </div>
                {workOrder.profiles?.full_name && <Badge className="bg-blue-50 text-blue-700">{workOrder.profiles.full_name}</Badge>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Before Repair</p>
                  {(workOrder.before_photo_urls || []).length === 0 ? (<div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">Before photo not provided</div>) : (<div className="grid grid-cols-2 gap-2">
                      {(workOrder.before_photo_urls || []).map((url, idx) => (<a key={idx} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl border border-slate-200">
                          <img src={url} alt={`Before repair ${idx + 1}`} className="h-full w-full object-cover" onError={onImageError}/>
                        </a>))}
                    </div>)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">After Repair</p>
                  {(workOrder.completion_photo_urls || []).length === 0 ? (<div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">
                      {complaint.status === 'in_progress' ? 'Not uploaded yet — job still in progress.' : 'After photo not provided'}
                    </div>) : (<div className="grid grid-cols-2 gap-2">
                      {(workOrder.completion_photo_urls || []).map((url, idx) => (<a key={idx} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl border border-slate-200">
                          <img src={url} alt={`After repair ${idx + 1}`} className="h-full w-full object-cover" onError={onImageError}/>
                        </a>))}
                    </div>)}
                </div>
              </div>
              {workOrder.repair_notes && (<div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600">Staff Completion Remarks</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{workOrder.repair_notes}</p>
                </div>)}
            </Card>)}

          {/* History */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Status History</h3>
            {history.length === 0 ? (<p className="text-sm text-slate-400">No history yet.</p>) : (<div className="space-y-4">
                {history.map((h, idx) => {
                const cfg = STATUS_CONFIG[h.new_status];
                return (<div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full ${cfg.dot} flex items-center justify-center flex-shrink-0`}>
                          {idx === history.length - 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-white"/> : <div className="w-2 h-2 rounded-full bg-white"/>}
                        </div>
                        {idx < history.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1"/>}
                      </div>
                      <div className="pb-2">
                        <p className="text-sm font-semibold text-slate-900">{cfg.label}</p>
                        {h.remarks && <p className="text-xs text-slate-600 mt-0.5">{h.remarks}</p>}
                        <p className="text-xs text-slate-400 mt-1">{h.changed_by_name} · {formatDate(h.created_at)}</p>
                      </div>
                    </div>);
            })}
              </div>)}
          </Card>

          {feedbackMessage && (<div className={`rounded-xl border px-4 py-3 text-sm ${feedbackMessage.startsWith('Thank') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {feedbackMessage}
            </div>)}

          {/* Feedback */}
          {complaint.feedback_rating && (<Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{role === 'student' ? 'Your Feedback' : 'Student Feedback'}</h3>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (<Star key={n} className={`w-5 h-5 ${n <= complaint.feedback_rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}/>))}
              </div>
              {complaint.feedback_comment && <p className="text-sm text-slate-600">{complaint.feedback_comment}</p>}
            </Card>)}

          {canFeedback && !feedbackOpen && (<Card className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-amber-500"/>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">How well did the staff complete the work?</p>
                  <p className="text-xs text-slate-600">Review the before/after photos and completed work, then give a 1–5 star rating and feedback.</p>
                </div>
                <button onClick={() => setFeedbackOpen(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                  Rate Now
                </button>
              </div>
            </Card>)}

          {feedbackOpen && canFeedback && (<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="Rate completed complaint">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">How was the completed work?</h3>
                    <p className="mt-1 text-xs text-slate-500">You have viewed the complaint details. Please rate the completed work from 1 to 5 stars.</p>
                  </div>
                  <button type="button" onClick={() => setFeedbackOpen(false)} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close rating popup"><X className="w-4 h-4"/></button>
                </div>
                <div className="my-5 flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (<button type="button" key={n} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(n)} aria-label={`${n} star rating`}>
                    <Star className={`w-10 h-10 transition-colors ${(hoverRating || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}/>
                  </button>))}
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} maxLength={500} rows={3} placeholder="Optional feedback about the work…" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 resize-none"/>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFeedbackOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Maybe Later</button>
                  <button type="button" onClick={submitFeedback} disabled={submittingFeedback || rating < 1} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{submittingFeedback ? 'Submitting…' : 'Submit Rating'}</button>
                </div>
              </div>
            </div>)}
        </div>

        {/* Right - meta */}
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Details</h3>
            <div className="space-y-3">
              <DetailRow icon={AlertCircle} label="Priority" value={<Badge className={`${pc.bg} ${pc.color} border ${pc.border}`}>{pc.label}</Badge>}/>
              <DetailRow icon={Wrench} label="Category" value={complaint.complaint_categories?.name || '—'}/>
              <DetailRow icon={MapPin} label="Location" value={complaint.buildings?.name || '—'}/>
              {complaint.floor && <DetailRow icon={MapPin} label="Floor" value={`Floor ${complaint.floor}`}/>}
              {complaint.location_description && <DetailRow icon={MapPin} label="Room" value={complaint.location_description}/>}
              <DetailRow icon={Clock} label="Submitted" value={formatDate(complaint.created_at)}/>
              {complaint.expected_completion && <DetailRow icon={Clock} label="Expected by" value={formatDate(complaint.expected_completion)}/>}
              {complaint.resolved_at && <DetailRow icon={CheckCircle2} label="Completed" value={formatDate(complaint.resolved_at)}/>}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">People</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500"/>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reported by</p>
                  <p className="text-sm font-semibold text-slate-900">{complaint.profiles?.full_name || 'You'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-slate-500"/>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Assigned to</p>
                  <p className="text-sm font-semibold text-slate-900">{complaint.assigned_profile?.full_name || 'Not assigned yet'}</p>
                </div>
              </div>
            </div>
          </Card>

          {complaint.escalation_level > 0 && (<Card className="p-5 bg-red-50 border-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600"/>
                <div>
                  <p className="text-sm font-semibold text-red-900">Escalated (Level {complaint.escalation_level})</p>
                  <p className="text-xs text-red-700 mt-0.5">This complaint has been escalated due to delay.</p>
                </div>
              </div>
            </Card>)}
        </div>
      </div>

      {editingComplaint && canEditComplaint && (<div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Edit complaint">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Complaint</h3>
                <p className="mt-1 text-xs text-slate-500">You can edit this complaint only until an admin opens it.</p>
              </div>
              <button type="button" onClick={() => setEditingComplaint(false)} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="w-4 h-4"/></button>
            </div>
            <div className="mt-4 space-y-3">
              <div><label className="mb-1 block text-xs font-semibold text-slate-700">Title *</label><input value={editTitle} onChange={(event) => setEditTitle(event.target.value.slice(0, 120))} maxLength={120} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-700">Category *</label><select value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{EDIT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-700">Description *</label><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value.slice(0, 500))} rows={4} maxLength={500} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-700">Location *</label><input value={editLocation} onChange={(event) => setEditLocation(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div>
              <div><label className="mb-2 block text-xs font-semibold text-slate-700">Priority</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{['low', 'medium', 'high', 'emergency'].map((item) => { const config = PRIORITY_CONFIG[item]; return <button key={item} type="button" onClick={() => setEditPriority(item)} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${editPriority === item ? `${config.bg} ${config.color} border-current` : 'border-slate-200 bg-white text-slate-500'}`}>{config.label}</button>; })}</div></div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">Required Photo * evidence stays attached while editing. Video is optional.</div>
              {editMessage && <p className="text-xs font-semibold text-red-700">{editMessage}</p>}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditingComplaint(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={savingEdit} onClick={() => void saveComplaintEdit()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>)}
    </div>);
}
function StudentComplaintDetailView({
    complaint,
    history,
    workOrder,
    onBack,
    onNavigate,
    unreadNotifications,
    canEditComplaint,
    openEditComplaint,
    editingComplaint,
    setEditingComplaint,
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editCategoryId,
    setEditCategoryId,
    editPriority,
    setEditPriority,
    editLocation,
    setEditLocation,
    savingEdit,
    editMessage,
    saveComplaintEdit,
    canFeedback,
    feedbackOpen,
    setFeedbackOpen,
    rating,
    setRating,
    hoverRating,
    setHoverRating,
    comment,
    setComment,
    submittingFeedback,
    submitFeedback,
    feedbackMessage,
}) {
    const statusKey = complaint.status === 'resolved' ? 'closed' : complaint.status;
    const statusLabel = STATUS_CONFIG[statusKey]?.label || 'Submitted';
    const priority = PRIORITY_CONFIG[complaint.priority] || PRIORITY_CONFIG.medium;
    const photos = complaint.photo_urls || [];
    const videos = complaint.video_urls || [];
    const locationBits = [
        complaint.buildings?.name,
        complaint.floor ? `Floor ${complaint.floor}` : '',
        complaint.location_description,
    ].filter(Boolean);
    const location = locationBits.join(', ') || 'Location not provided';
    const reporter = complaint.profiles?.full_name || 'You';
    const assignee = complaint.assigned_profile?.full_name
        ? `${complaint.assigned_profile.full_name}${complaint.assigned_profile.department ? ` - ${complaint.assigned_profile.department}` : ''}`
        : 'Not assigned yet';
    const timeline = history.length > 0
        ? history
        : [{ id: 'created', new_status: 'submitted', created_at: complaint.created_at, remarks: '', changed_by_name: reporter }];

    const statusTone = statusKey === 'closed'
        ? 'closed'
        : statusKey === 'in_progress' || statusKey === 'assigned' || statusKey === 'verified' || statusKey === 'waiting_approval'
            ? 'progress'
            : statusKey === 'rejected'
                ? 'rejected'
                : 'pending';
    const priorityTone = complaint.priority === 'high' || complaint.priority === 'emergency'
        ? 'danger'
        : complaint.priority === 'medium'
            ? 'medium'
            : 'low';

    return (<div className="student-screen student-complaint-detail-screen">
      <header className="student-complaint-detail-header">
        <button type="button" onClick={onBack} className="student-detail-back" aria-label="Back">
          <ArrowLeft size={29}/>
        </button>
        <h1>Complaint Details</h1>
        <button type="button" onClick={() => onNavigate?.('notifications')} className="student-detail-bell" aria-label="Open notifications">
          <Bell size={24}/>
          {unreadNotifications > 0 && <i/>}
        </button>
      </header>

      <section className="student-detail-hero">
        <p className="student-detail-number">#{complaint.complaint_no || complaint.id}</p>
        <h2>{complaint.title}</h2>
        <div className="student-detail-badges">
          <span className={`student-detail-status ${statusTone}`}>
            {statusKey === 'closed' ? <Check size={15}/> : <Clock size={15}/>} {statusLabel}
          </span>
          <span className={`student-detail-priority ${priorityTone}`}>
            <AlertCircle size={15}/> {priority.label}
          </span>
        </div>
      </section>

      <section className="student-detail-facts" aria-label="Complaint information">
        <StudentDetailFact icon={MapPin} label="Location" value={location}/>
        <StudentDetailFact icon={User} label="Reported by" value={reporter}/>
        <StudentDetailFact icon={CalendarDays} label="Date" value={formatDate(complaint.created_at)}/>
        <StudentDetailFact icon={Wrench} label="Assigned to" value={assignee}/>
      </section>

      <StudentDetailSection title="Description">
        <p className="student-detail-description">{complaint.description}</p>
      </StudentDetailSection>

      {(photos.length > 0 || videos.length > 0) && (<StudentDetailSection title="Photos">
          <div className="student-detail-media-grid">
            {photos.map((url, index) => (<a key={`photo-${index}`} href={url} target="_blank" rel="noreferrer" className="student-detail-media-card">
                <img src={url} alt={`Complaint photo ${index + 1}`} onError={onImageError}/>
              </a>))}
            {videos.map((url, index) => (<div key={`video-${index}`} className="student-detail-media-card student-detail-video-card">
                <video src={url} controls preload="metadata" aria-label={`Complaint video ${index + 1}`}/>
              </div>))}
          </div>
        </StudentDetailSection>)}

      <StudentDetailSection title="Before & After Work">
        <div className="staff-detail-evidence-grid">
          <div>
            <span className="staff-detail-evidence-label">Before Photo</span>
            {(workOrder?.before_photo_urls || []).length > 0 ? <div className="staff-detail-evidence-media">
              {(workOrder?.before_photo_urls || []).map((url, index) => <a key={`before-${index}`} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Before work ${index + 1}`} onError={onImageError}/></a>)}
            </div> : <div className="student-detail-note locked"><span>Before photo not uploaded yet.</span></div>}
          </div>
          <div>
            <span className="staff-detail-evidence-label">After Photo</span>
            {(workOrder?.completion_photo_urls || []).length > 0 ? <div className="staff-detail-evidence-media">
              {(workOrder?.completion_photo_urls || []).map((url, index) => <a key={`after-${index}`} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`After work ${index + 1}`} onError={onImageError}/></a>)}
            </div> : <div className="student-detail-note locked"><span>After photo not uploaded yet.</span></div>}
          </div>
        </div>
        {workOrder?.repair_notes && <p className="staff-detail-repair-note"><strong>Completion note</strong>{workOrder.repair_notes}</p>}
      </StudentDetailSection>

      <StudentDetailSection title="Timeline">
        <div className="student-detail-timeline">
          {timeline.map((entry, index) => {
              const entryStatus = entry.new_status === 'resolved' ? 'closed' : entry.new_status;
              const cfg = STATUS_CONFIG[entryStatus] || STATUS_CONFIG.submitted;
              const isLast = index === timeline.length - 1;
              return (<div key={entry.id || `${entryStatus}-${index}`} className={`student-timeline-item ${isLast ? 'is-last' : ''}`}>
                <div className="student-timeline-rail">
                  <span className={isLast ? 'is-current' : ''}>{isLast && <Check size={13}/>}</span>
                  {!isLast && <i/>}
                </div>
                <div className="student-timeline-copy">
                  <strong>{cfg.label}</strong>
                  <small>{formatDate(entry.created_at)}</small>
                  {entry.remarks && <p>{entry.remarks}</p>}
                </div>
              </div>);
          })}
        </div>
      </StudentDetailSection>

      {feedbackMessage && <div className="student-detail-note success">{feedbackMessage}</div>}

      <div className="student-detail-actions">
        {canEditComplaint ? (<button type="button" onClick={openEditComplaint} className="student-detail-primary-action">
            <Pencil size={20}/> Edit Complaint
          </button>) : complaint.status === 'submitted' && complaint.admin_viewed_at ? (<div className="student-detail-note locked">
            <LockKeyhole size={16}/>
            <span>Admin has viewed this complaint. Editing is now locked.</span>
          </div>) : canFeedback ? (<button type="button" onClick={() => setFeedbackOpen(true)} className="student-detail-primary-action">
            <Star size={20}/> Rate Completed Work
          </button>) : null}
      </div>

      {editingComplaint && canEditComplaint && (<div className="student-detail-modal-layer" role="dialog" aria-modal="true" aria-label="Edit complaint">
          <div className="student-detail-edit-modal">
            <div className="student-detail-edit-head">
              <div>
                <h3>Edit Complaint</h3>
                <p>You can edit only until an admin opens this complaint.</p>
              </div>
              <button type="button" onClick={() => setEditingComplaint(false)} aria-label="Close edit form"><X size={19}/></button>
            </div>
            <div className="student-detail-edit-fields">
              <label><span>Title *</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value.slice(0, 120))} maxLength={120}/></label>
              <label><span>Category *</span><select value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)}>{EDIT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>Description *</span><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value.slice(0, 500))} rows={4} maxLength={500}/></label>
              <label><span>Location *</span><input value={editLocation} onChange={(event) => setEditLocation(event.target.value)}/></label>
              <div>
                <span className="student-detail-edit-label">Priority</span>
                <div className="student-detail-edit-priorities">
                  {['low', 'medium', 'high', 'emergency'].map((item) => (<button key={item} type="button" onClick={() => setEditPriority(item)} className={editPriority === item ? 'is-active' : ''}>{PRIORITY_CONFIG[item].label}</button>))}
                </div>
              </div>
              {editMessage && <p className="student-detail-edit-error">{editMessage}</p>}
            </div>
            <div className="student-detail-edit-buttons">
              <button type="button" onClick={() => setEditingComplaint(false)}>Cancel</button>
              <button type="button" disabled={savingEdit} onClick={() => void saveComplaintEdit()}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>)}

      {feedbackOpen && canFeedback && (<div className="student-detail-modal-layer" role="dialog" aria-modal="true" aria-label="Rate completed complaint">
          <div className="student-detail-edit-modal">
            <div className="student-detail-edit-head">
              <div>
                <h3>Rate Completed Work</h3>
                <p>Tell us how well the complaint was handled.</p>
              </div>
              <button type="button" onClick={() => setFeedbackOpen(false)} aria-label="Close rating form"><X size={19}/></button>
            </div>
            <div className="student-detail-rating-stars">
              {[1, 2, 3, 4, 5].map((number) => (<button type="button" key={number} onMouseEnter={() => setHoverRating(number)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(number)} aria-label={`${number} star rating`}>
                <Star className={(hoverRating || rating) >= number ? 'is-active' : ''}/>
              </button>))}
            </div>
            <textarea className="student-detail-rating-comment" value={comment} onChange={(event) => setComment(event.target.value.slice(0, 500))} rows={3} maxLength={500} placeholder="Optional feedback…"/>
            <div className="student-detail-edit-buttons">
              <button type="button" onClick={() => setFeedbackOpen(false)}>Later</button>
              <button type="button" disabled={submittingFeedback || rating < 1} onClick={() => void submitFeedback()}>{submittingFeedback ? 'Submitting…' : 'Submit Rating'}</button>
            </div>
          </div>
        </div>)}
    </div>);
}

function StudentDetailFact({ icon: Icon, label, value }) {
    return (<div className="student-detail-fact-row">
      <div className="student-detail-fact-label"><Icon size={18}/><span>{label}</span></div>
      <span className="student-detail-fact-divider"/>
      <strong>{value}</strong>
    </div>);
}

function StudentDetailSection({ title, children }) {
    return (<section className="student-detail-section">
      <h3><span/>{title}</h3>
      {children}
    </section>);
}

function DetailRow({ icon: Icon, label, value }) {
    return (<div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="w-3.5 h-3.5"/>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900 text-right">{value}</span>
    </div>);
}
