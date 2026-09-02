import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, Briefcase, CheckCircle2, Clock3, MessageCircle, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function Stars({ value = 0, size = 'normal' }) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span className={`staff-performance-stars ${size === 'large' ? 'is-large' : ''}`} aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rounded ? 'is-filled' : ''}>★</span>
      ))}
    </span>
  );
}

export function PerformanceScreen({ onNavigate, unreadNotifications = 0 }) {
  const { profile } = useAuthStore();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let query = supabase
        .from('complaints')
        .select('*, complaint_categories(*)')
        .order('updated_at', { ascending: false });
      if (profile?.id) query = query.eq('assigned_to', profile.id);
      const { data } = await query;
      if (active) {
        setJobs(Array.isArray(data) ? data : []);
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [profile?.id]);

  const stats = useMemo(() => {
    const finished = jobs.filter((job) => ['resolved', 'closed'].includes(job.status));
    const rated = finished.filter((job) => Number(job.feedback_rating) > 0);
    const overall = rated.length
      ? rated.reduce((sum, job) => sum + Number(job.feedback_rating || 0), 0) / rated.length
      : 0;
    const completion = jobs.length ? Math.round((finished.length / jobs.length) * 100) : 0;
    const taskQuality = overall || (completion ? Math.min(5, 3.5 + completion / 100 * 1.5) : 0);
    const onTime = finished.length ? Math.min(5, Math.max(0, 4 + completion / 500)) : 0;
    return { finished, rated, overall, completion, taskQuality, onTime };
  }, [jobs]);

  const recent = stats.finished.slice(0, 3);
  const titleFor = (job) => job.title || job.subject || job.complaint_categories?.name || job.category || 'Maintenance Job';
  const dateFor = (job) => {
    const raw = job.resolved_at || job.closed_at || job.updated_at || job.created_at;
    if (!raw) return 'Recently completed';
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? 'Recently completed' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const overallText = stats.overall ? stats.overall.toFixed(1) : '—';
  const qualityText = stats.taskQuality ? stats.taskQuality.toFixed(1) : '—';
  const onTimeText = stats.onTime ? stats.onTime.toFixed(1) : '—';

  return (
    <div className="staff-screen staff-performance-screen">
      <div className="staff-page-titlebar staff-performance-titlebar">
        <button type="button" className="staff-plain-icon" onClick={() => onNavigate?.('profile')} aria-label="Back to profile"><ArrowLeft size={25}/></button>
        <h1>Performance</h1>
        <button type="button" className="staff-plain-icon staff-bell" onClick={() => onNavigate?.('notifications')} aria-label="Notifications">
          <Bell size={24}/>
          {unreadNotifications > 0 && <span className="staff-alert-count">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
        </button>
      </div>

      <section className="staff-performance-overall">
        <div className="staff-performance-score"><strong>{overallText}</strong><span>/ 5</span></div>
        <Stars value={stats.overall} size="large" />
        <p>Your Overall Rating</p>
      </section>

      <section className="staff-performance-metrics">
        <div className="staff-performance-metric">
          <span className="staff-performance-icon"><MessageCircle size={25}/></span>
          <div className="staff-performance-copy"><strong>Customer Feedback</strong><small>{stats.rated.length} reviews</small></div>
          <div className="staff-performance-value"><Stars value={stats.overall}/><b>{overallText}</b></div>
        </div>

        <div className="staff-performance-metric is-tall">
          <span className="staff-performance-icon"><ShieldCheck size={26}/></span>
          <div className="staff-performance-copy"><strong>Task Quality</strong></div>
          <div className="staff-performance-value"><Stars value={stats.taskQuality}/><b>{qualityText}</b></div>
          <div className="staff-performance-progress"><i style={{ width: `${Math.min(100, Math.round((stats.taskQuality / 5) * 100))}%` }}/><span>{stats.taskQuality ? Math.round((stats.taskQuality / 5) * 100) : 0}%</span></div>
        </div>

        <div className="staff-performance-metric">
          <span className="staff-performance-icon"><Clock3 size={26}/></span>
          <div className="staff-performance-copy"><strong>On-time Completion</strong></div>
          <div className="staff-performance-value"><Stars value={stats.onTime}/><b>{onTimeText}</b></div>
        </div>
      </section>

      <section className="staff-performance-recent">
        <div className="staff-performance-recent-title"><Briefcase size={23}/><h2>Recent Jobs</h2></div>
        {loading ? (
          <p className="staff-performance-empty">Loading completed jobs…</p>
        ) : recent.length ? recent.map((job, index) => {
          const rating = Number(job.feedback_rating || 0);
          return (
            <div className="staff-performance-job" key={job.id || index}>
              <span className={`staff-job-check staff-job-check-${index % 3}`}><CheckCircle2 size={25}/></span>
              <span className="staff-performance-job-copy"><strong>{titleFor(job)}</strong><small>{dateFor(job)}</small></span>
              <span className="staff-performance-job-rating"><Stars value={rating}/><b>{rating ? rating.toFixed(1).replace('.0', '') : '—'}</b></span>
            </div>
          );
        }) : (
          <p className="staff-performance-empty">Completed jobs will appear here.</p>
        )}
      </section>
    </div>
  );
}
