import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { sendPasswordResetEmail, encodeFields, firestoreFetch } from '@/lib/firebase';
import { supabase, type Complaint } from '@/lib/supabase';
import { PageHeader, Card, Badge } from '@/components/ui';
import { User, Mail, BadgeCheck, Building2, Phone, Home, DoorOpen, ShieldCheck, Save, KeyRound, CheckCircle2, Clock3, ClipboardList } from 'lucide-react';

const ROLE_LABELS = {
  student: 'Student',
  faculty: 'Faculty / Staff',
  technician: 'Cleaner / Technician',
  supervisor: 'Maintenance Supervisor',
  admin: 'Administrator',
};

export function ProfileScreen() {
  const { profile, user, refreshProfile } = useAuthStore();
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    college_id: profile?.college_id || '',
    department: profile?.department || '',
    phone: profile?.phone || '',
    hostel: profile?.hostel || '',
    block: profile?.block || '',
    room: profile?.room || '',
  });
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || '',
      college_id: profile.college_id || '',
      department: profile.department || '',
      phone: profile.phone || '',
      hostel: profile.hostel || '',
      block: profile.block || '',
      room: profile.room || '',
    });
    void loadStats();
  }, [profile?.id]);

  const loadStats = async () => {
    if (!profile) return;
    const query = profile.role === 'technician'
      ? supabase.from('complaints').select('*').eq('assigned_to', profile.id)
      : profile.role === 'student' || profile.role === 'faculty'
        ? supabase.from('complaints').select('*').eq('user_id', profile.id)
        : supabase.from('complaints').select('*');
    const { data } = await query;
    setComplaints((data || []) as Complaint[]);
  };

  const stats = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter((c) => !['resolved', 'closed', 'rejected'].includes(c.status)).length,
    resolved: complaints.filter((c) => ['resolved', 'closed'].includes(c.status)).length,
  }), [complaints]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage('');
    try {
      await firestoreFetch(`/profiles/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify(encodeFields({
          ...form,
          email: user?.email || profile.email || '',
          role: profile.role,
          is_active: profile.is_active,
          created_at: profile.created_at,
          updated_at: new Date().toISOString(),
        })),
      });
      await refreshProfile();
      setMessage('Profile updated successfully.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) return;
    setMessage('');
    try {
      await sendPasswordResetEmail(user.email);
      setMessage('Password reset link sent to your email.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to send reset link.');
    }
  };

  if (!profile) return null;

  const initials = profile.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="My Profile" subtitle="View and update your account details" />

      {message && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <Card className="p-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">{initials}</div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{profile.full_name}</h2>
            <p className="text-sm text-slate-500 mt-1">{user?.email || profile.email}</p>
            <Badge className="mt-3 bg-blue-50 text-blue-700"><ShieldCheck className="w-3.5 h-3.5" />{ROLE_LABELS[profile.role]}</Badge>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> Email verified
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4">Activity</h3>
            <Stat icon={ClipboardList} label="Total" value={stats.total} />
            <Stat icon={Clock3} label="Open / Active" value={stats.open} />
            <Stat icon={CheckCircle2} label="Resolved" value={stats.resolved} />
          </Card>

          <button onClick={resetPassword} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
            <KeyRound className="w-4 h-4" /> Change Password
          </button>
        </div>

        <Card className="lg:col-span-2 p-6">
          <h3 className="font-bold text-slate-900 mb-5">Personal Information</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <ProfileField icon={User} label="Full Name" value={form.full_name} onChange={(v) => update('full_name', v)} />
            <ProfileField icon={Mail} label="Email" value={user?.email || profile.email || ''} disabled />
            <ProfileField icon={BadgeCheck} label="College / Employee ID" value={form.college_id} onChange={(v) => update('college_id', v)} />
            <ProfileField icon={Building2} label="Department" value={form.department} onChange={(v) => update('department', v)} />
            <ProfileField icon={Phone} label="Phone" value={form.phone} onChange={(v) => update('phone', v)} />
            <ProfileField icon={ShieldCheck} label="Role" value={ROLE_LABELS[profile.role]} disabled />
            {profile.role === 'student' && <>
              <ProfileField icon={Home} label="Hostel" value={form.hostel} onChange={(v) => update('hostel', v)} />
              <ProfileField icon={Building2} label="Block" value={form.block} onChange={(v) => update('block', v)} />
              <ProfileField icon={DoorOpen} label="Room" value={form.room} onChange={(v) => update('room', v)} />
            </>}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={save} disabled={saving || !form.full_name.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProfileField({ icon: Icon, label, value, onChange, disabled = false }: { icon: typeof User; label: string; value: string; onChange?: (value: string) => void; disabled?: boolean }) {
  return <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${disabled ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 focus-within:border-blue-400'}`}>
      <Icon className="w-4 h-4 text-slate-400" />
      <input value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)} className="w-full bg-transparent outline-none text-sm text-slate-900 disabled:text-slate-500" />
    </div>
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof ClipboardList; label: string; value: number }) {
  return <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
    <span className="flex items-center gap-2 text-sm text-slate-600"><Icon className="w-4 h-4 text-slate-400" />{label}</span>
    <span className="font-bold text-slate-900">{value}</span>
  </div>;
}
