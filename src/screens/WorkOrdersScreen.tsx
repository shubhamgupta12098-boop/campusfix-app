import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/constants';
import type { WorkOrder } from '@/lib/supabase';
import { ClipboardList, Wrench, Clock, DollarSign, Package } from 'lucide-react';

export function WorkOrdersScreen() {
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    let q = supabase
      .from('work_orders')
      .select('*, complaints(*, complaint_categories(*)), profiles!work_orders_technician_id_fkey(*)')
      .order('created_at', { ascending: false });

    if (profile?.role === 'technician') {
      q = q.eq('technician_id', profile.id);
    }
    const { data } = await q;
    setOrders((data || []) as unknown as WorkOrder[]);
    setLoading(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Work Orders" subtitle={`${orders.length} work orders`} />

      {orders.length === 0 ? (
        <Card className="p-0"><EmptyState icon={ClipboardList} title="No work orders" description="Work orders are created when technicians complete jobs." /></Card>
      ) : (
        <div className="space-y-3">
          {orders.map((wo) => (
            <Card key={wo.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-5 h-5 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{wo.work_order_no}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{wo.complaints?.title} · {wo.complaints?.complaint_categories?.name}</p>
                    </div>
                    <Badge className={wo.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                      {wo.status}
                    </Badge>
                  </div>

                  {wo.profiles && (
                    <p className="text-xs text-slate-600 mt-2 flex items-center gap-1.5">
                      <Wrench className="w-3 h-3" /> {wo.profiles.full_name}
                    </p>
                  )}

                  {wo.repair_notes && (
                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 rounded-lg p-2.5">{wo.repair_notes}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-slate-500">
                    {wo.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(wo.start_time)}</span>}
                    {wo.completion_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(wo.completion_time)}</span>}
                    {wo.labour_hours && <span>{wo.labour_hours}h labour</span>}
                    {wo.material_cost > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ₹{wo.material_cost}</span>}
                  </div>

                  {wo.completion_photo_urls && wo.completion_photo_urls.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {wo.completion_photo_urls.map((url, i) => (
                        <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
