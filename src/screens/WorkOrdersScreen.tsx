import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { formatDate, onImageError } from '@/lib/constants';
import type { WorkOrder } from '@/lib/supabase';
import { ClipboardList, Wrench, Clock, DollarSign, FileText, Image as ImageIcon } from 'lucide-react';

export function WorkOrdersScreen({ onOpenComplaint }: { onOpenComplaint: (id: string) => void }) {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError(error.message);
      setOrders([]);
    } else {
      setOrders((data || []) as unknown as WorkOrder[]);
    }
    setLoading(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Work Orders" subtitle={`${orders.length} staff work records`} />

      {loadError && (
        <Card className="p-4 mb-4 border border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">Work orders could not be loaded</p>
          <p className="text-xs text-red-600 mt-1 break-words">{loadError}</p>
          <button onClick={() => void load()} className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold">Retry</button>
        </Card>
      )}

      {!loadError && orders.length === 0 ? (
        <Card className="p-0"><EmptyState icon={ClipboardList} title="No work orders" description="Staff starts a work order after an assigned complaint is opened." /></Card>
      ) : (
        <div className="space-y-4">
          {orders.map((wo) => {
            const complaint = wo.complaints;
            return (
              <Card key={wo.id} className="p-5">
                <div className="flex items-start gap-3">
                  {complaint?.photo_urls?.[0] ? (
                    <button onClick={() => complaint?.id && onOpenComplaint(complaint.id)} className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200">
                      <img src={complaint.photo_urls[0]} alt="Complaint" className="w-full h-full object-cover" onError={onImageError} />
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{complaint?.title || wo.work_order_no}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{complaint?.complaint_no || wo.work_order_no} · {complaint?.complaint_categories?.name || 'Maintenance'}</p>
                      </div>
                      <Badge className={wo.status === 'completed' || wo.approval_status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                        {wo.approval_status === 'pending' ? 'Approval pending' : (wo.approval_status || wo.status)}
                      </Badge>
                    </div>

                    {complaint?.description && <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{complaint.description}</p>}
                    {wo.profiles && <p className="text-xs text-slate-600 mt-2 flex items-center gap-1.5"><Wrench className="w-3 h-3" /> Staff: {wo.profiles.full_name}</p>}
                    {wo.repair_notes && <p className="text-xs text-slate-700 mt-2 bg-slate-50 rounded-lg p-3"><strong>Staff remarks:</strong> {wo.repair_notes}</p>}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      <Evidence title="Complaint Photo" urls={complaint?.photo_urls || []} empty="No complaint photo" />
                      <Evidence title="Before Work" urls={wo.before_photo_urls || []} empty="Before photo not uploaded" />
                      <Evidence title="After Work" urls={wo.completion_photo_urls || []} empty="After photo not uploaded" />
                    </div>

                    <div className="flex items-center gap-4 mt-4 flex-wrap text-xs text-slate-500">
                      {wo.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Started {formatDate(wo.start_time)}</span>}
                      {wo.completion_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Submitted {formatDate(wo.completion_time)}</span>}
                      {!!wo.labour_hours && <span>{wo.labour_hours}h labour</span>}
                      {wo.material_cost > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ₹{wo.material_cost}</span>}
                    </div>

                    {complaint?.id && (
                      <button onClick={() => onOpenComplaint(complaint.id)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">
                        <FileText className="w-3.5 h-3.5" /> View Full Complaint Detail
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Evidence({ title, urls, empty }: { title: string; urls: string[]; empty: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />{title}</p>
      {urls.length ? (
        <div className="grid grid-cols-2 gap-2">
          {urls.slice(0, 4).map((url, i) => (
            <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-slate-200">
              <img src={url} alt={`${title} ${i + 1}`} className="w-full h-full object-cover" onError={onImageError} />
            </a>
          ))}
        </div>
      ) : <p className="text-xs text-slate-400 py-5 text-center">{empty}</p>}
    </div>
  );
}
