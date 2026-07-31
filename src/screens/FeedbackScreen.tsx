import { useEffect, useMemo, useState } from 'react';
import { Star, MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { supabase, type Complaint } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Card, EmptyState, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/constants';

export function FeedbackScreen({ onOpenComplaint }: { onOpenComplaint: (id: string) => void }) {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isAdmin = profile?.role === 'admin';

  useEffect(() => { void load(); }, [profile?.id, profile?.role]);
  const load = async () => {
    setLoading(true); setError('');
    let query = supabase.from('complaints').select('*, profiles!complaints_user_id_fkey(*), profiles!complaints_assigned_to_fkey(*)').order('updated_at', { ascending: false });
    if (!isAdmin && profile?.id) query = query.eq('user_id', profile.id);
    const { data, error: e } = await query;
    if (e) setError(e.message); else setComplaints((data || []) as unknown as Complaint[]);
    setLoading(false);
  };

  const rows = useMemo(() => complaints.filter(c => isAdmin ? !!c.feedback_rating : ['resolved','closed'].includes(c.status)), [complaints, isAdmin]);
  const average = useMemo(() => {
    const rated = rows.filter(c => c.feedback_rating);
    return rated.length ? (rated.reduce((s,c)=>s+(c.feedback_rating || 0),0)/rated.length).toFixed(1) : '—';
  }, [rows]);

  if (loading) return <Spinner />;
  return <div className="max-w-5xl mx-auto space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">{isAdmin ? 'Student Feedback & Ratings' : 'Feedback & Ratings'}</h1><p className="text-sm text-slate-500 mt-1">{isAdmin ? 'Completed work par students ki ratings dekhein.' : 'Resolved complaints ko rate karein aur apna submitted feedback dekhein.'}</p></div>
    {isAdmin && <div className="grid sm:grid-cols-2 gap-4"><Card className="p-5"><p className="text-xs text-slate-500">Average Rating</p><p className="text-3xl font-bold mt-1 flex items-center gap-2">{average}<Star className="w-6 h-6 fill-amber-400 text-amber-400"/></p></Card><Card className="p-5"><p className="text-xs text-slate-500">Total Feedback</p><p className="text-3xl font-bold mt-1">{rows.filter(c=>c.feedback_rating).length}</p></Card></div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {!rows.length ? <Card className="p-8"><EmptyState icon={MessageSquare} title="No feedback yet" description={isAdmin ? 'Student ratings yahan dikhengi.' : 'Resolved complaint hone ke baad rating option yahan milega.'}/></Card> :
      <div className="space-y-3">{rows.map(c => <Card key={c.id} className="p-5"><div className="flex flex-col sm:flex-row sm:items-start gap-4"><div className="flex-1"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-mono text-slate-500">{c.complaint_no}</span>{c.feedback_rating ? <span className="text-xs text-emerald-700 bg-emerald-50 rounded-full px-2 py-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Submitted</span> : <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-1 flex items-center gap-1"><Clock className="w-3 h-3"/>Pending rating</span>}</div><h3 className="font-semibold text-slate-900 mt-2">{c.title}</h3>{c.feedback_rating && <><div className="flex gap-1 mt-3">{[1,2,3,4,5].map(n=><Star key={n} className={`w-5 h-5 ${n <= (c.feedback_rating || 0) ? 'fill-amber-400 text-amber-400':'text-slate-300'}`}/>)}</div>{c.feedback_comment && <p className="text-sm text-slate-600 mt-2">{c.feedback_comment}</p>}<p className="text-xs text-slate-400 mt-2">{c.feedback_submitted_at ? formatDate(c.feedback_submitted_at) : ''}</p></>}</div><button onClick={()=>onOpenComplaint(c.id)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold">{c.feedback_rating ? 'View Details' : 'Rate Now'}</button></div></Card>)}</div>}
  </div>;
}
