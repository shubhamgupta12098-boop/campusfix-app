import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, STATUS_FLOW, PRIORITY_CONFIG, formatDate, timeAgo } from '@/lib/constants';
import type { Complaint, ComplaintStatus, WorkOrder } from '@/lib/supabase';
import { ArrowLeft, MapPin, User, Wrench, Clock, Star, MessageSquare, CheckCircle2, AlertCircle, LockKeyhole } from 'lucide-react';

interface StatusHistoryEntry {
  id: string;
  old_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  remarks: string | null;
  created_at: string;
  changed_by_name?: string;
}

export function ComplaintDetailScreen({ complaintId, onBack }: { complaintId: string; onBack: () => void }) {
  const { profile } = useAuthStore();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeMessage, setCloseMessage] = useState('');

  const role = profile?.role ?? 'student';
  const canFeedback = role === 'student' && (complaint?.status === 'resolved' || complaint?.status === 'closed') && complaint?.user_id === profile?.id && !complaint?.feedback_rating;

  useEffect(() => {
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
    setComplaint(data as unknown as Complaint);

    const { data: histData } = await supabase
      .from('complaint_status_history')
      .select('*, profiles!changed_by(full_name)')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true });
    const hist = (histData || []).map((h: any) => ({
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
    setWorkOrder(((workOrders || [])[0] as unknown as WorkOrder) || null);
    setLoading(false);
  };


  const canClose = !!complaint && complaint.status !== 'closed' && (
    (role === 'admin' && ['waiting_approval', 'resolved'].includes(complaint.status)) ||
    (role === 'student' && complaint.status === 'resolved' && complaint.user_id === profile?.id)
  );

  const closeComplaint = async () => {
    if (!complaint || !profile?.id || !canClose) return;
    if (!window.confirm('Is complaint ko permanently close karna hai?')) return;
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
      await supabase.from('notifications').insert({
        user_id: complaint.user_id,
        title: 'Complaint Closed',
        message: `${complaint.title} has been closed.`,
        type: 'closed',
        related_id: complaint.id,
      });
    }
    setClosing(false);
    if (error) setCloseMessage(error.message || 'Complaint close nahi hui.');
    else { setCloseMessage('Complaint successfully closed.'); await load(); }
  };

  const submitFeedback = async () => {
    if (rating < 1 || !profile?.id || complaint?.user_id !== profile.id) return;
    setSubmittingFeedback(true);
    setFeedbackMessage('');
    const submittedAt = new Date().toISOString();
    const { error } = await supabase
      .from('complaints')
      .update({
        feedback_rating: rating,
        feedback_comment: comment.trim(),
        feedback_submitted_at: submittedAt,
        feedback_by: profile.id,
      })
      .eq('id', complaintId);
    setSubmittingFeedback(false);
    if (error) {
      setFeedbackMessage(error.message || 'Feedback submit nahi hua. Dobara try karo.');
      return;
    }
    setFeedbackOpen(false);
    setFeedbackMessage('Thank you! Aapki rating aur feedback save ho gaya.');
    void load();
  };

  if (loading) return <Spinner />;

  if (!complaint) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 font-medium"><ArrowLeft className="w-4 h-4" />Back</button>
        <Card className="p-6 border border-red-200 bg-red-50">
          <EmptyState icon={AlertCircle} title="Complaint detail could not be loaded" description={loadError || 'Complaint not found or it has been removed.'} />
          <button onClick={() => void load()} className="mx-auto mt-3 block px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold">Retry</button>
        </Card>
      </div>
    );
  }

  const displayStatus: ComplaintStatus = complaint.status === 'resolved' ? 'closed' : complaint.status;
  const sc = STATUS_CONFIG[displayStatus];
  const pc = PRIORITY_CONFIG[complaint.priority];
  const currentStepIndex = STATUS_FLOW.indexOf(displayStatus);

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (complaint.complaint_categories?.color || '#3B82F6') + '15' }}>
            <Wrench className="w-6 h-6" style={{ color: complaint.complaint_categories?.color || '#3B82F6' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{complaint.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{complaint.complaint_no} · {complaint.complaint_categories?.name}</p>
          </div>
        </div>
        <Badge className={`${sc.bg} ${sc.color} text-sm`}>
          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
          {sc.label}
        </Badge>
      </div>

      {/* Status tracker */}
      <Card className="p-5 mb-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Status Timeline</h3>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STATUS_FLOW.map((status, idx) => {
            const cfg = STATUS_CONFIG[status];
            const isDone = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={status} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isDone ? `${cfg.dot} text-white` : 'bg-slate-100 text-slate-400'
                    } ${isCurrent ? 'ring-4 ring-offset-1' : ''}`}
                    style={isCurrent ? { boxShadow: `0 0 0 4px ${complaint.complaint_categories?.color || '#3B82F6'}30` } : {}}
                  >
                    {isDone && idx < currentStepIndex ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-[10px] font-semibold ${isDone ? 'text-slate-700' : 'text-slate-400'}`}>{cfg.label}</span>
                </div>
                {idx < STATUS_FLOW.length - 1 && (
                  <div className={`h-0.5 w-8 sm:w-12 mx-1 ${idx < currentStepIndex ? cfg.dot : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {(canClose || complaint.status === 'closed' || closeMessage) && (
        <Card className={`p-4 mb-5 border ${complaint.status === 'closed' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{complaint.status === 'closed' ? 'This complaint is closed.' : 'Final complaint closure'}</p>
              <p className="text-xs text-slate-600 mt-1">{closeMessage || (role === 'admin' ? 'Work verify karke complaint ko final close karein.' : 'Kaam check karne ke baad complaint close karein.')}</p>
            </div>
            {canClose && <button disabled={closing} onClick={() => void closeComplaint()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"><LockKeyhole className="w-4 h-4" />{closing ? 'Closing…' : 'Close Complaint'}</button>}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left - details */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Description</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
          </Card>

          {complaint.photo_urls && complaint.photo_urls.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Student Complaint Photos</h3><p className="text-xs text-slate-500 mb-3">Student ne complaint ke saath ye photos upload ki hain.</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {complaint.photo_urls.map((url, idx) => (
                  <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {workOrder && (complaint.status === 'in_progress' || complaint.status === 'resolved' || complaint.status === 'closed' || complaint.status === 'waiting_approval') && (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Staff Work Evidence</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {complaint.status === 'in_progress'
                      ? 'Work is currently in progress — before-repair photo captured so far.'
                      : 'Staff ne kaam kaise kiya, uski before/after photos aur remarks.'}
                  </p>
                </div>
                {workOrder.profiles?.full_name && <Badge className="bg-blue-50 text-blue-700">{workOrder.profiles.full_name}</Badge>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Before Repair</p>
                  {(workOrder.before_photo_urls || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">Before photo not provided</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {(workOrder.before_photo_urls || []).map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl border border-slate-200">
                          <img src={url} alt={`Before repair ${idx + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">After Repair</p>
                  {(workOrder.completion_photo_urls || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">
                      {complaint.status === 'in_progress' ? 'Not uploaded yet — job still in progress.' : 'After photo not provided'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {(workOrder.completion_photo_urls || []).map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl border border-slate-200">
                          <img src={url} alt={`After repair ${idx + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {workOrder.repair_notes && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600">Staff Completion Remarks</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{workOrder.repair_notes}</p>
                </div>
              )}
            </Card>
          )}

          {/* History */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Status History</h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">No history yet.</p>
            ) : (
              <div className="space-y-4">
                {history.map((h, idx) => {
                  const cfg = STATUS_CONFIG[h.new_status];
                  return (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full ${cfg.dot} flex items-center justify-center flex-shrink-0`}>
                          {idx === history.length - 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        {idx < history.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1" />}
                      </div>
                      <div className="pb-2">
                        <p className="text-sm font-semibold text-slate-900">{cfg.label}</p>
                        {h.remarks && <p className="text-xs text-slate-600 mt-0.5">{h.remarks}</p>}
                        <p className="text-xs text-slate-400 mt-1">{h.changed_by_name} · {formatDate(h.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {feedbackMessage && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${feedbackMessage.startsWith('Thank') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {feedbackMessage}
            </div>
          )}

          {/* Feedback */}
          {complaint.feedback_rating && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{role === 'student' ? 'Your Feedback' : 'Student Feedback'}</h3>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`w-5 h-5 ${n <= complaint.feedback_rating! ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                ))}
              </div>
              {complaint.feedback_comment && <p className="text-sm text-slate-600">{complaint.feedback_comment}</p>}
            </Card>
          )}

          {canFeedback && !feedbackOpen && (
            <Card className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Staff ne kaam kaisa kiya?</p>
                  <p className="text-xs text-slate-600">Before/after photos aur completed work dekhkar 1–5 star rating aur feedback dein.</p>
                </div>
                <button onClick={() => setFeedbackOpen(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                  Rate Now
                </button>
              </div>
            </Card>
          )}

          {feedbackOpen && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Rate Staff Work</h3>
              <p className="mb-3 text-xs text-slate-500">1 star = poor, 5 stars = excellent</p>
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(n)}
                  >
                    <Star className={`w-8 h-8 transition-colors ${(hoverRating || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Staff ke kaam, quality aur behaviour ke baare mein feedback likhein…"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 resize-none mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitFeedback}
                  disabled={submittingFeedback || rating < 1}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submittingFeedback ? 'Submitting…' : 'Submit'}
                </button>
                <button onClick={() => setFeedbackOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </Card>
          )}
        </div>

        {/* Right - meta */}
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Details</h3>
            <div className="space-y-3">
              <DetailRow icon={AlertCircle} label="Priority" value={<Badge className={`${pc.bg} ${pc.color} border ${pc.border}`}>{pc.label}</Badge>} />
              <DetailRow icon={Wrench} label="Category" value={complaint.complaint_categories?.name || '—'} />
              <DetailRow icon={MapPin} label="Location" value={complaint.buildings?.name || '—'} />
              {complaint.floor && <DetailRow icon={MapPin} label="Floor" value={`Floor ${complaint.floor}`} />}
              {complaint.location_description && <DetailRow icon={MapPin} label="Room" value={complaint.location_description} />}
              <DetailRow icon={Clock} label="Submitted" value={formatDate(complaint.created_at)} />
              {complaint.expected_completion && <DetailRow icon={Clock} label="Expected by" value={formatDate(complaint.expected_completion)} />}
              {complaint.resolved_at && <DetailRow icon={CheckCircle2} label="Completed" value={formatDate(complaint.resolved_at)} />}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">People</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reported by</p>
                  <p className="text-sm font-semibold text-slate-900">{complaint.profiles?.full_name || 'You'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Assigned to</p>
                  <p className="text-sm font-semibold text-slate-900">{complaint.assigned_profile?.full_name || 'Not assigned yet'}</p>
                </div>
              </div>
            </div>
          </Card>

          {complaint.escalation_level > 0 && (
            <Card className="p-5 bg-red-50 border-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-900">Escalated (Level {complaint.escalation_level})</p>
                  <p className="text-xs text-red-700 mt-0.5">This complaint has been escalated due to delay.</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );
}
