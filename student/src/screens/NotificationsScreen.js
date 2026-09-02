import { useEffect, useState } from 'react';
import { localData } from '@/lib/localDataClient';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui';
import { timeAgo } from '@/lib/constants';
import { Bell, CheckCheck, Wrench, AlertCircle, CheckCircle2, Clock, MessageSquare, Megaphone, Star } from 'lucide-react';

const TYPE_ICONS = {
    new_complaint: Wrench,
    assigned: Clock,
    status_changed: Clock,
    resolved: CheckCircle2,
    work_completed: CheckCircle2,
    feedback: Star,
    escalation: AlertCircle,
    info: Megaphone,
};

function withoutResolvedWord(value) {
    return String(value || '')
        .replace(/resolved/gi, (match) => match[0] === 'R' ? 'Closed' : 'closed')
        .replace(/resolution/gi, 'closure');
}

function studentNotificationTone(type) {
    if (type === 'work_completed' || type === 'resolved') return 'green';
    if (type === 'feedback') return 'gold';
    if (type === 'status_changed' || type === 'assigned') return 'blue';
    if (type === 'info') return 'bright';
    return 'slate';
}

export function NotificationsScreen({ onOpenComplaint }) {
    const { profile } = useAuthStore();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { void load(); }, [profile?.id]);

    const load = async () => {
        if (!profile?.id) return;
        const { data } = await localData
            .from('notifications')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(50);
        setNotifications(data || []);
        setLoading(false);
    };

    const markAllRead = async () => {
        await localData.from('notifications').update({ is_read: true }).eq('user_id', profile?.id).eq('is_read', false);
        void load();
    };

    const openNotification = async (notification) => {
        if (!notification.is_read) await localData.from('notifications').update({ is_read: true }).eq('id', notification.id);
        if (notification.related_id) {
            onOpenComplaint(notification.related_id);
            return;
        }
        void load();
    };

    if (loading) return <Spinner />;
    const unread = notifications.filter((notification) => !notification.is_read).length;

    if (profile?.role === 'student') {
        return (
          <div className="student-screen student-notifications-screen">
            <div className="student-notifications-heading">
              <h1>Notifications</h1>
              <button type="button" onClick={markAllRead} disabled={!unread}>Mark all as read</button>
            </div>

            <div className="student-notification-list">
              {!notifications.length ? (
                <div className="student-empty-card"><Bell size={30}/><strong>No notifications</strong><span>Campus and complaint updates will appear here.</span></div>
              ) : notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] || Bell;
                const tone = studentNotificationTone(notification.type);
                return <button type="button" key={notification.id} onClick={() => void openNotification(notification)} className={`student-notification-card ${notification.is_read ? 'is-read' : ''}`}>
                  <span className={`student-notification-icon ${tone}`}><Icon size={30}/></span>
                  <span className="student-notification-copy">
                    <strong>{withoutResolvedWord(notification.title)}</strong>
                    {notification.message && <p>{withoutResolvedWord(notification.message)}</p>}
                  </span>
                  <span className="student-notification-meta">{timeAgo(notification.created_at)}{!notification.is_read && <i/>}</span>
                </button>;
              })}
            </div>
          </div>
        );
    }

    return (<div className="max-w-3xl mx-auto">
      <PageHeader title="Notifications" subtitle={unread > 0 ? `${unread} unread` : 'All caught up'} action={unread > 0 && (<button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><CheckCheck className="w-4 h-4"/>Mark all read</button>)}/>
      {notifications.length === 0 ? (<Card className="p-0"><EmptyState icon={Bell} title="No notifications" description="You’ll see work updates that need your attention here."/></Card>) : (<div className="space-y-2">
        {notifications.map((notification) => {
            const Icon = TYPE_ICONS[notification.type] || Bell;
            return (<button key={notification.id} onClick={() => void openNotification(notification)} className={`w-full text-left ${!notification.is_read ? 'bg-blue-50/50' : ''}`}><Card className={`p-4 ${!notification.is_read ? 'border-blue-200' : ''} hover:shadow-sm transition-shadow`}><div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!notification.is_read ? 'bg-blue-100' : 'bg-slate-100'}`}><Icon className={`w-5 h-5 ${!notification.is_read ? 'text-blue-600' : 'text-slate-500'}`}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className={`text-sm ${!notification.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{withoutResolvedWord(notification.title)}</p>{!notification.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"/>}</div><p className="text-sm text-slate-600 mt-0.5">{withoutResolvedWord(notification.message)}</p><p className="text-xs text-slate-400 mt-1.5">{timeAgo(notification.created_at)}</p></div></div></Card></button>);
        })}
      </div>)}
    </div>);
}
