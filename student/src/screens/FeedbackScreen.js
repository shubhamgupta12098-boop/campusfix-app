import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BarChart3,
    BookOpen,
    CheckCircle2,
    Clock,
    Filter,
    MessageSquare,
    Star,
    Utensils,
    Wifi,
    Wrench,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { Card, EmptyState, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/constants';

function ratingIcon(name = '') {
    const value = name.toLowerCase();
    if (value.includes('food') || value.includes('mess') || value.includes('canteen')) return Utensils;
    if (value.includes('wifi') || value.includes('wi-fi') || value.includes('network')) return Wifi;
    if (value.includes('library') || value.includes('book')) return BookOpen;
    return Wrench;
}

export function FeedbackScreen({ onOpenComplaint, onBack }) {
    const { profile } = useAuthStore();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isAdmin = profile?.role === 'admin';

    useEffect(() => { void load(); }, [profile?.id, profile?.role]);

    const load = async () => {
        setLoading(true);
        setError('');
        let query = supabase
            .from('complaints')
            .select('*, complaint_categories(*), profiles!complaints_user_id_fkey(*), profiles!complaints_assigned_to_fkey(*)')
            .order('updated_at', { ascending: false });
        if (!isAdmin && profile?.id) query = query.eq('user_id', profile.id);
        const { data, error: loadError } = await query;
        if (loadError) setError(loadError.message);
        else setComplaints(data || []);
        setLoading(false);
    };

    const rows = useMemo(() => complaints.filter((complaint) => isAdmin ? !!complaint.feedback_rating : ['resolved', 'closed'].includes(complaint.status)), [complaints, isAdmin]);
    const average = useMemo(() => {
        const rated = rows.filter((complaint) => Number(complaint.feedback_rating) > 0);
        return rated.length ? rated.reduce((sum, complaint) => sum + Number(complaint.feedback_rating || 0), 0) / rated.length : 0;
    }, [rows]);

    const groupedRatings = useMemo(() => {
        const groups = new Map();
        complaints.filter((complaint) => Number(complaint.feedback_rating) > 0).forEach((complaint) => {
            const name = complaint.complaint_categories?.name || complaint.category_name || 'General';
            const current = groups.get(name) || { name, total: 0, count: 0 };
            current.total += Number(complaint.feedback_rating || 0);
            current.count += 1;
            groups.set(name, current);
        });
        return [...groups.values()]
            .map((group) => ({ ...group, average: group.total / group.count }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 5);
    }, [complaints]);

    if (loading) return <Spinner />;

    if (!isAdmin) {
        const ratedRows = complaints.filter((complaint) => Number(complaint.feedback_rating) > 0).slice(0, 3);
        return (
          <div className="student-screen student-ratings-screen">
            <div className="student-ratings-heading">
              <button type="button" className="student-back-button" onClick={onBack} aria-label="Back"><ArrowLeft size={27}/></button>
              <h1>Ratings</h1>
              <button type="button" className="student-filter-button" aria-label="Filter ratings"><Filter size={24}/></button>
            </div>

            <div className="student-ratings-hero">
              <div>
                <strong>{average ? average.toFixed(1) : '—'}<small>/5</small></strong>
                <p><Star size={17} fill="currentColor"/>Based on {complaints.filter((complaint) => Number(complaint.feedback_rating) > 0).length} feedbacks</p>
              </div>
              <div className="student-bar-chart" aria-hidden="true">
                {[42, 58, 68, 51, 73, 52, 65, 79].map((height, index) => <i key={index} style={{ height: `${height}%` }}/>) }
              </div>
            </div>

            <section className="student-ratings-section">
              <h2>Campus Ratings Breakdown</h2>
              <div className="student-rating-breakdown">
                {!groupedRatings.length ? <div className="student-empty-card"><BarChart3 size={28}/><strong>No ratings yet</strong><span>Category ratings will appear after feedback is submitted.</span></div> : groupedRatings.map((group) => {
                    const Icon = ratingIcon(group.name);
                    const percent = Math.round((group.average / 5) * 100);
                    return <div key={group.name} className="student-rating-row">
                      <span className="student-rating-row-icon"><Icon size={21}/></span>
                      <span className="student-rating-row-name"><b>{group.name}</b><small>{'★'.repeat(Math.max(1, Math.round(group.average)))}</small></span>
                      <strong>{group.average.toFixed(1)}</strong>
                      <span className="student-rating-progress"><i style={{ width: `${percent}%` }}/></span>
                      <em>{percent}%</em>
                    </div>;
                })}
              </div>
            </section>

            <section className="student-ratings-section">
              <div className="student-section-title-row"><h2>Recent Top Rated</h2></div>
              <div className="student-top-rated-grid">
                {!ratedRows.length ? <div className="student-empty-card"><Star size={28}/><strong>No feedback yet</strong><span>Your recent ratings will appear here.</span></div> : ratedRows.map((complaint) => {
                    const categoryName = complaint.complaint_categories?.name || complaint.category_name || 'Campus';
                    const Icon = ratingIcon(categoryName);
                    return <button type="button" key={complaint.id} onClick={() => onOpenComplaint(complaint.id)}>
                      <span><Icon size={21}/></span>
                      <b>{categoryName}</b>
                      <strong>{Number(complaint.feedback_rating).toFixed(1)} <Star size={15} fill="currentColor"/></strong>
                      <p>{complaint.feedback_comment || complaint.title}</p>
                    </button>;
                })}
              </div>
            </section>
          </div>
        );
    }

    return <div className="max-w-5xl mx-auto space-y-5">
      <div><h1 className="text-2xl font-bold text-slate-900">Student Feedback & Ratings</h1><p className="text-sm text-slate-500 mt-1">View student ratings for completed work.</p></div>
      <div className="grid sm:grid-cols-2 gap-4"><Card className="p-5"><p className="text-xs text-slate-500">Average Rating</p><p className="text-3xl font-bold mt-1 flex items-center gap-2">{average ? average.toFixed(1) : '—'}<Star className="w-6 h-6 fill-amber-400 text-amber-400"/></p></Card><Card className="p-5"><p className="text-xs text-slate-500">Total Feedback</p><p className="text-3xl font-bold mt-1">{rows.length}</p></Card></div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!rows.length ? <Card className="p-8"><EmptyState icon={MessageSquare} title="No feedback yet" description="Student ratings will appear here."/></Card> :
        <div className="space-y-3">{rows.map((complaint) => <Card key={complaint.id} className="p-5"><div className="flex flex-col sm:flex-row sm:items-start gap-4"><div className="flex-1"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-mono text-slate-500">{complaint.complaint_no}</span>{complaint.feedback_rating ? <span className="text-xs text-emerald-700 bg-emerald-50 rounded-full px-2 py-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Submitted</span> : <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-1 flex items-center gap-1"><Clock className="w-3 h-3"/>Pending rating</span>}</div><h3 className="font-semibold text-slate-900 mt-2">{complaint.title}</h3>{complaint.feedback_rating && <><div className="flex gap-1 mt-3">{[1,2,3,4,5].map((number) => <Star key={number} className={`w-5 h-5 ${number <= Number(complaint.feedback_rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}/>)}</div>{complaint.feedback_comment && <p className="text-sm text-slate-600 mt-2">{complaint.feedback_comment}</p>}<p className="text-xs text-slate-400 mt-2">{complaint.feedback_submitted_at ? formatDate(complaint.feedback_submitted_at) : ''}</p></>}</div><button onClick={() => onOpenComplaint(complaint.id)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold">View Details</button></div></Card>)}</div>}
    </div>;
}
