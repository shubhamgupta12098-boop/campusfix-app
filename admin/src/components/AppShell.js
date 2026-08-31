import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import {
    BarChart3,
    Bell,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Home,
    LogOut,
    Menu,
    Plus,
    Search,
    Settings,
    ShieldCheck,
    Star,
    UserCircle,
    Users,
    Wrench,
    X,
} from 'lucide-react';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { ComplaintDetailScreen } from '@/screens/ComplaintDetailScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { ReportsScreen } from '@/screens/ReportsScreen';
import { UserManagementScreen } from '@/screens/UserManagementScreen';
import { AssignComplaintsScreen } from '@/screens/AssignComplaintsScreen';
import { WorkOrdersScreen } from '@/screens/WorkOrdersScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { FeedbackScreen } from '@/screens/FeedbackScreen';
import { ApprovalScreen } from '@/screens/ApprovalScreen';
import { supabase } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Home', description: 'Overview and recent activity', icon: Home, roles: ['student', 'staff', 'admin'] },
    { id: 'raise', label: 'Submit Complaint', description: 'Report a new campus issue', icon: Plus, roles: ['student'] },
    { id: 'my-complaints', label: 'Track Complaints', description: 'Follow your submitted requests', icon: ClipboardList, roles: ['student'] },
    { id: 'feedback', label: 'Feedback & Ratings', description: 'Rate completed maintenance work', icon: Star, roles: ['student', 'admin'] },
    { id: 'technician-jobs', label: 'My Jobs', description: 'Start and complete assigned work', icon: Wrench, roles: ['staff'] },
    { id: 'assign', label: 'Assign Complaints', description: 'Verify and route new complaints', icon: ClipboardList, roles: ['admin'] },
    { id: 'work-orders', label: 'Work Orders', description: 'Review maintenance records', icon: ClipboardList, roles: ['admin'] },
    { id: 'reports', label: 'Reports & Analytics', description: 'Performance and campus insights', icon: BarChart3, roles: ['admin', 'staff'] },
    { id: 'approvals', label: 'Work Approvals', description: 'Approve or return completed work', icon: Settings, roles: ['admin'] },
    { id: 'users', label: 'User Management', description: 'Manage people and access', icon: Users, roles: ['admin'] },
    { id: 'notifications', label: 'Notifications', description: 'Updates that need your attention', icon: Bell, roles: ['student', 'staff', 'admin'] },
    { id: 'profile', label: 'My Profile', description: 'Account, preferences and security', icon: UserCircle, roles: ['student', 'staff', 'admin'] },
];

const BOTTOM_NAV = {
    student: {
        // Keep Submit as its own navigation item. The centre + is only a quick
        // shortcut to start a fresh complaint, while notifications stay in the
        // top bell/drawer so the bottom bar matches the student flow.
        left: [
            { id: 'dashboard', label: 'Home', icon: Home },
            { id: 'raise', label: 'Submit', icon: ClipboardList },
        ],
        action: { id: 'raise', label: 'New', icon: Plus },
        right: [
            { id: 'my-complaints', label: 'Track', icon: ClipboardList },
            { id: 'profile', label: 'Profile', icon: UserCircle },
        ],
    },
    staff: {
        left: [
            { id: 'dashboard', label: 'Home', icon: Home },
            { id: 'reports', label: 'Reports', icon: BarChart3 },
        ],
        action: { id: 'technician-jobs', label: 'Jobs', icon: Wrench },
        right: [
            { id: 'notifications', label: 'Alerts', icon: Bell },
            { id: 'profile', label: 'Profile', icon: UserCircle },
        ],
    },
    admin: {
        // Keep every operational screen one tap away, as in the supplied admin UI.
        left: [
            { id: 'dashboard', label: 'Home', icon: Home },
            { id: 'approvals', label: 'Work Approvals', icon: ShieldCheck },
            { id: 'work-orders', label: 'Work Orders', icon: ClipboardList },
        ],
        action: { id: 'assign', label: 'Assign', icon: Plus },
        right: [
            { id: 'reports', label: 'Reports', icon: BarChart3 },
            { id: 'profile', label: 'My Profile', icon: UserCircle },
        ],
    },
};

const ROLE_LABELS = {
    student: 'Student portal',
    staff: 'Maintenance portal',
    admin: 'Administrator portal',
};

