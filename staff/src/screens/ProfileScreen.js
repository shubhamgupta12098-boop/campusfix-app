import { useEffect, useState } from 'react';
import { localData } from '@/lib/localDataClient';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate, timeAgo } from '@/lib/constants';
import { User, Mail, Phone, Building2, Home, DoorOpen, BadgeCheck, Shield, ShieldCheck, Edit3, X, Save, ClipboardList, CheckCircle2, Clock, Star, Wrench, TrendingUp, Calendar, Award, Activity, KeyRound, Lock, Eye, EyeOff, Moon, Sun, ArrowLeft, ChevronRight, Bell, HelpCircle, LogOut, MessageCircle, Settings } from 'lucide-react';
const ROLE_LABELS = {
    student: 'Student',
    staff: 'Staff',
    admin: 'Administrator',
};
const ROLE_COLORS = {
    student: { bg: 'bg-blue-50', text: 'text-blue-700', gradient: 'from-blue-500 to-blue-600' },
    staff: { bg: 'bg-cyan-50', text: 'text-cyan-700', gradient: 'from-cyan-500 to-cyan-600' },
    admin: { bg: 'bg-rose-50', text: 'text-rose-700', gradient: 'from-rose-500 to-rose-600' },
};
export function ProfileScreen({ onNavigate, unreadNotifications = 0 }) {
    const { profile, user, refreshProfile, signOut, changePassword, changeEmail } = useAuthStore();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [pwOpen, setPwOpen] = useState(false);
    const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const [pwError, setPwError] = useState(null);
    const [pwSuccess, setPwSuccess] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cmms_dark_mode') === 'true');
    const [form, setForm] = useState({
        full_name: profile?.full_name || '',
        email: user?.email || profile?.email || '',
        current_password: '',
        college_id: profile?.college_id || '',
        department: profile?.department || '',
        hostel: profile?.hostel || '',
        block: profile?.block || '',
        room: profile?.room || '',
        phone: profile?.phone || '',
    });
    useEffect(() => {
        void loadComplaints();
    }, []);
    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('cmms_dark_mode', String(darkMode));
    }, [darkMode]);
    const loadComplaints = async () => {
        let query = localData
            .from('complaints')
            .select('*, complaint_categories(*)')
            .order('created_at', { ascending: false });
        if (profile?.role === 'student')
            query = query.eq('user_id', profile?.id);
        else if (profile?.role === 'staff')
            query = query.eq('assigned_to', profile?.id);
        const { data } = await query;
        setComplaints((data || []));
        setLoading(false);
    };
    const handleSave = async (e) => {
        e.preventDefault();
        setSaveError(null);
        setSaveSuccess(false);
        setSaving(true);
        try {
            const emailChanged = role === 'student' && form.email.trim().toLowerCase() !== (user?.email || '').toLowerCase();
            if (emailChanged) {
                if (!form.current_password) {
                    setSaveError('Current password is required to change your email.');
                    setSaving(false);
                    return;
                }
                const { error } = await changeEmail(form.current_password, form.email);
                if (error) {
                    setSaveError(error);
                    setSaving(false);
                    return;
                }
            }
            const profileUpdates = {
                full_name: form.full_name,
                college_id: form.college_id,
                department: form.department,
                hostel: form.hostel,
                block: form.block,
                room: form.room,
                phone: form.phone,
                updated_at: new Date().toISOString(),
            };
            const { error } = await localData.from('profiles').update(profileUpdates).eq('id', profile?.id);
            if (error)
                throw error;
            await refreshProfile();
            setSaveSuccess(true);
            setForm((current) => ({ ...current, current_password: '', email: form.email.trim().toLowerCase() }));
            setTimeout(() => {
                setEditing(false);
                setSaveSuccess(false);
            }, 900);
        }
        catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Could not save profile. Please try again.');
        }
        finally {
            setSaving(false);
        }
    };
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwError(null);
        if (!pwForm.current) {
            setPwError('Enter your current password.');
            return;
        }
        if (pwForm.new.length < 6) {
            setPwError('New password must be at least 8 characters.');
            return;
        }
        if (pwForm.new !== pwForm.confirm) {
            setPwError('New passwords do not match.');
            return;
        }
        setPwSaving(true);
        const { error: updateErr } = await changePassword(pwForm.current, pwForm.new);
        setPwSaving(false);
        if (updateErr) {
            setPwError(updateErr);
        }
        else {
            setPwSuccess(true);
            setPwForm({ current: '', new: '', confirm: '' });
            setTimeout(() => {
                setPwSuccess(false);
                setPwOpen(false);
            }, 2000);
        }
    };
    if (loading)
        return <Spinner />;
    const role = profile?.role ?? 'student';
    const roleCfg = ROLE_COLORS[role];
    const initials = (profile?.full_name || '?')
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    const total = complaints.length;
    const resolved = complaints.filter((c) => c.status === 'resolved' || c.status === 'closed').length;
    const open = complaints.filter((c) => !['closed', 'resolved', 'rejected'].includes(c.status)).length;
    const avgRating = (() => {
        const rated = complaints.filter((c) => c.feedback_rating);
        if (rated.length === 0)
            return 0;
        return (rated.reduce((sum, c) => sum + (c.feedback_rating || 0), 0) / rated.length).toFixed(1);
    })();
    const recentComplaints = complaints.slice(0, 5);
    if (role === 'admin') {
        const openEditor = () => {
            setSaveError(null);
            setForm({
                full_name: profile?.full_name || '',
                email: user?.email || profile?.email || '',
                current_password: '',
                college_id: profile?.college_id || '',
                department: profile?.department || '',
                hostel: profile?.hostel || '',
                block: profile?.block || '',
                room: profile?.room || '',
                phone: profile?.phone || '',
            });
            setEditing(true);
        };
        return (<AdminProfilePage
          profile={profile}
          user={user}
          total={total}
          avgRating={avgRating}
          onBack={() => onNavigate?.('dashboard')}
          onNotifications={() => onNavigate?.('notifications')}
          onEdit={openEditor}
          onPassword={() => setPwOpen(true)}
          onLogout={signOut}
          editing={editing}
          setEditing={setEditing}
          form={form}
          setForm={setForm}
          saving={saving}
          saveError={saveError}
          saveSuccess={saveSuccess}
          handleSave={handleSave}
          pwOpen={pwOpen}
          setPwOpen={setPwOpen}
          pwForm={pwForm}
          setPwForm={setPwForm}
          pwSaving={pwSaving}
          pwError={pwError}
          pwSuccess={pwSuccess}
          showPw={showPw}
          setShowPw={setShowPw}
          handleChangePassword={handleChangePassword}
        />);
    }
    if (role === 'staff') {
        const completionRate = total ? Math.round((resolved / total) * 100) : 0;
        const openEditor = () => {
            setSaveError(null);
            setForm({
                full_name: profile?.full_name || '',
                email: user?.email || profile?.email || '',
                current_password: '',
                college_id: profile?.college_id || '',
                department: profile?.department || '',
                hostel: profile?.hostel || '',
                block: profile?.block || '',
                room: profile?.room || '',
                phone: profile?.phone || '',
            });
            setEditing(true);
        };
        return (<div className="staff-screen staff-profile-screen">
          <div className="staff-page-titlebar">
            <button type="button" className="staff-plain-icon" onClick={() => onNavigate?.('dashboard')} aria-label="Back"><ArrowLeft size={23}/></button>
            <h1>My Profile</h1>
            <button type="button" className="staff-plain-icon staff-bell" onClick={() => onNavigate?.('notifications')} aria-label="Notifications"><Bell size={22}/>{unreadNotifications > 0 && <span className="staff-alert-count">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}</button>
          </div>

          <section className="staff-profile-hero">
            <div className="staff-profile-avatar">{initials}</div>
            <button type="button" className="staff-avatar-edit" onClick={openEditor} aria-label="Edit profile"><Edit3 size={13}/></button>
            <h2>{profile?.full_name || 'Maintenance Staff'}</h2>
            <p>{profile?.department || 'Campus Maintenance Staff'}</p>
            <small>{profile?.college_id ? `Employee ID: ${profile.college_id}` : 'Campus Maintenance Team'}</small>
          </section>

          <section className="staff-profile-list">
            <button type="button" onClick={openEditor} className="staff-profile-row">
              <span className="staff-profile-row-icon"><Building2 size={20}/></span>
              <span><small>Department</small><strong>{profile?.department || 'Maintenance Services'}</strong></span>
              <ChevronRight size={17}/>
            </button>

            <div className="staff-profile-row staff-profile-progress-row">
              <span className="staff-profile-row-icon"><CheckCircle2 size={20}/></span>
              <span><small>Task Completion</small><strong>{resolved} / {total || 0} jobs completed</strong><i><b style={{ width: `${completionRate}%` }}/></i></span>
              <em>{completionRate}%</em>
            </div>

            <div className="staff-profile-row">
              <span className="staff-profile-row-icon"><Star size={20}/></span>
              <span><small>Performance</small><strong>{avgRating || '—'} / 5</strong><i className="staff-stars">★★★★★</i></span>
              <em>{avgRating || '—'}</em>
            </div>

            <button type="button" onClick={openEditor} className="staff-profile-row">
              <span className="staff-profile-row-icon"><Phone size={20}/></span>
              <span><small>Contact</small><strong>{profile?.phone || 'Add phone number'}</strong><b className="staff-profile-secondary">{user?.email || profile?.email || '—'}</b></span>
              <ChevronRight size={17}/>
            </button>

            <button type="button" onClick={() => setPwOpen(true)} className="staff-profile-row">
              <span className="staff-profile-row-icon"><KeyRound size={20}/></span>
              <span><small>App Settings</small><strong>Password & account security</strong></span>
              <ChevronRight size={17}/>
            </button>
          </section>

          <button type="button" onClick={signOut} className="staff-signout"><LogOut size={18}/> Sign out</button>

          {editing && <div className="admin-dark-modal-layer" onClick={() => setEditing(false)}>
            <div className="admin-dark-modal" onClick={(event) => event.stopPropagation()}>
              <div className="admin-dark-modal-header"><h3>Edit Profile</h3><button type="button" onClick={() => setEditing(false)}><X size={20}/></button></div>
              <form onSubmit={handleSave} className="admin-dark-form">
                {saveError && <div className="admin-dark-error">{saveError}</div>}
                {saveSuccess && <div className="admin-dark-success-inline">Profile updated successfully.</div>}
                <AdminDarkField label="Full Name"><input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required/></AdminDarkField>
                <AdminDarkField label="Email"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></AdminDarkField>
                <div className="admin-dark-form-row">
                  <AdminDarkField label="Employee ID"><input value={form.college_id} onChange={(event) => setForm({ ...form, college_id: event.target.value })}/></AdminDarkField>
                  <AdminDarkField label="Department"><input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}/></AdminDarkField>
                </div>
                <AdminDarkField label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></AdminDarkField>
                <button className="admin-dark-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </form>
            </div>
          </div>}

          {pwOpen && <div className="admin-dark-modal-layer" onClick={() => setPwOpen(false)}>
            <div className="admin-dark-modal" onClick={(event) => event.stopPropagation()}>
              <div className="admin-dark-modal-header"><h3>Change Password</h3><button type="button" onClick={() => setPwOpen(false)}><X size={20}/></button></div>
              {pwSuccess ? (<div className="admin-dark-success"><CheckCircle2 size={35}/><strong>Password updated</strong><span>Your password was changed successfully.</span></div>) : (<form onSubmit={handleChangePassword} className="admin-dark-form">
                {pwError && <div className="admin-dark-error">{pwError}</div>}
                <AdminDarkField label="Current Password"><input type={showPw ? 'text' : 'password'} value={pwForm.current} onChange={(event) => setPwForm({ ...pwForm, current: event.target.value })} required/></AdminDarkField>
                <AdminDarkField label="New Password"><input type={showPw ? 'text' : 'password'} value={pwForm.new} onChange={(event) => setPwForm({ ...pwForm, new: event.target.value })} required minLength={8}/></AdminDarkField>
                <AdminDarkField label="Confirm Password"><input type={showPw ? 'text' : 'password'} value={pwForm.confirm} onChange={(event) => setPwForm({ ...pwForm, confirm: event.target.value })} required/></AdminDarkField>
                <button type="button" className="admin-dark-ghost-btn" onClick={() => setShowPw((value) => !value)}>{showPw ? <EyeOff size={16}/> : <Eye size={16}/>} {showPw ? 'Hide passwords' : 'Show passwords'}</button>
                <button className="admin-dark-primary" type="submit" disabled={pwSaving}>{pwSaving ? 'Updating…' : 'Update Password'}</button>
              </form>)}
            </div>
          </div>}
        </div>);
    }
    return (<div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4"><PageHeader title="My Profile" subtitle="Manage your account and view your activity"/><button onClick={() => setDarkMode(v => !v)} className="mt-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{darkMode ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}{darkMode ? 'Light Mode' : 'Dark Mode'}</button></div>

      {/* Profile header card */}
      <Card className="overflow-hidden mb-6">
        <div className={`h-24 sm:h-28 bg-gradient-to-r ${roleCfg.gradient} relative`}>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.45) 0%, transparent 60%)' }}/>
        </div>

        <div className="px-5 sm:px-6 pb-6">
          <div className="relative pt-14 sm:pt-16">
            <div className={`absolute -top-11 left-0 w-[5.5rem] h-[5.5rem] sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br ${roleCfg.gradient} flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-white`}>
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">{profile?.full_name}</h2>
                <Badge className={`${roleCfg.bg} ${roleCfg.text}`}>
                  <Shield className="w-3 h-3"/>
                  {ROLE_LABELS[role]}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1 break-words">{profile?.college_id || 'No college ID'} {profile?.department && `· ${profile.department}`}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <button onClick={() => { setSaveError(null); setForm({ full_name: profile?.full_name || '', email: user?.email || profile?.email || '', current_password: '', college_id: profile?.college_id || '', department: profile?.department || '', hostel: profile?.hostel || '', block: profile?.block || '', room: profile?.room || '', phone: profile?.phone || '' }); setEditing(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <Edit3 className="w-4 h-4"/> Edit Profile
              </button>
              <button onClick={() => setPwOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <KeyRound className="w-4 h-4"/> Change Password
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MiniStat icon={ClipboardList} label="Total Complaints" value={total} color="blue"/>
        <MiniStat icon={Clock} label="Open" value={open} color="amber"/>
        <MiniStat icon={CheckCircle2} label="Closed" value={resolved} color="emerald"/>
        <MiniStat icon={Star} label="Avg Rating" value={avgRating || '—'} color="violet"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal details */}
        <div className="lg:col-span-1">
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4">Personal Details</h3>
            <div className="space-y-4">
              <DetailRow icon={Mail} label="Email" value={user?.email || '—'}/>
              <DetailRow icon={BadgeCheck} label="College ID" value={profile?.college_id || '—'}/>
              <DetailRow icon={Building2} label="Department" value={profile?.department || '—'}/>
              <DetailRow icon={Phone} label="Phone" value={profile?.phone || '—'}/>
              {role === 'student' && (<>
                  <DetailRow icon={Home} label="Hostel" value={profile?.hostel || '—'}/>
                  <DetailRow icon={Building2} label="Block" value={profile?.block || '—'}/>
                  <DetailRow icon={DoorOpen} label="Room" value={profile?.room || '—'}/>
                </>)}
              <DetailRow icon={Calendar} label="Member Since" value={formatDate(profile?.created_at)}/>
            </div>
          </Card>
        </div>

        {/* Activity */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4">Recent Activity</h3>
            {recentComplaints.length === 0 ? (<div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <Activity className="w-7 h-7 text-slate-400"/>
                </div>
                <p className="text-sm font-semibold text-slate-700">No activity yet</p>
                <p className="text-xs text-slate-500 mt-1">Your complaints will appear here.</p>
              </div>) : (<div className="space-y-2">
                {recentComplaints.map((c) => {
                const sc = STATUS_CONFIG[c.status];
                const pc = PRIORITY_CONFIG[c.priority];
                return (<div key={c.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.complaint_categories?.color || '#3B82F6') + '15' }}>
                        <Wrench className="w-4 h-4" style={{ color: c.complaint_categories?.color || '#3B82F6' }}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.title}</p>
                        <p className="text-xs text-slate-500">{c.complaint_no} · {timeAgo(c.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge className={`${pc.bg} ${pc.color} border ${pc.border} text-[10px]`}>{pc.label}</Badge>
                        <Badge className={`${sc.bg} ${sc.color} text-[10px]`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>
                          {sc.label}
                        </Badge>
                      </div>
                    </div>);
            })}
              </div>)}
          </Card>

          {/* Achievement-style summary */}
          <Card className="p-5 mt-6">
            <h3 className="font-bold text-slate-900 mb-4">Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <SummaryItem icon={TrendingUp} label="Closure Rate" value={total > 0 ? `${Math.round((resolved / total) * 100)}%` : '—'}/>
              <SummaryItem icon={Award} label="Feedback Given" value={`${complaints.filter((c) => c.feedback_rating).length}`}/>
              <SummaryItem icon={Activity} label="This Month" value={`${complaints.filter((c) => new Date(c.created_at).getMonth() === new Date().getMonth()).length}`}/>
              <SummaryItem icon={ClipboardList} label="Total Filed" value={`${total}`}/>
            </div>
          </Card>
        </div>
      </div>

      {/* Change password modal */}
      {pwOpen && (<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPwOpen(false)}>
          <Card className="p-6 w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-blue-600"/>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Change Password</h3>
                </div>
                <button onClick={() => setPwOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5"/>
                </button>
              </div>

              {pwSuccess ? (<div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600"/>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Password updated!</p>
                  <p className="text-sm text-slate-500 mt-1">Your password has been changed successfully.</p>
                </div>) : (<form onSubmit={handleChangePassword} className="space-y-3">
                  {pwError && (<div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <X className="w-4 h-4 flex-shrink-0"/>
                      {pwError}
                    </div>)}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Current Password</label>
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                      <input type={showPw ? 'text' : 'password'} value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} required placeholder="••••••••" className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">New Password</label>
                    <div className="relative">
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <Lock className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                        <input type={showPw ? 'text' : 'password'} value={pwForm.new} onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })} required minLength={8} placeholder="••••••••" className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                        <button type="button" onClick={() => setShowPw(!showPw)} className="text-slate-400 hover:text-slate-600">
                          {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Confirm New Password</label>
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                      <input type={showPw ? 'text' : 'password'} value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required placeholder="••••••••" className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={pwSaving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                      <KeyRound className="w-4 h-4"/>
                      {pwSaving ? 'Updating…' : 'Update Password'}
                    </button>
                    <button type="button" onClick={() => setPwOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </form>)}
            </div>
          </Card>
        </div>)}

      {/* Edit modal */}
      {editing && (<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <Card className="p-6 w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-900">Edit Profile</h3>
                <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <form onSubmit={handleSave} className="space-y-3">
                {saveError && (<div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{saveError}</div>)}
                {saveSuccess && (<div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">Profile updated successfully.</div>)}
                <FormField label="Full Name" icon={User}>
                  <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                </FormField>
                {role === 'student' && (<>
                    <FormField label="Email" icon={Mail}>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                    </FormField>
                    {form.email.trim().toLowerCase() !== (user?.email || '').toLowerCase() && (<>
                        <FormField label="Current Password (required for email change)" icon={Lock}>
                          <input type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} required placeholder="Enter current password" className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                        </FormField>
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Your CampusFix login email will also change. Next time, sign in with the new email.
                        </p>
                      </>)}
                  </>)}
                <FormField label="College ID" icon={BadgeCheck}>
                  <input value={form.college_id} onChange={(e) => setForm({ ...form, college_id: e.target.value })} className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                </FormField>
                <FormField label="Department" icon={Building2}>
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                </FormField>
                <FormField label="Phone" icon={Phone}>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                </FormField>
                {role === 'student' && (<div className="grid grid-cols-3 gap-2">
                    <FormField label="Hostel" icon={Home}>
                      <input value={form.hostel} onChange={(e) => setForm({ ...form, hostel: e.target.value })} className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                    </FormField>
                    <FormField label="Block" icon={Building2}>
                      <input value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                    </FormField>
                    <FormField label="Room" icon={DoorOpen}>
                      <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full bg-transparent outline-none text-sm text-slate-900"/>
                    </FormField>
                  </div>)}
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                    <Save className="w-4 h-4"/>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </Card>
        </div>)}
    </div>);
}

