import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Spinner, StatCard } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate } from '@/lib/constants';
import type { Complaint, ComplaintCategory, Building, Profile } from '@/lib/supabase';
import { Download, TrendingUp, Clock, CheckCircle2, AlertTriangle, FileBarChart } from 'lucide-react';

export function ReportsScreen() {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const [c, cats, blds, techs] = await Promise.all([
      supabase.from('complaints').select('*, complaint_categories(*), buildings(*), profiles!complaints_assigned_to_fkey(*)').order('created_at', { ascending: false }),
      supabase.from('complaint_categories').select('*'),
      supabase.from('buildings').select('*'),
      supabase.from('profiles').select('*').eq('role', 'technician'),
    ]);
    setComplaints((c.data || []) as unknown as Complaint[]);
    setCategories((cats.data || []) as ComplaintCategory[]);
    setBuildings(blds.data || []);
    setTechnicians((techs.data || []) as Profile[]);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter((c) => !['closed', 'resolved', 'rejected'].includes(c.status)).length;
    const resolved = complaints.filter((c) => c.status === 'resolved' || c.status === 'closed').length;
    const overdue = complaints.filter((c) => c.expected_completion && new Date(c.expected_completion) < new Date() && !['closed', 'resolved'].includes(c.status)).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const resolvedComplaints = complaints.filter((c) => c.resolved_at && c.created_at);
    const avgResolutionHours = resolvedComplaints.length > 0
      ? Math.round(resolvedComplaints.reduce((sum, c) => {
          const hours = (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()) / 3600000;
          return sum + hours;
        }, 0) / resolvedComplaints.length)
      : 0;

    const byCategory = categories.map((cat) => ({
      ...cat,
      total: complaints.filter((c) => c.category_id === cat.id).length,
      resolved: complaints.filter((c) => c.category_id === cat.id && (c.status === 'resolved' || c.status === 'closed')).length,
    })).sort((a, b) => b.total - a.total);

    const byBuilding = buildings.map((b) => ({
      ...b,
      total: complaints.filter((c) => c.building_id === b.id).length,
      resolved: complaints.filter((c) => c.building_id === b.id && (c.status === 'resolved' || c.status === 'closed')).length,
    })).sort((a, b) => b.total - a.total).filter((b) => b.total > 0);

    const byTechnician = technicians.map((t) => {
      const assigned = complaints.filter((c) => c.assigned_to === t.id);
      return {
        ...t,
        assigned: assigned.length,
        resolved: assigned.filter((c) => c.status === 'resolved' || c.status === 'closed').length,
      };
    }).filter((t) => t.assigned > 0).sort((a, b) => b.resolved - a.resolved);

    return { total, open, resolved, overdue, resolutionRate, avgResolutionHours, byCategory, byBuilding, byTechnician };
  }, [complaints, categories, buildings, technicians]);

  const exportCSV = () => {
    const rows = [['Complaint No', 'Title', 'Category', 'Priority', 'Status', 'Building', 'Created', 'Resolved', 'Rating']];
    complaints.forEach((c) => {
      rows.push([
        c.complaint_no,
        c.title,
        c.complaint_categories?.name || '',
        c.priority,
        c.status,
        c.buildings?.name || '',
        formatDate(c.created_at),
        c.resolved_at ? formatDate(c.resolved_at) : '',
        c.feedback_rating?.toString() || '',
      ]);
    });
    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complaints-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner />;

  const maxCat = Math.max(...stats.byCategory.map((c) => c.total), 1);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Insights into campus maintenance performance"
        action={
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-lg transition-all">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} icon={FileBarChart} color="blue" />
        <StatCard label="Resolution Rate" value={`${stats.resolutionRate}%`} icon={TrendingUp} color="emerald" />
        <StatCard label="Avg Resolution" value={`${stats.avgResolutionHours}h`} icon={Clock} color="violet" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4">Complaints by Category</h3>
          <div className="space-y-3">
            {stats.byCategory.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">{cat.name}</span>
                  <span className="font-semibold text-slate-900">{cat.total} <span className="text-slate-400">({cat.resolved} resolved)</span></span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(cat.total / maxCat) * 100}%`, backgroundColor: cat.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Building breakdown */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4">Complaints by Building</h3>
          {stats.byBuilding.length === 0 ? <p className="text-sm text-slate-400">No data</p> : (
            <div className="space-y-3">
              {stats.byBuilding.map((b) => {
                const max = Math.max(...stats.byBuilding.map((x) => x.total), 1);
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{b.name}</span>
                      <span className="font-semibold text-slate-900">{b.total} <span className="text-slate-400">({b.resolved} resolved)</span></span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-slate-700" style={{ width: `${(b.total / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Technician performance */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold text-slate-900 mb-4">Technician Performance</h3>
          {stats.byTechnician.length === 0 ? <p className="text-sm text-slate-400">No assigned complaints yet</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left font-semibold py-2">Technician</th>
                    <th className="text-center font-semibold py-2">Assigned</th>
                    <th className="text-center font-semibold py-2">Resolved</th>
                    <th className="text-center font-semibold py-2">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byTechnician.map((t) => {
                    const rate = t.assigned > 0 ? Math.round((t.resolved / t.assigned) * 100) : 0;
                    return (
                      <tr key={t.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-3 font-semibold text-slate-900">{t.full_name}</td>
                        <td className="py-3 text-center text-slate-700">{t.assigned}</td>
                        <td className="py-3 text-center text-emerald-600 font-semibold">{t.resolved}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${rate >= 75 ? 'bg-emerald-100 text-emerald-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
