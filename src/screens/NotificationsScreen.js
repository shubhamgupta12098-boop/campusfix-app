import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui';
import { timeAgo } from '@/lib/constants';
import { Bell, CheckCheck, Wrench, AlertCircle, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
const TYPE_ICONS = {
    new_complaint: Wrench,
    assigned: Clock,
    status_changed: CheckCircle2,
    resolved: CheckCircle2,
    work_completed: CheckCircle2,
    feedback: MessageSquare,
    escalation: AlertCircle,
    info: Bell,
};
export function NotificationsScreen({ onOpenComplaint }) {
    const { profile } = useAuthStore();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        void load();
    }, []);
    const load = async () => {
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', profile?.id);
        if (profile?.role === 'student')
            query = query.eq('type', 'work_completed');
        const { data } = await query
            .order('created_at', { ascending: false })
            .limit(50);
        setNotifications((data || []));
        setLoading(false);
    };
    const markAllRead = async () => {
        let query = supabase.from('notifications').update({ is_read: true }).eq('user_id', profile?.id).eq('is_read', false);
        if (profile?.role === 'student')
            query = query.eq('type', 'work_completed');
        await query;
        void load();
    };
    const openNotification = async (notification) => {
        if (!notification.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
        }
        if (notification.related_id) {
            onOpenComplaint(notification.related_id);
            return;
        }
        void load();
    };
    if (loading)
        return <Spinner />;
    const unread = notifications.filter((n) => !n.is_read).length;
    return (<div className="max-w-3xl mx-auto">
      <PageHeader title="Notifications" subtitle={unread > 0 ? `${unread} unread` : 'All caught up'} action={unread > 0 && (<button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              <CheckCheck className="w-4 h-4"/>
              Mark all read
            </button>)}/>

      {notifications.length === 0 ? (<Card className="p-0">
          <EmptyState icon={Bell} title="No notifications" description={profile?.role === 'student' ? "You'll get one alert here when your complaint work is completed." : "You'll see work updates that need your attention here."}/>
        </Card>) : (<div className="space-y-2">
          {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                return (<button key={n.id} onClick={() => void openNotification(n)} className={`w-full text-left ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                <Card className={`p-4 ${!n.is_read ? 'border-blue-200' : ''} hover:shadow-sm transition-shadow`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!n.is_read ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <Icon className={`w-5 h-5 ${!n.is_read ? 'text-blue-600' : 'text-slate-500'}`}/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!n.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"/>}
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                      <div className="flex items-center justify-between gap-3 mt-1.5"><p className="text-xs text-slate-400">{timeAgo(n.created_at)}</p>{n.related_id && <span className="text-xs font-semibold text-blue-600">View complaint →</span>}</div>
                    </div>
                  </div>
                </Card>
              </button>);
            })}
        </div>)}
    </div>);
}
