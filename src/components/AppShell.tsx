import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import type { UserRole } from '@/lib/supabase';
import { LayoutDashboard, PlusCircle, ListChecks, Bell, Package, CalendarCheck, BarChart3, Users, Wrench, ClipboardList, Settings, LogOut, Menu, X, UserCircle } from 'lucide-react';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { RaiseComplaintScreen } from '@/screens/RaiseComplaintScreen';
import { MyComplaintsScreen } from '@/screens/MyComplaintsScreen';
import { ComplaintDetailScreen } from '@/screens/ComplaintDetailScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { InventoryScreen } from '@/screens/InventoryScreen';
import { PreventiveScreen } from '@/screens/PreventiveScreen';
import { ReportsScreen } from '@/screens/ReportsScreen';
import { UserManagementScreen } from '@/screens/UserManagementScreen';
import { TechnicianJobsScreen } from '@/screens/TechnicianJobsScreen';
import { AssignComplaintsScreen } from '@/screens/AssignComplaintsScreen';
import { WorkOrdersScreen } from '@/screens/WorkOrdersScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { supabase } from '@/lib/supabase';

type Screen =
  | 'dashboard'
  | 'raise'
  | 'my-complaints'
  | 'complaint-detail'
  | 'notifications'
  | 'inventory'
  | 'preventive'
  | 'reports'
  | 'users'
  | 'technician-jobs'
  | 'assign'
  | 'work-orders'
  | 'profile';

interface NavItem {
  id: Screen;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['student', 'staff', 'admin'] },
  { id: 'raise', label: 'Raise Complaint', icon: PlusCircle, roles: ['student'] },
  { id: 'my-complaints', label: 'My Complaints', icon: ListChecks, roles: ['student'] },
  { id: 'technician-jobs', label: 'My Jobs', icon: Wrench, roles: ['staff'] },
  { id: 'assign', label: 'Assign Complaints', icon: ClipboardList, roles: ['admin', 'staff'] },
  { id: 'work-orders', label: 'Work Orders', icon: ClipboardList, roles: ['admin', 'staff'] },
  { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin', 'staff'] },
  { id: 'preventive', label: 'Preventive Maint.', icon: CalendarCheck, roles: ['admin', 'staff'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'staff'] },
  { id: 'users', label: 'User Management', icon: Users, roles: ['admin'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['student', 'staff', 'admin'] },
  { id: 'profile', label: 'My Profile', icon: UserCircle, roles: ['student', 'staff', 'admin'] },
];

export const AppShell = () => {
  const { profile, signOut } = useAuthStore();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const role = (profile?.role ?? 'student') as UserRole;
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    const loadUnread = async () => {
      const result = await supabase.from('notifications').select('*').eq('user_id', profile.id).eq('is_read', false);
      if (active) setUnreadNotifications(Array.isArray(result.data) ? result.data.length : 0);
    };
    void loadUnread();
    const timer = window.setInterval(loadUnread, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [profile?.id, screen]);

  const openComplaint = (id: string) => {
    setSelectedComplaintId(id);
    setScreen('complaint-detail');
  };

  const navigate = (s: Screen) => {
    setScreen(s);
    setSidebarOpen(false);
  };

  const roleLabel: Record<UserRole, string> = {
    student: 'Student',
    staff: 'Staff',
    admin: 'Administrator',
  };

  const initials = (profile?.full_name || '?')
    .split(' ')
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-600/20">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">CampusFix</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">{roleLabel[role]} Portal</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = screen === item.id || (item.id === 'my-complaints' && screen === 'complaint-detail');
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === 'notifications' && unreadNotifications > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{profile?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{profile?.college_id || ''}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-[18px] h-[18px] text-slate-400" />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 h-16 bg-white border-b border-slate-200 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">CampusFix</span>
          </div>
          <button onClick={() => navigate('notifications')} className="relative text-slate-600 p-1">
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {screen === 'dashboard' && <DashboardScreen onNavigate={navigate} onOpenComplaint={openComplaint} />}
          {screen === 'raise' && <RaiseComplaintScreen onDone={() => navigate('my-complaints')} />}
          {screen === 'my-complaints' && <MyComplaintsScreen onOpenComplaint={openComplaint} />}
          {screen === 'complaint-detail' && selectedComplaintId && (
            <ComplaintDetailScreen complaintId={selectedComplaintId} onBack={() => navigate('my-complaints')} />
          )}
          {screen === 'notifications' && <NotificationsScreen />}
          {screen === 'inventory' && <InventoryScreen />}
          {screen === 'preventive' && <PreventiveScreen />}
          {screen === 'reports' && <ReportsScreen />}
          {screen === 'users' && <UserManagementScreen />}
          {screen === 'technician-jobs' && <TechnicianJobsScreen onOpenComplaint={openComplaint} />}
          {screen === 'assign' && <AssignComplaintsScreen />}
          {screen === 'work-orders' && <WorkOrdersScreen />}
          {screen === 'profile' && <ProfileScreen />}
        </main>
      </div>
    </div>
  );
};
