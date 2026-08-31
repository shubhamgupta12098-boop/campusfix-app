import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MessageSquare, Star, Tag, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Card, EmptyState, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/constants';

export function FeedbackScreen({ onOpenComplaint }) {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const isAdmin = profile?.role === 'admin';

  useEffect(() => { void load(); }, [profile?.id, profile?.role]);

  const load = async () => {
    setLoading(true);
    setError('');
    let query = supabase.from('complaints').select('*, profiles!complaints_user_id_fkey(*), profiles!complaints_assigned_to_fkey(*)').order('updated_at', { ascending: false });
    if (!isAdmin && profile?.id) query = query.eq('user_id', profile.id);
    const { data, error: e } = await query;
    if (e) setError(e.message);
    else setComplaints(data || []);
    setLoading(false);
  };

  const rows = useMemo(() => complaints.filter((c) => isAdmin ? !!c.feedback_rating : ['resolved','closed'].includes(c.status)), [complaints, isAdmin]);
  const average = useMemo(() => {
    const rated = rows.filter((c) => Number(c.feedback_rating) > 0);
    return rated.length ? (rated.reduce((s,c) => s + Number(c.feedback_rating || 0), 0) / rated.length).toFixed(1) : '—';
  }, [rows]);

  const filtered = useMemo(() => rows.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'low') return Number(c.feedback_rating || 0) < 4;
    return Math.round(Number(c.feedback_rating || 0)) === Number(filter);
  }), [rows, filter]);

  if (loading) return <Spinner/>;

  if (isAdmin) {
    const rounded = average === '—' ? 0 : Math.round(Number(average));
    return <div className="admin-screen admin-feedback-screen">
      <section className="admin-rating-hero">
        <div><small>OVERALL AVERAGE RATING</small><strong>{average}<b>/5</b></strong><p>Based on {rows.length} feedbacks</p><div className="admin-rating-stars">{[1,2,3,4,5].map((n) => <Star key={n} size={28} fill={n <= rounded ? 'currentColor' : 'none'}/>)}</div></div>
        <div className="admin-smile" aria-hidden="true"><span>•</span><span>•</span><i/></div>
      </section>

      <div className="admin-feedback-tabs">{[['all','All'],['5','5 Stars'],['4','4 Stars'],['low','Low Ratings']].map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={filter === id ? 'is-active' : ''}>{label}</button>)}</div>
      {error && <div className="admin-inline-error">{error}</div>}

      {filtered.length === 0 ? <div className="admin-empty-card"><EmptyState icon={MessageSquare} title="No feedback found"/></div> : <div className="admin-feedback-list">
        {filtered.map((c) => {
          const name = c.profiles?.full_name || 'Campus User';
          return <button key={c.id} type="button" onClick={() => onOpenComplaint(c.id)} className="admin-feedback-card">
            <div className="admin-feedback-avatar"><UserRound size={27}/></div>
            <div className="admin-feedback-copy"><h3>{name}</h3><p>{c.feedback_comment || c.title}</p><div><span><CalendarDays size={16}/>{c.feedback_submitted_at ? new Date(c.feedback_submitted_at).toLocaleDateString('en-US',{month:'short',year:'numeric'}) : 'Recent'}</span><i/><span><Tag size={16}/>{c.complaint_no || 'Complaint'}</span></div></div>
            <strong><Star size={24} fill="currentColor"/>{Number(c.feedback_rating || 0).toFixed(1)}</strong>
          </button>;
        })}
      </div>}
    </div>;
  }

  return <div className="max-w-5xl mx-auto space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">Feedback & Ratings</h1><p className="text-sm text-slate-500 mt-1">Rate your resolved complaints and review submitted feedback.</p></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {!rows.length ? <Card className="p-8"><EmptyState icon={MessageSquare} title="No feedback yet" description="You can rate a complaint after it has been resolved."/></Card> : <div className="space-y-3">{rows.map((c) => <Card key={c.id} className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs text-slate-500">{c.complaint_no}</p><h3 className="font-semibold text-slate-900 mt-1">{c.title}</h3>{c.feedback_rating && <p className="text-sm text-slate-600 mt-2">{c.feedback_comment || `${c.feedback_rating}/5`}</p>}</div><button onClick={() => onOpenComplaint(c.id)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold">View Details</button></div></Card>)}</div>}
  </div>;
}
