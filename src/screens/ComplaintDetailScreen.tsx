import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, STATUS_FLOW, PRIORITY_CONFIG, formatDate, timeAgo } from '@/lib/constants';
import type { Complaint, ComplaintStatus } from '@/lib/supabase';
import { ArrowLeft, MapPin, User, Wrench, Clock, Star, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';

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

  const role = profile?.role ?? 'student';
  const canFeedback = (complaint?.status === 'resolved' || complaint?.status === 'closed') && complaint?.user_id === profile?.id && !complaint?.feedback_rating;

  useEffect(() => {
    void load();
  }, [complaintId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('complaints')
      .select('*, complaint_categories(*), buildings(*), profiles!complaints_user_id_fkey(*), profiles!complaints_assigned_to_fkey(*)')
      .eq('id', complaintId)
      .maybeSingle();
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
    setLoading(false);
  };

  const submitFeedback = async () => {
    if (rating < 1) return;
    setSubmittingFeedback(true);
    await supabase
      .from('complaints')
      .update({ feedback_rating: rating, feedback_comment: comment })
      .eq('id', complaintId);
    setSubmittingFeedback(false);
    setFeedbackOpen(false);
    void load();
  };

  if (loading) return <Spinner />;

  if (!complaint) {
    return <EmptyState icon={AlertCircle} title="Complaint not found" />;
  }

  const sc = STATUS_CONFIG[complaint.status];
  const pc = PRIORITY_CONFIG[complaint.priority];
  const currentStepIndex = STATUS_FLOW.indexOf(complaint.status);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left - details */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Description</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
          </Card>

          {complaint.photo_urls && complaint.photo_urls.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Photos</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {complaint.photo_urls.map((url, idx) => (
                  <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
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

          {/* Feedback */}
          {complaint.feedback_rating && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Your Feedback</h3>
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
                  <p className="text-sm font-semibold text-slate-900">How was the resolution?</p>
                  <p className="text-xs text-slate-600">Rate your experience to help us improve.</p>
                </div>
                <button onClick={() => setFeedbackOpen(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                  Rate Now
                </button>
              </div>
            </Card>
          )}

          {feedbackOpen && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Leave Feedback</h3>
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
                placeholder="Share your experience…"
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
              {complaint.resolved_at && <DetailRow icon={CheckCircle2} label="Resolved" value={formatDate(complaint.resolved_at)} />}
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
