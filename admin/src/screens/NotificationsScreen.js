import { useEffect, useState } from 'react';
import { localData } from '@/lib/localDataClient';
import { useAuthStore } from '@/lib/auth';
import { Spinner, EmptyState } from '@/components/ui';
import { timeAgo } from '@/lib/constants';
import { Bell, CheckCircle2, ClipboardCheck, MessageSquare, Star, UserRound, Wrench } from 'lucide-react';

const TYPE_ICONS = {
  new_complaint: Wrench,
  assigned: MessageSquare,
  status_changed: CheckCircle2,
  resolved: CheckCircle2,
  work_completed: ClipboardCheck,
  feedback: Star,
  escalation: Bell,
  approval: ClipboardCheck,
  info: Bell,
};

const TYPE_LABELS = {
  new_complaint: 'Complaint',
  assigned: 'Complaint',
  status_changed: 'Work Order',
  resolved: 'Work Order',
  work_completed: 'Work Order',
  feedback: 'Feedback',
  approval: 'Work Order',
  escalation: 'Alert',
  info: 'Update',
};

export function NotificationsScreen({ onOpenComplaint }) {
  const { profile } = useAuthStore();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const clearAll = () => { void markAllRead(); };
    window.addEventListener('campusfix:clear-notifications', clearAll);
    return () => window.removeEventListener('campusfix:clear-notifications', clearAll);
  });

  const load = async () => {
    let query = localData.from('notifications').select('*').eq('user_id', profile?.id);
    if (profile?.role === 'student') query = query.eq('type', 'work_completed');
    const { data } = await query.order('created_at', { ascending: false }).limit(50);
    setNotifications(data || []);
    setLoading(false);
  };

  const markAllRead = async () => {
    let query = localData.from('notifications').update({ is_read: true }).eq('user_id', profile?.id).eq('is_read', false);
    if (profile?.role === 'student') query = query.eq('type', 'work_completed');
    await query;
    void load();
  };

  const openNotification = async (notification) => {
    if (!notification.is_read) await localData.from('notifications').update({ is_read: true }).eq('id', notification.id);
    if (notification.related_id) return onOpenComplaint(notification.related_id);
    void load();
  };

  if (loading) return <Spinner/>;

  const isAdmin = profile?.role === 'admin';
  const unread = notifications.filter((n) => !n.is_read).length;

  if (isAdmin) {
    return <div className="admin-screen admin-notifications-screen">
      <div className="admin-notification-actions"><span>{unread ? `${unread} unread` : 'Showing all.'}</span><button type="button" onClick={() => void markAllRead()}>Clear all</button></div>
      {notifications.length === 0 ? <div className="admin-empty-card"><EmptyState icon={Bell} title="No notifications" description="System alerts and work updates will appear here."/></div> : <div className="admin-notification-list">
        {notifications.map((n) => {
          const Icon = TYPE_ICONS[n.type] || UserRound;
          const tone = n.type === 'feedback' ? 'amber' : n.type === 'info' ? 'violet' : 'cyan';
          return <button type="button" key={n.id} onClick={() => void openNotification(n)} className={`admin-notification-card ${n.is_read ? 'is-read' : ''}`}>
            <span className={`admin-notification-icon ${tone}`}><Icon size={29}/></span>
            <div className="admin-notification-copy"><div><h3>{n.title}</h3><time>{timeAgo(n.created_at)}</time>{!n.is_read && <i className="admin-unread-dot"/>}</div><p>{n.message}</p><strong><span className="admin-dot"/>{TYPE_LABELS[n.type] || 'Update'}</strong></div>
          </button>;
        })}
      </div>}
      <div className="admin-list-foot">Showing all.</div>
    </div>;
  }

  return <div className="max-w-3xl mx-auto">
    <div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-bold text-slate-900">Notifications</h1><p className="text-sm text-slate-500">{unread > 0 ? `${unread} unread` : 'All caught up'}</p></div>{unread > 0 && <button onClick={markAllRead} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700">Mark all read</button>}</div>
    {notifications.length === 0 ? <div className="p-6"><EmptyState icon={Bell} title="No notifications"/></div> : <div className="space-y-2">{notifications.map((n) => <button key={n.id} onClick={() => void openNotification(n)} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left"><strong className="text-sm text-slate-900">{n.title}</strong><p className="text-sm text-slate-600 mt-1">{n.message}</p></button>)}</div>}
  </div>;
}
