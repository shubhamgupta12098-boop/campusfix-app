// MongoDB data access layer. Existing screens keep the familiar query-builder API.
import { api } from '@/lib/api';

export type UserRole = 'student' | 'staff' | 'admin';
export type ComplaintStatus = 'submitted' | 'verified' | 'assigned' | 'in_progress' | 'waiting_approval' | 'resolved' | 'closed' | 'rejected';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'emergency';

export interface Profile { id: string; email?: string; full_name: string; college_id?: string; role: UserRole; department?: string; hostel?: string; block?: string; room?: string; phone?: string; avatar_url?: string; is_active: boolean; created_at: string; updated_at: string; technician?: Technician; }
export interface Building { id: string; name: string; code?: string; type: string; floors: number; description?: string; }
export interface ComplaintCategory { id: string; name: string; icon: string; color: string; description?: string; sla_hours: number; }
export interface Complaint { id: string; complaint_no: string; title: string; description: string; category_id: string; user_id: string; building_id?: string; room_id?: string; floor?: number; location_description?: string; priority: ComplaintPriority; status: ComplaintStatus; photo_urls: string[]; assigned_to?: string; assigned_at?: string; resolved_at?: string; closed_at?: string; expected_completion?: string; escalation_level: number; feedback_rating?: number; feedback_comment?: string; feedback_submitted_at?: string; feedback_by?: string; created_at: string; updated_at: string; complaint_categories?: ComplaintCategory; buildings?: Building; profiles?: Profile; assigned_profile?: Profile; }
export interface WorkOrder { id: string; work_order_no: string; complaint_id: string; technician_id?: string; tools_required: string[]; materials_used: { name: string; quantity: number; cost: number }[]; start_time?: string; completion_time?: string; labour_hours?: number; repair_notes?: string; material_cost: number; status: string; before_photo_urls?: string[]; completion_photo_urls: string[]; approval_status?: 'pending'|'approved'|'rejected'; approval_remarks?: string; approved_by?: string; approved_at?: string; created_by: string; created_at: string; updated_at: string; complaints?: Complaint; profiles?: Profile; }
export interface InventoryItem { id: string; name: string; category: string; unit: string; current_stock: number; min_stock: number; max_stock: number; unit_cost: number; supplier?: string; description?: string; }
export interface PreventiveSchedule { id: string; title: string; description?: string; category: string; building_id?: string; frequency_days: number; last_performed?: string; next_due?: string; assigned_to?: string; status: string; buildings?: Building; }
export interface Technician { id: string; employee_code?: string; skills: string[]; current_workload: number; availability_status: string; area_coverage: string[]; }
export interface Notification { id: string; user_id: string; title: string; message: string; type: string; related_id?: string; is_read: boolean; created_at: string; }

type Filter = { field: string; op: 'eq' | 'in'; value: unknown };
type Result<T = any> = { data: T | null; error: { message: string } | null };

class MongoQueryBuilder {
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private filters: Filter[] = [];
  private sort?: { field: string; ascending: boolean };
  private max?: number;
  private one: 'single' | 'maybeSingle' | null = null;
  constructor(private table: string) {}
  select(_columns = '*') { return this; }
  insert(value: any) { this.action = 'insert'; this.payload = value; return this; }
  update(value: any) { this.action = 'update'; this.payload = value; return this; }
  delete() { this.action = 'delete'; return this; }
  eq(field: string, value: unknown) { this.filters.push({ field, op: 'eq', value }); return this; }
  in(field: string, value: unknown[]) { this.filters.push({ field, op: 'in', value }); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.sort = { field, ascending: options?.ascending !== false }; return this; }
  limit(value: number) { this.max = value; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybeSingle'; return this; }
  then<TResult1 = Result, TResult2 = never>(ok?: ((v: Result) => TResult1 | PromiseLike<TResult1>) | null, bad?: ((r: any) => TResult2 | PromiseLike<TResult2>) | null) { return this.execute().then(ok, bad); }
  private async execute(): Promise<Result> {
    try {
      if (this.action === 'insert') {
        const data = await api(`/data/${this.table}`, { method: 'POST', body: JSON.stringify(this.payload) });
        const normalized = Array.isArray(data) ? data : [data];
        return { data: this.one ? normalized[0] ?? null : data, error: null };
      }
      if (this.action === 'update' || this.action === 'delete') {
        const data = await api(`/data/${this.table}`, {
          method: this.action === 'update' ? 'PATCH' : 'DELETE',
          body: JSON.stringify(this.action === 'update' ? { filters: this.filters, values: this.payload } : { filters: this.filters }),
        });
        return { data, error: null };
      }
      const params = new URLSearchParams();
      if (this.filters.length) params.set('filters', JSON.stringify(this.filters));
      if (this.sort) { params.set('sort', this.sort.field); params.set('ascending', String(this.sort.ascending)); }
      if (this.max) params.set('limit', String(this.max));
      const rows = await api<any[]>(`/data/${this.table}?${params}`);
      if (this.one === 'single' && rows.length !== 1) return { data: null, error: { message: `Expected one ${this.table} record, found ${rows.length}.` } };
      return { data: this.one ? rows[0] ?? null : rows, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
    }
  }
}

export const database = { from(table: string) { return new MongoQueryBuilder(table); } };
