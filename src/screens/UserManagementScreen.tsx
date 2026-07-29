import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import type { Profile, UserRole } from '@/lib/supabase';
import { Users, Search, GraduationCap, BadgeCheck, Wrench, ShieldCheck, Crown } from 'lucide-react';

const ROLE_ICONS: Record<UserRole, typeof GraduationCap> = {
  student: GraduationCap,
  faculty: BadgeCheck,
  technician: Wrench,
  supervisor: ShieldCheck,
  admin: Crown,
};

const ROLE_COLORS: Record<UserRole, string> = {
  student: 'blue',
  faculty: 'cyan',
  technician: 'amber',
  supervisor: 'violet',
  admin: 'rose',
};

export function UserManagementScreen() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data || []) as Profile[]);
    setLoading(false);
  };

  const toggleActive = async (user: Profile) => {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    void load();
  };

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || (u.college_id || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  if (loading) return <Spinner />;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="User Management" subtitle={`${users.length} registered users`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or college ID…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 bg-white" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', 'student', 'faculty', 'technician', 'supervisor', 'admin'] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${roleFilter === r ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-0"><EmptyState icon={Users} title="No users found" /></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const Icon = ROLE_ICONS[u.role];
            const color = ROLE_COLORS[u.role];
            const initials = u.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
            return (
              <Card key={u.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-${color}-500 to-${color}-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name}</p>
                      {!u.is_active && <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{u.college_id || 'No ID'} {u.department && `· ${u.department}`} {u.hostel && `· ${u.hostel}`}</p>
                  </div>
                  <Badge className={`bg-${color}-50 text-${color}-700 flex-shrink-0`}>
                    <Icon className="w-3 h-3" />
                    {u.role}
                  </Badge>
                  <button
                    onClick={() => toggleActive(u)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