function AdminProfilePage({ profile, user, total, avgRating, onBack, onNotifications, onEdit, onPassword, onLogout, editing, setEditing, form, setForm, saving, saveError, saveSuccess, handleSave, pwOpen, setPwOpen, pwForm, setPwForm, pwSaving, pwError, pwSuccess, showPw, setShowPw, handleChangePassword }) {
    const displayName = profile?.full_name || 'Admin User';
    const rating = avgRating && Number(avgRating) > 0 ? avgRating : '—';
    return (<div className="admin-profile-page">
      <div className="admin-profile-topline">
        <button type="button" onClick={onBack} className="admin-profile-back" aria-label="Back to dashboard"><ArrowLeft size={29}/></button>
        <h1>My Profile</h1>
        <span className="admin-profile-top-spacer"/>
      </div>

      <section className="admin-profile-identity">
        <div className="admin-profile-avatar" aria-hidden="true">
          <div className="admin-profile-avatar-head"/>
          <div className="admin-profile-avatar-body"/>
        </div>
        <h2>{displayName}</h2>
        <div className="admin-profile-role"><span>Campus Maintenance Manager</span></div>
        <div className="admin-profile-contacts"><span><Mail size={21}/>{user?.email || profile?.email || 'admin.user@campus.edu'}</span><span><Phone size={21}/>{profile?.phone || '+91 90000 00000'}</span></div>
      </section>

      <section className="admin-profile-stats" aria-label="Admin profile statistics">
        <div className="admin-profile-stat">
          <div className="admin-profile-stat-icon"><MessageCircle size={25} fill="currentColor"/></div>
          <div><span>Complaints Handled</span><strong>{total}</strong></div>
        </div>
        <div className="admin-profile-stat-divider"/>
        <div className="admin-profile-stat">
          <div className="admin-profile-stat-icon"><Star size={26} fill="currentColor"/></div>
          <div><span>Avg Rating</span><strong>{rating}<Star className="admin-profile-rating-star" size={23} fill="currentColor"/></strong></div>
        </div>
      </section>

      <section className="admin-profile-menu" aria-label="Profile settings">
        <AdminProfileMenuRow icon={Edit3} label="Edit Profile" onClick={onEdit}/>
        <AdminProfileMenuRow icon={Lock} label="Change Password" onClick={onPassword}/>
        <AdminProfileMenuRow icon={Bell} label="Notification Settings" onClick={onNotifications}/>
        <AdminProfileMenuRow icon={Settings} label="App Preferences" onClick={() => window.alert('App preferences opened.')}/>
        <AdminProfileMenuRow icon={HelpCircle} label="Help & Support" onClick={() => window.alert('CampusFix support: contact your campus maintenance help desk.')}/>
        <AdminProfileMenuRow icon={LogOut} label="Logout" danger onClick={onLogout}/>
      </section>

      <div className="admin-profile-account-note">Signed in as {user?.email || 'administrator'}</div>

      {pwOpen && (<div className="admin-dark-modal-layer" onClick={() => setPwOpen(false)}>
        <div className="admin-dark-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-dark-modal-header"><h3>Change Password</h3><button type="button" onClick={() => setPwOpen(false)}><X size={20}/></button></div>
          {pwSuccess ? (<div className="admin-dark-success"><CheckCircle2 size={35}/><strong>Password updated</strong><span>Your password was changed successfully.</span></div>) : (<form onSubmit={handleChangePassword} className="admin-dark-form">
            {pwError && <div className="admin-dark-error">{pwError}</div>}
            <AdminDarkField label="Current Password"><input type={showPw ? 'text' : 'password'} value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} required/></AdminDarkField>
            <AdminDarkField label="New Password"><div className="admin-dark-password"><input type={showPw ? 'text' : 'password'} value={pwForm.new} onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })} required minLength={8}/><button type="button" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></AdminDarkField>
            <AdminDarkField label="Confirm Password"><input type={showPw ? 'text' : 'password'} value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required/></AdminDarkField>
            <button className="admin-dark-primary" type="submit" disabled={pwSaving}>{pwSaving ? 'Updating…' : 'Update Password'}</button>
          </form>)}
        </div>
      </div>)}

      {editing && (<div className="admin-dark-modal-layer" onClick={() => setEditing(false)}>
        <div className="admin-dark-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-dark-modal-header"><h3>Edit Profile</h3><button type="button" onClick={() => setEditing(false)}><X size={20}/></button></div>
          <form onSubmit={handleSave} className="admin-dark-form">
            {saveError && <div className="admin-dark-error">{saveError}</div>}
            {saveSuccess && <div className="admin-dark-success-inline">Profile updated successfully.</div>}
            <AdminDarkField label="Full Name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required/></AdminDarkField>
            <AdminDarkField label="College ID"><input value={form.college_id} onChange={(e) => setForm({ ...form, college_id: e.target.value })}/></AdminDarkField>
            <AdminDarkField label="Department"><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}/></AdminDarkField>
            <AdminDarkField label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}/></AdminDarkField>
            <button className="admin-dark-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </form>
        </div>
      </div>)}
    </div>);
}
function AdminProfileMenuRow({ icon: Icon, label, onClick, danger = false }) {
    return (<button type="button" onClick={onClick} className={'admin-profile-menu-row ' + (danger ? 'is-danger' : '')}>
      <span className="admin-profile-menu-icon"><Icon size={24}/></span>
      <span className="admin-profile-menu-label">{label}</span>
      <ChevronRight className="admin-profile-menu-chevron" size={24}/>
    </button>);
}
function AdminDarkField({ label, children }) {
    return (<label className="admin-dark-field"><span>{label}</span><div>{children}</div></label>);
}

function MiniStat({ icon: Icon, label, value, color }) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        amber: 'from-amber-500 to-amber-600',
        emerald: 'from-emerald-500 to-emerald-600',
        violet: 'from-violet-500 to-violet-600',
    };
    return (<Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white"/>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-lg font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </Card>);
}
function DetailRow({ icon: Icon, label, value }) {
    return (<div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-500"/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 truncate">{value}</p>
      </div>
    </div>);
}
function SummaryItem({ icon: Icon, label, value }) {
    return (<div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
      <Icon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-base font-bold text-slate-900">{value}</p>
      </div>
    </div>);
}
function FormField({ label, icon: Icon, children }) {
    return (<div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <Icon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
        {children}
      </div>
    </div>);
}
