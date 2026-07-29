import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Package,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, Spinner, StatCard } from '@/components/ui';
import { PRIORITY_CONFIG, STATUS_CONFIG, timeAgo } from '@/lib/constants';
import { supabase, type Complaint, type InventoryItem, type Profile } from '@/lib/supabase';

type AdminDestination = 'assign' | 'work-orders' | 'inventory' | 'preventive' | 'reports' | 'users' | 'notifications';

interface Props {
  onNavigate: (screen: AdminDestination) => void;
  onOpenComplaint: (id: string) => void;
}

interface AdminStats {
  total: number;
  open: number;
  unassigned: number;
  resolved: number;
  overdue: number;
  students: number;
  staff: number;
  lowStock: number;
}


export function AdminDashboardScreen({ onNavigate, onOpenComplaint }: Props) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    const [complaintResult, profileResult, inventoryResult] = await Promise.all([
      supabase.from('complaints').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('inventory').select('*').order('name').limit(500),
    ]);

    const firstError = complaintResult.error || profileResult.error || inventoryResult.error;
    if (firstError) setError(firstError.message);

    setComplaints((complaintResult.data || []) as Complaint[]);
    setProfiles((profileResult.data || []) as Profile[]);
    setInventory((inventoryResult.data || []) as InventoryItem[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo<AdminStats>(() => {
    const now = Date.now();
    const active = complaints.filter((complaint) => !['resolved', 'closed', 'rejected'].includes(complaint.status));
    return {
      total: complaints.length,
      open: active.length,
      unassigned: active.filter((complaint) => !complaint.assigned_to).length,
      resolved: complaints.filter((complaint) => ['resolved', 'closed'].includes(complaint.status)).length,
      overdue: active.filter((complaint) => complaint.expected_completion && new Date(complaint.expected_completion).getTime() < now).length,
      students: profiles.filter((profile) => profile.role === 'student').length,
      staff: profiles.filter((profile) => profile.role === 'staff').length,
      lowStock: inventory.filter((item) => Number(item.current_stock || 0) <= Number(item.min_stock || 0)).length,
    };
  }, [complaints, profiles, inventory]);

  const statusRows = useMemo(() => {
    const statuses = ['submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
    return statuses.map((status) => ({
      status,
      count: complaints.filter((complaint) => complaint.status === status).length,
    }));
  }, [complaints]);

  const maxStatus = Math.max(...statusRows.map((row) => row.count), 1);
  const recentComplaints = complaints.slice(0, 6);
  const urgentComplaints = complaints
    .filter((complaint) => ['high', 'emergency'].includes(complaint.priority) && !['resolved', 'closed', 'rejected'].includes(complaint.status))
    .slice(0, 5);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Monitor complaints, staff workload, users and campus maintenance operations"
        action={
          <button
            onClick={() => void loadData()}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Refresh Data
          </button>
        }
      />

      {error && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Some dashboard data could not be loaded: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Complaints" value={stats.total} icon={ClipboardList} color="blue" />
        <StatCard label="Open Complaints" value={stats.open} icon={Clock3} color="amber" />
        <StatCard label="Unassigned" value={stats.unassigned} icon={AlertTriangle} color="rose" />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Students" value={stats.students} icon={Users} color="cyan" />
        <StatCard label="Staff Members" value={stats.staff} icon={Wrench} color="violet" />
        <StatCard label="Overdue" value={stats.overdue} icon={TrendingUp} color="rose" />
        <StatCard label="Low Stock Items" value={stats.lowStock} icon={Package} color="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900">Recent Complaints</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest complaints submitted across campus</p>
            </div>
            <button onClick={() => onNavigate('assign')} className="text-sm font-semibold text-blue-600 flex items-center gap-1">
              Manage all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {recentComplaints.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No complaints found" description="New complaints will appear here." />
          ) : (
            <div className="space-y-2">
              {recentComplaints.map((complaint) => {
                const status = STATUS_CONFIG[complaint.status];
                const priority = PRIORITY_CONFIG[complaint.priority];
                return (
                  <button
                    key={complaint.id}
                    onClick={() => onOpenComplaint(complaint.id)}
                    className="w-full p-3 rounded-xl hover:bg-slate-50 text-left flex items-center gap-3 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{complaint.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {complaint.complaint_no || complaint.id.slice(0, 8)} · {complaint.location_description || 'Location not specified'} · {timeAgo(complaint.created_at)}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1.5">
                      <Badge className={`${status.bg} ${status.color}`}>{status.label}</Badge>
                      <Badge className={`${priority.bg} ${priority.color} border ${priority.border}`}>{priority.label}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-slate-900">Complaint Status</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">Current workflow distribution</p>
          <div className="space-y-4">
            {statusRows.map(({ status, count }) => {
              const config = STATUS_CONFIG[status];
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700">{config.label}</span>
                    <span className="font-bold text-slate-900">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${config.dot}`} style={{ width: `${(count / maxStatus) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminAction icon={ClipboardList} label="Assign Complaints" description={`${stats.unassigned} waiting`} onClick={() => onNavigate('assign')} />
            <AdminAction icon={UserCog} label="Manage Users" description={`${profiles.length} total users`} onClick={() => onNavigate('users')} />
            <AdminAction icon={Wrench} label="Work Orders" description="Track active repairs" onClick={() => onNavigate('work-orders')} />
            <AdminAction icon={Package} label="Inventory" description={`${stats.lowStock} low-stock items`} onClick={() => onNavigate('inventory')} />
            <AdminAction icon={TrendingUp} label="Reports" description="View analytics" onClick={() => onNavigate('reports')} />
            <AdminAction icon={ShieldCheck} label="Maintenance Plans" description="Preventive schedules" onClick={() => onNavigate('preventive')} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900">Urgent Attention</h2>
              <p className="text-xs text-slate-500 mt-0.5">High and emergency priority complaints</p>
            </div>
            <button onClick={() => onNavigate('assign')} className="text-xs font-semibold text-blue-600">Open queue</button>
          </div>
          {urgentComplaints.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-semibold text-emerald-900">No urgent complaints</p>
              <p className="text-xs text-emerald-700 mt-1">All high-priority issues are under control.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentComplaints.map((complaint) => (
                <button key={complaint.id} onClick={() => onOpenComplaint(complaint.id)} className="w-full rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-left hover:bg-rose-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{complaint.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{complaint.complaint_no || complaint.id.slice(0, 8)} · {timeAgo(complaint.created_at)}</p>
                    </div>
                    <Badge className={complaint.priority === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                      {PRIORITY_CONFIG[complaint.priority].label}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function AdminAction({ icon: Icon, label, description, onClick }: { icon: typeof ClipboardList; label: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border border-slate-200 p-3 text-left hover:border-blue-200 hover:bg-blue-50/40 transition-colors flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-slate-700" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
    </button>
  );
}