const ADMIN_SCREEN_TITLES = {
    dashboard: 'Campus Maintenance',
    approvals: 'Work Approvals',
    'work-orders': 'Work Orders',
    assign: 'Assign Complaints',
    reports: 'Reports',
    users: 'User Management',
    feedback: 'Feedback & Ratings',
    notifications: 'Notifications',
    profile: 'My Profile',
    'complaint-detail': 'Complaint Details',
};

const ADMIN_SIDEBAR_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'approvals', label: 'Work Approvals', icon: ShieldCheck },
    { id: 'work-orders', label: 'Work Orders', icon: ClipboardList },
    { id: 'assign', label: 'Assign', icon: Plus },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'feedback', label: 'Feedback', icon: Star },
    { id: 'notifications', label: 'Notifications', icon: Bell },
];

export const AppShell = () => {
    const { profile, signOut } = useAuthStore();
    const [screen, setScreen] = useState('dashboard');
    const [selectedComplaintId, setSelectedComplaintId] = useState(null);
    const [complaintReturnScreen, setComplaintReturnScreen] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [pendingApprovals, setPendingApprovals] = useState(0);
    const [sharedDataVersion, setSharedDataVersion] = useState(0);
    const role = profile?.role ?? 'student';
    const items = useMemo(() => NAV_ITEMS.filter((item) => item.roles.includes(role)), [role]);
    const bottomNav = BOTTOM_NAV[role] || BOTTOM_NAV.student;

    useEffect(() => {
        let refreshTimer = null;
        const refreshFromSharedData = () => {
            if (refreshTimer)
                window.clearTimeout(refreshTimer);
            refreshTimer = window.setTimeout(() => setSharedDataVersion((value) => value + 1), 120);
        };
        const onStorage = (event) => {
            if (event.key === 'campusfix_shared_data_signal')
                refreshFromSharedData();
        };
        let channel = null;
        try {
            channel = new BroadcastChannel('campusfix_shared_data_channel');
            channel.addEventListener('message', refreshFromSharedData);
        }
        catch {}
        window.addEventListener('storage', onStorage);
        return () => {
            if (refreshTimer)
                window.clearTimeout(refreshTimer);
            window.removeEventListener('storage', onStorage);
            try { channel?.close(); } catch {}
        };
    }, []);

    useEffect(() => {
        if (!profile?.id)
            return;
        let active = true;
        const loadUnread = async () => {
            let query = supabase.from('notifications').select('*').eq('user_id', profile.id).eq('is_read', false);
            // Students only receive a single actionable alert when completed
            // work is approved. Staff/admin keep their operational alerts.
            if (role === 'student')
                query = query.eq('type', 'work_completed');
            const result = await query;
            if (active)
                setUnreadNotifications(Array.isArray(result.data) ? result.data.length : 0);
            if (role === 'admin') {
                const approvals = await supabase.from('work_orders').select('*').eq('approval_status', 'pending');
                if (active)
                    setPendingApprovals(Array.isArray(approvals.data) ? approvals.data.length : 0);
            }
        };
        void loadUnread();
        const timer = window.setInterval(loadUnread, 15000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [profile?.id, role, screen, sharedDataVersion]);

    const navigate = (nextScreen) => {
        setScreen(nextScreen);
        setDrawerOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openComplaint = (id, returnScreen = screen) => {
        setSelectedComplaintId(id);
        setComplaintReturnScreen(returnScreen);
        setScreen('complaint-detail');
        setDrawerOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const activeScreen = screen === 'complaint-detail'
        ? role === 'student' ? 'my-complaints' : role === 'staff' ? 'technician-jobs' : 'assign'
        : role === 'admin' && ['users', 'notifications'].includes(screen) ? 'assign'
        : role === 'admin' && screen === 'feedback' ? 'reports'
        : screen;

    const initials = (profile?.full_name || 'CampusFix User')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const renderNavButton = ({ id, label, icon: Icon }) => {
        const active = activeScreen === id;
        const count = id === 'notifications' ? unreadNotifications : 0;
        return (<button
          key={id}
          type="button"
          onClick={() => navigate(id)}
          className={'campus-nav-item ' + (active ? 'is-active' : '')}
          aria-current={active ? 'page' : undefined}
        >
          <span className="campus-nav-icon">
            <Icon size={22} strokeWidth={active ? 2.6 : 2}/>
            {count > 0 && <span className="campus-nav-badge">{count > 9 ? '9+' : count}</span>}
          </span>
          <span>{label}</span>
        </button>);
    };

    const actionActive = activeScreen === bottomNav.action.id;
    const ActionIcon = bottomNav.action.icon;
    const adminPageTitle = ADMIN_SCREEN_TITLES[screen] || 'Campus Maintenance';
    const adminBackScreens = new Set(['notifications', 'users', 'feedback', 'profile', 'complaint-detail']);
    const showAdminBack = role === 'admin' && adminBackScreens.has(screen);
    const defaultComplaintReturn = role === 'student' ? 'my-complaints' : role === 'staff' ? 'technician-jobs' : 'assign';
    const adminBackTarget = screen === 'complaint-detail' ? (complaintReturnScreen || defaultComplaintReturn) : 'dashboard';

    return (<div className={'campus-app-shell ' + (role === 'admin' ? `admin-ui admin-screen-${screen} ` : '') + (role === 'admin' && screen === 'profile' ? 'admin-profile-mode ' : '') + (role === 'admin' && showAdminBack ? 'admin-has-back ' : '')}>
      <div className="campus-app-frame">
        {role === 'admin' && (
          <aside className="admin-desktop-sidebar" aria-label="Admin navigation">
            <button type="button" className="admin-sidebar-brand" onClick={() => navigate('dashboard')}>
              <span className="admin-brand-mark">CM</span>
              <span><strong>Campus Maintenance</strong><small>Admin Panel</small></span>
            </button>
            <nav className="admin-sidebar-nav">
              {ADMIN_SIDEBAR_ITEMS.map(({ id, label, icon: Icon }) => {
                const active = activeScreen === id;
                const count = id === 'notifications' ? unreadNotifications : id === 'approvals' ? pendingApprovals : 0;
                return (
                  <button key={id} type="button" onClick={() => navigate(id)} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
                    <Icon size={19} strokeWidth={active ? 2.5 : 2}/>
                    <span>{label}</span>
                    {count > 0 && <b>{count > 99 ? '99+' : count}</b>}
                  </button>
                );
              })}
            </nav>
            <button type="button" className={'admin-sidebar-profile ' + (activeScreen === 'profile' ? 'is-active' : '')} onClick={() => navigate('profile')}>
              <span className="admin-sidebar-avatar">{initials}</span>
              <span><strong>{profile?.full_name || 'Admin User'}</strong><small>Administrator</small></span>
            </button>
          </aside>
        )}

        <header className="campus-topbar">
          {role === 'admin' ? (
            <>
              {showAdminBack ? (
                <button type="button" onClick={() => navigate(adminBackTarget)} className="campus-icon-button admin-mobile-menu admin-back-button" aria-label="Go back">
                  <ChevronLeft size={30}/>
                </button>
              ) : (
                <button type="button" onClick={() => setDrawerOpen(true)} className="campus-icon-button admin-mobile-menu admin-menu-button" aria-label="Open app menu">
                  <Menu size={22}/>
                </button>
              )}
              <div className="admin-topbar-copy">
                <p>ADMIN CONSOLE</p>
                <h1>{adminPageTitle}</h1>
              </div>
              <div className="campus-topbar-actions admin-topbar-actions">
                <label className="admin-global-search">
                  <Search size={17}/>
                  <input type="search" placeholder="Search..." aria-label="Search"/>
                </label>
                {screen === 'notifications' ? (
                  <button
                    type="button"
                    className="admin-clear-all-header"
                    onClick={() => window.dispatchEvent(new CustomEvent('campusfix:clear-notifications'))}
                  >
                    Clear all
                  </button>
                ) : (
                  <button type="button" onClick={() => navigate('notifications')} className="campus-icon-button campus-alert-button" aria-label="Open notifications">
                    <Bell size={25}/>
                    {unreadNotifications > 0 && <span>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
                  </button>
                )}
                {screen !== 'notifications' && <button type="button" onClick={() => navigate('profile')} className="campus-mini-avatar" aria-label="Open profile">{initials}</button>}
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setDrawerOpen(true)} className="campus-icon-button" aria-label="Open app menu">
                <Menu size={22}/>
              </button>

              <button type="button" onClick={() => navigate('dashboard')} className="campus-brand" aria-label="Go to CampusFix home">
                <span className="campus-brand-mark campus-brand-logo"><img src={`${import.meta.env.BASE_URL}cmms-logo.png`} alt="CCMMS"/></span>
                <span>
                  <strong>CCMMS</strong>
                  <small>{ROLE_LABELS[role]}</small>
                </span>
              </button>

              <div className="campus-topbar-actions">
                <button type="button" onClick={() => navigate('notifications')} className="campus-icon-button campus-alert-button" aria-label="Open notifications">
                  <Bell size={22}/>
                  {unreadNotifications > 0 && <span>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
                </button>
                <button type="button" onClick={() => navigate('profile')} className="campus-mini-avatar" aria-label="Open profile">{initials}</button>
              </div>
            </>
          )}
        </header>

        <main className="campus-page-content" data-screen={screen}>
          <ErrorBoundary key={`${screen}-${sharedDataVersion}`} resetKey={`${screen}-${sharedDataVersion}`}>
            {screen === 'dashboard' && <DashboardScreen onNavigate={navigate} onOpenComplaint={openComplaint}/>}
            {screen === 'complaint-detail' && selectedComplaintId && (<ComplaintDetailScreen complaintId={selectedComplaintId} onBack={() => navigate(complaintReturnScreen || defaultComplaintReturn)}/>)}
            {screen === 'notifications' && <NotificationsScreen onOpenComplaint={openComplaint}/>}
            {screen === 'reports' && <ReportsScreen onNavigate={navigate}/>}
            {screen === 'users' && <UserManagementScreen/>}
            {screen === 'assign' && <AssignComplaintsScreen onOpenComplaint={openComplaint}/>}
            {screen === 'work-orders' && <WorkOrdersScreen onOpenComplaint={openComplaint}/>}
            {screen === 'approvals' && <ApprovalScreen onOpenComplaint={openComplaint}/>}
            {screen === 'profile' && <ProfileScreen onNavigate={navigate}/>}
            {screen === 'feedback' && <FeedbackScreen onOpenComplaint={(id) => openComplaint(id, 'feedback')}/>}
          </ErrorBoundary>
        </main>

        <nav className="campus-bottom-nav" aria-label="Primary navigation">
          {role === 'admin' ? (
            [...bottomNav.left, bottomNav.action, ...bottomNav.right].map(renderNavButton)
          ) : (
            <>
              {bottomNav.left.map(renderNavButton)}
              <button
                type="button"
                onClick={() => navigate(bottomNav.action.id)}
                className={'campus-quick-action ' + (actionActive ? 'is-active' : '')}
                aria-label={bottomNav.action.label}
                aria-current={actionActive ? 'page' : undefined}
              >
                <ActionIcon size={role === 'student' ? 31 : 27}/>
                <span>{bottomNav.action.label}</span>
              </button>
              {bottomNav.right.map(renderNavButton)}
            </>
          )}
        </nav>
      </div>

      <div className={'campus-drawer-layer ' + (drawerOpen ? 'is-open' : '')} aria-hidden={!drawerOpen}>
        <button type="button" className="campus-drawer-scrim" onClick={() => setDrawerOpen(false)} aria-label="Close app menu"/>
        <aside className="campus-drawer" aria-label="All CampusFix sections">
          <div className="campus-drawer-header">
            <div className="campus-brand-mark"><ShieldCheck size={27} strokeWidth={2.5}/></div>
            <div className="campus-drawer-brand"><img src={`${import.meta.env.BASE_URL}cmms-logo.png`} alt="CCMMS"/><div><strong>CCMMS</strong><span>Complaint &amp; Maintenance</span></div></div>
            <button type="button" onClick={() => setDrawerOpen(false)} className="campus-icon-button" aria-label="Close app menu"><X size={21}/></button>
          </div>

          <div className="campus-drawer-user">
            <div className="campus-drawer-avatar">{initials}</div>
            <div><strong>{profile?.full_name || 'CampusFix User'}</strong><span>{profile?.college_id || ROLE_LABELS[role]}</span></div>
          </div>

          <nav className="campus-drawer-nav">
            {items.map((item) => {
                const Icon = item.icon;
                const active = activeScreen === item.id;
                return (<button key={item.id} type="button" onClick={() => navigate(item.id)} className={active ? 'is-active' : ''}>
                  <span className="campus-drawer-icon"><Icon size={19}/></span>
                  <span className="campus-drawer-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                  {item.id === 'notifications' && unreadNotifications > 0
                    ? <span className="campus-drawer-count">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
                    : <ChevronRight size={17}/>}
                </button>);
            })}
          </nav>

          <button type="button" onClick={signOut} className="campus-sign-out"><LogOut size={18}/> Sign out</button>
        </aside>
      </div>
    </div>);
};
