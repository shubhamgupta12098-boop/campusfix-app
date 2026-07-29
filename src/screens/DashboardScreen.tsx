import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, StatCard, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, timeAgo } from '@/lib/constants';
import type { Complaint, ComplaintCategory, Building } from '@/lib/supabase';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, PlusCircle, ArrowRight, Wrench, Package, TrendingUp } from 'lucide-react';

interface Props {
  onNavigate: (s: 'raise' | 'my-complaints' | 'inventory' | 'preventive' | 'reports' | 'technician-jobs' | 'assign' | 'work-orders' | 'users' | 'notifications') => void;
  onOpenComplaint: (id: string) => void;
}

export function DashboardScreen({ onNavigate, onOpenComplaint }: Props) {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, overdue: 0 });

  const role = profile?.role ?? 'student';
  const isAdmin = role === 'admin' || role === 'supervisor';
  const isTechnician = role === 'technician';

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [catRes, bldRes] = await Promise.all([
      supabase.from('complaint_categories').select('*').order('name'),
      supabase.from('buildings').select('*').order('name'),
    ]);
    setCategories(catRes.data || []);
    setBuildings(bldRes.data || []);

    let query = supabase
      .from('complaints')
      .select('*, complaint_categories(*), buildings(*), profiles!complaints_user_id_fkey(*), profiles!complaints_assigned_to_fkey(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (isTechnician) {
      query = query.eq('assigned_to', profile?.id);
    } else if (!isAdmin) {
      query = query.eq('user_id', profile?.id);
    }

    const { data } = await query;
    const list = (data || []) as unknown as Complaint[];
    setComplaints(list);

    const total = list.length;
    const open = list.filter((c) => !['closed', 'resolved', 'rejected'].includes(c.status)).length;
    const resolved = list.filter((c) => c.status === 'resolved' || c.status === 'closed').length;
    const overdue = list.filter((c) => c.expected_completion && new Date(c.expected_completion) < new Date() && !['closed', 'resolved'].includes(c.status)).length;
    setStats({ total, open, resolved, overdue });

    setLoading(false);
  };

  const recent = complaints.slice(0, 5);

  const categoryStats = categories.map((cat) => {
    const count = complaints.filter((c) => c.category_id === cat.id).length;
    return { ...cat, count };
  }).sort((a, b) => b.count - a.count).slice(0, 5);

  const maxCat = Math.max(...categoryStats.map((c) => c.count), 1);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] || 'User'}`}
        subtitle={isAdmin ? 'Overview of campus maintenance operations' : isTechnician ? 'Your assigned jobs and tasks' : 'Track your complaints and maintenance requests'}
        action={
          (role === 'student' || role === 'faculty') && (
            <button
              onClick={() => onNavigate('raise')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              New Complaint
            </button>
          )
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Complaints" value={stats.total} icon={ClipboardList} color="blue" />
        <StatCard label="Open" value={stats.open} icon={Clock} color="amber" />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} color="emerald" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent complaints */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Recent Complaints</h3>
              {!isTechnician && !isAdmin && (
                <button onClick={() => onNavigate('my-complaints')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
            {recent.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No complaints yet" description="Raise your first complaint to get started." />
            ) : (
              <div className="space-y-2">
                {recent.map((c) => {
                  const sc = STATUS_CONFIG[c.status];
                  const pc = PRIORITY_CONFIG[c.priority];
                  return (
                    <button
                      key={c.id}
                      onClick={() => onOpenComplaint(c.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.complaint_categories?.color || '#3B82F6') + '15' }}>
                        <Wrench className="w-5 h-5" style={{ color: c.complaint_categories?.color || '#3B82F6' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {c.complaint_no} · {c.complaint_categories?.name || 'Uncategorized'} · {timeAgo(c.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <Badge className={`${sc.bg} ${sc.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </Badge>
                        <Badge className={`${pc.bg} ${pc.color} border ${pc.border}`}>
                          {pc.label}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Category breakdown */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4">By Category</h3>
            {categoryStats.length === 0 ? (
              <p className="text-sm text-slate-400">No data</p>
            ) : (
              <div className="space-y-3">
                {categoryStats.map((cat) => (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{cat.name}</span>
                      <span className="font-semibold text-slate-900">{cat.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(cat.count / maxCat) * 100}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {isAdmin && (
            <Card className="p-5">
              <h3 className="font-bold text-slate-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <QuickAction icon={ClipboardList} label="Assign Complaints" onClick={() => onNavigate('assign')} />
                <QuickAction icon={Package} label="Manage Inventory" onClick={() => onNavigate('inventory')} />
                <QuickAction icon={TrendingUp} label="View Reports" onClick={() => onNavigate('reports')} />
              </div>
            </Card>
          )}

          {isTechnician && (
            <Card className="p-5">
              <h3 className="font-bold text-slate-900 mb-3">My Workload</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Active jobs</span>
                  <span className="text-lg font-bold text-slate-900">{stats.open}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Completed</span>
                  <span className="text-lg font-bold text-emerald-600">{stats.resolved}</span>
                </div>
                <button onClick={() => onNavigate('technician-jobs')} className="w-full mt-2 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors">
                  View My Jobs
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof ClipboardList; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
    </button>
  );
}
