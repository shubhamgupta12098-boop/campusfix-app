import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Spinner, EmptyState } from '@/components/ui';
import { ChevronDown, Filter, Mail, Pencil, Phone, Plus, Search, Trash2, UserRound, Users } from 'lucide-react';

export function UserManagementScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    setUsers((data || []).map((u) => ({
      ...u,
      full_name: u.full_name || u.email?.split('@')[0] || 'Unnamed user',
      role: ['admin','staff','student'].includes(String(u.role).toLowerCase()) ? String(u.role).toLowerCase() : 'student',
      is_active: u.is_active !== false,
    })));
    setLoading(false);
  };

  const toggleActive = async (user) => {
    const { error: updateError } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    if (updateError) return setError(updateError.message);
    void load();
  };

  const changeRole = async (user, role) => {
    const { error: updateError } = await supabase.from('profiles').update({ role }).eq('id', user.id);
    if (updateError) return setError(updateError.message);
    void load();
  };

  const editRole = async (user) => {
    const answer = window.prompt('Enter role: student, staff, or admin', user.role);
    if (!answer) return;
    const role = answer.trim().toLowerCase();
    if (!['student','staff','admin'].includes(role)) return window.alert('Please enter student, staff, or admin.');
    await changeRole(user, role);
  };

  const filtered = useMemo(() => users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [u.full_name, u.college_id, u.email, u.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  }), [users, search, roleFilter, statusFilter]);

  if (loading) return <Spinner/>;

  return <div className="admin-screen admin-users-screen">
    {error && <div className="admin-inline-error">{error}<button onClick={() => void load()}>Retry</button></div>}

    <label className="admin-big-search"><Search size={23}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."/></label>
    <div className="admin-filter-row admin-user-filters">
      <label><Filter size={18}/><select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="all">Role</option><option value="staff">Staff</option><option value="admin">Admin</option><option value="student">Student</option></select><ChevronDown size={17}/></label>
      <label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Status</option><option value="active">Active</option><option value="inactive">On Leave / Inactive</option></select><ChevronDown size={17}/></label>
    </div>

    {filtered.length === 0 ? <div className="admin-empty-card"><EmptyState icon={Users} title="No users found"/></div> : <div className="admin-user-list">
      {filtered.map((u) => {
        const initials = u.full_name.split(' ').map((p) => p[0]).slice(0,2).join('').toUpperCase();
        const roleLabel = u.role === 'staff' ? (u.department || 'Maintenance Staff') : u.role === 'admin' ? 'Administrator' : (u.department || 'Student');
        return <article key={u.id} className="admin-user-card">
          <div className="admin-user-avatar">{initials || <UserRound size={24}/>}</div>
          <div className="admin-user-copy">
            <h3>{u.full_name}</h3>
            <strong>{roleLabel}</strong>
            <p><Phone size={16}/>{u.phone || '+91 90000 00000'}</p>
            <p><Mail size={16}/>{u.email || 'campus.user@example.edu'}</p>
          </div>
          <span className={`admin-user-status ${u.is_active ? 'active' : 'leave'}`}><i/>{u.is_active ? 'Active' : 'On Leave'}</span>
          <div className="admin-user-actions">
            <button type="button" onClick={() => void editRole(u)} aria-label={`Edit ${u.full_name}`}><Pencil size={22}/></button>
            <button type="button" className="danger" onClick={() => void toggleActive(u)} aria-label={`${u.is_active ? 'Deactivate' : 'Activate'} ${u.full_name}`}><Trash2 size={22}/></button>
          </div>
        </article>;
      })}
    </div>}

    <button type="button" className="admin-add-user" onClick={() => window.alert('Create the new account from the registration flow, then set its role here.')}><Plus size={28}/>Add New User</button>
  </div>;
}
