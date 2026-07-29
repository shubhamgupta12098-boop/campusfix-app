import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/constants';
import type { PreventiveSchedule, Building, Profile } from '@/lib/supabase';
import { CalendarCheck, Plus, Clock, CheckCircle2, X, Wind, Zap, Droplets, Flame, Building2 } from 'lucide-react';

const CAT_ICONS: Record<string, typeof Wind> = {
  'AC Servicing': Wind,
  'Generator Inspection': Zap,
  'Lift Maintenance': Building2,
  'Water Tank Cleaning': Droplets,
  'Fire Extinguisher': Flame,
  'Electrical Panel': Zap,
};

export function PreventiveScreen() {
  const { profile } = useAuthStore();
  const [schedules, setSchedules] = useState<PreventiveSchedule[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'AC Servicing', building_id: '', frequency_days: 30, assigned_to: '' });

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const [s, b, t] = await Promise.all([
      supabase.from('preventive_maintenance_schedules').select('*, buildings(*)').order('next_due', { ascending: true }),
      supabase.from('buildings').select('*').order('name'),
      supabase.from('profiles').select('*').eq('role', 'staff').eq('is_active', true),
    ]);
    setSchedules((s.data || []) as unknown as PreventiveSchedule[]);
    setBuildings(b.data || []);
    setTechnicians((t.data || []) as Profile[]);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + form.frequency_days);
    await supabase.from('preventive_maintenance_schedules').insert({
      ...form,
      building_id: form.building_id || null,
      assigned_to: form.assigned_to || null,
      next_due: nextDue.toISOString(),
    });
    setShowAdd(false);
    setForm({ title: '', description: '', category: 'AC Servicing', building_id: '', frequency_days: 30, assigned_to: '' });
    void load();
  };

  const markDone = async (s: PreventiveSchedule) => {
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + s.frequency_days);
    await supabase.from('preventive_maintenance_schedules').update({
      last_performed: new Date().toISOString(),
      next_due: nextDue.toISOString(),
    }).eq('id', s.id);
    void load();
  };

  if (loading) return <Spinner />;

  const overdue = schedules.filter((s) => s.next_due && new Date(s.next_due) < new Date());
  const upcoming = schedules.filter((s) => s.next_due && new Date(s.next_due) >= new Date());

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Preventive Maintenance"
        subtitle="Scheduled and recurring maintenance tasks"
        action={
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all">
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        }
      />

      {overdue.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Overdue ({overdue.length})
          </h3>
          <div className="space-y-2">
            {overdue.map((s) => <ScheduleCard key={s.id} schedule={s} onDone={() => markDone(s)} canEdit />)}
          </div>
        </div>
      )}

      <h3 className="text-sm font-bold text-slate-700 mb-3">Upcoming</h3>
      {upcoming.length === 0 && schedules.length === 0 ? (
        <Card className="p-0"><EmptyState icon={CalendarCheck} title="No schedules" description="Create preventive maintenance schedules to automate recurring tasks." /></Card>
      ) : (
        <div className="space-y-2">
          {upcoming.map((s) => <ScheduleCard key={s.id} schedule={s} onDone={() => markDone(s)} canEdit />)}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <Card className="p-6 w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">New Schedule</h3>
                <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-3">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Title (e.g. AC Servicing - Block A)"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Description"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm resize-none" />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm bg-white">
                  {['AC Servicing', 'Generator Inspection', 'Lift Maintenance', 'Water Tank Cleaning', 'Fire Extinguisher', 'Electrical Panel'].map((c) => <option key={c}>{c}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.building_id} onChange={(e) => setForm({ ...form, building_id: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm bg-white">
                    <option value="">All buildings</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <input type="number" value={form.frequency_days} onChange={(e) => setForm({ ...form, frequency_days: +e.target.value })} min={1} placeholder="Frequency (days)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm" />
                </div>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm bg-white">
                  <option value="">Unassigned</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Create Schedule</button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ScheduleCard({ schedule, onDone, canEdit }: { schedule: PreventiveSchedule; onDone: () => void; canEdit: boolean }) {
  const Icon = CAT_ICONS[schedule.category] || CalendarCheck;
  const isOverdue = schedule.next_due && new Date(schedule.next_due) < new Date();
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-100' : 'bg-blue-100'}`}>
          <Icon className={`w-5 h-5 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{schedule.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {schedule.category} · Every {schedule.frequency_days} days
            {(schedule as any).buildings?.name && ` · ${(schedule as any).buildings.name}`}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {isOverdue ? <Badge className="bg-red-50 text-red-700">Overdue · {formatDate(schedule.next_due)}</Badge>
              : <Badge className="bg-emerald-50 text-emerald-700">Due {formatDate(schedule.next_due)}</Badge>}
            {schedule.last_performed && <span className="text-xs text-slate-400">Last: {formatDate(schedule.last_performed)}</span>}
          </div>
        </div>
        {canEdit && (
          <button onClick={onDone} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
          </button>
        )}
      </div>
    </Card>
  );
}
