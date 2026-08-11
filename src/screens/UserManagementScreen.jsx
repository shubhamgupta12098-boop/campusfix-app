import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { Users, Search, GraduationCap, BadgeCheck, Crown } from 'lucide-react';
const ROLE_ICONS = {
    student: GraduationCap,
    staff: BadgeCheck,
    admin: Crown,
};
const ROLE_COLORS = {
    student: 'blue',
    staff: 'cyan',
    admin: 'rose',
};
export function UserManagementScreen() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [error, setError] = useState(null);
    useEffect(() => {
        void load();
    }, []);
    const load = async () => {
        setLoading(true);
        setError(null);
        const { data, error: loadError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (loadError)
            setError(loadError.message);
        setUsers((data || []).map((u) => ({
            ...u,
            full_name: u.full_name || u.email?.split('@')[0] || 'Unnamed user',
            role: (['admin', 'staff', 'student'].includes(String(u.role).toLowerCase()) ? String(u.role).toLowerCase() : 'student'),
            is_active: u.is_active !== false,
        })));
        setLoading(false);
    };
    const toggleActive = async (user) => {
        const { error: updateError } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
        if (updateError)
            return setError(updateError.message);
        void load();
    };
    const changeRole = async (user, role) => {
        const { error: updateError } = await supabase.from('profiles').update({ role }).eq('id', user.id);
        if (updateError)
            return setError(updateError.message);
        void load();
    };
    const filtered = users.filter((u) => {
        const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || (u.college_id || '').toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        return matchSearch && matchRole;
    });
    if (loading)
        return <Spinner />;
    return (<div className="max-w-5xl mx-auto">
      <PageHeader title="User Management" subtitle={`${users.length} registered users`}/>
      {error && <Card className="p-4 mb-4 border border-red-100 bg-red-50 text-sm text-red-700">{error}</Card>}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or college ID…" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 bg-white"/>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['all', 'student', 'staff', 'admin'].map((r) => (<button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${roleFilter === r ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>))}
        </div>
      </div>

      {filtered.length === 0 ? (<Card className="p-0"><EmptyState icon={Users} title="No users found"/></Card>) : (<div className="space-y-2">
          {filtered.map((u) => {
                const Icon = ROLE_ICONS[u.role];
                const color = ROLE_COLORS[u.role];
                const initials = u.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
                return (<Card key={u.id} className="p-4">
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
                    <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span><b>Email:</b> {u.email || '—'}</span>
                      <span><b>Phone:</b> {u.phone || '—'}</span>
                      <span><b>Location:</b> {[u.hostel, u.block, u.room].filter(Boolean).join(' / ') || '—'}</span>
                      <span><b>Joined:</b> {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Icon className="w-4 h-4 text-slate-500"/>
                    <select value={u.role} onChange={(e) => void changeRole(u, e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-blue-400">
                      <option value="student">Student</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button onClick={() => toggleActive(u)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </Card>);
            })}
        </div>)}
    </div>);
}
