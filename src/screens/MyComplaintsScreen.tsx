import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { STATUS_CONFIG, PRIORITY_CONFIG, timeAgo } from '@/lib/constants';
import type { Complaint, ComplaintStatus } from '@/lib/supabase';
import { ClipboardList, Search, Wrench, Filter } from 'lucide-react';

export function MyComplaintsScreen({ onOpenComplaint }: { onOpenComplaint: (id: string) => void }) {
  const { profile } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all');

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from('complaints')
      .select('*, complaint_categories(*), buildings(*)')
      .eq('user_id', profile?.id)
      .order('created_at', { ascending: false });
    setComplaints((data || []) as unknown as Complaint[]);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.complaint_no.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [complaints, search, statusFilter]);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="My Complaints" subtitle={`${complaints.length} complaint${complaints.length !== 1 ? 's' : ''} total`} />

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or complaint ID…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 bg-white"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {(['all', 'submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon={ClipboardList} title="No complaints found" description="Try adjusting your filters or raise a new complaint." />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const sc = STATUS_CONFIG[c.status];
            const pc = PRIORITY_CONFIG[c.priority];
            return (
              <button
                key={c.id}
                onClick={() => onOpenComplaint(c.id)}
                className="w-full text-left"
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.complaint_categories?.color || '#3B82F6') + '15' }}>
                      <Wrench className="w-5 h-5" style={{ color: c.complaint_categories?.color || '#3B82F6' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">{c.title}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {c.complaint_no} · {c.complaint_categories?.name} · {timeAgo(c.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <Badge className={`${sc.bg} ${sc.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">{c.description}</p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <Badge className={`${pc.bg} ${pc.color} border ${pc.border}`}>{pc.label}</Badge>
                        {c.buildings && <span className="text-xs text-slate-500">{c.buildings.name}</span>}
                        {c.escalation_level > 0 && <Badge className="bg-red-50 text-red-700">Escalated L{c.escalation_level}</Badge>}
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
