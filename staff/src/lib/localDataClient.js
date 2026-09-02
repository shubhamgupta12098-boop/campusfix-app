import { api } from '@/lib/api';

function valueAt(row, field) {
  return String(field || '').split('.').reduce((value, part) => value?.[part], row);
}
function equal(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  return String(a) === String(b);
}
function matches(row, filters) {
  return filters.every((filter) => {
    const value = valueAt(row, filter.field);
    if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.some((candidate) => equal(value, candidate));
    return equal(value, filter.value);
  });
}
function signalChange() {
  try { localStorage.setItem('campusfix_shared_data_signal', String(Date.now())); } catch {}
  try { const channel = new BroadcastChannel('campusfix_shared_data_channel'); channel.postMessage({ type: 'changed', at: Date.now() }); channel.close(); } catch {}
}

function context() {
  const cache = new Map();
  return {
    async all(table) {
      if (!cache.has(table)) cache.set(table, Promise.resolve(api(`/data/${encodeURIComponent(table)}`)));
      const rows = await cache.get(table);
      return Array.isArray(rows) ? rows : [];
    },
    clear(table) { cache.delete(table); },
  };
}

async function enrichRow(table, source, ctx) {
  if (!source) return source;
  const row = { ...source };
  if (table === 'complaints') {
    const [categories, buildings, profiles] = await Promise.all([ctx.all('complaint_categories'), ctx.all('buildings'), ctx.all('profiles')]);
    row.complaint_categories = categories.find((item) => equal(item.id, row.category_id)) || null;
    row.buildings = buildings.find((item) => equal(item.id, row.building_id)) || null;
    row.profiles = profiles.find((item) => equal(item.id, row.user_id)) || null;
    row.assigned_profile = profiles.find((item) => equal(item.id, row.assigned_to)) || null;
  } else if (table === 'work_orders') {
    const [complaints, profiles] = await Promise.all([ctx.all('complaints'), ctx.all('profiles')]);
    const complaint = complaints.find((item) => equal(item.id, row.complaint_id)) || null;
    row.complaints = complaint ? await enrichRow('complaints', complaint, ctx) : null;
    row.profiles = profiles.find((item) => equal(item.id, row.technician_id)) || null;
  } else if (table === 'complaint_status_history') {
    const profiles = await ctx.all('profiles');
    row.profiles = profiles.find((item) => equal(item.id, row.changed_by)) || null;
  } else if (table === 'profiles' && row.role === 'staff') {
    const technicians = await ctx.all('technicians');
    row.technician = technicians.find((item) => equal(item.id, row.id)) || null;
  }
  return row;
}

class ApiQueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = 'select'; this.payload = null; this.filters = []; this.sort = null; this.max = null; this.one = null;
  }
  select() { return this; }
  insert(value) { this.action = 'insert'; this.payload = value; return this; }
  update(value) { this.action = 'update'; this.payload = value; return this; }
  delete() { this.action = 'delete'; return this; }
  eq(field, value) { this.filters.push({ field, op: 'eq', value }); return this; }
  in(field, value) { this.filters.push({ field, op: 'in', value }); return this; }
  order(field, options) { this.sort = { field, ascending: options?.ascending !== false }; return this; }
  limit(value) { this.max = Number(value); return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybeSingle'; return this; }
  then(ok, bad) { return this.execute().then(ok, bad); }

  async execute() {
    try {
      const ctx = context();
      if (this.action === 'insert') {
        const input = Array.isArray(this.payload) ? this.payload : [this.payload];
        const rows = await api(`/data/${encodeURIComponent(this.table)}/bulk`, { method: 'POST', body: JSON.stringify({ values: input }) });
        ctx.clear(this.table); signalChange();
        const enriched = await Promise.all((Array.isArray(rows) ? rows : []).map((row) => enrichRow(this.table, row, ctx)));
        if (this.one === 'single' && enriched.length !== 1) return { data: null, error: { message: 'Expected exactly one record.' } };
        const data = this.one ? enriched[0] || null : (Array.isArray(this.payload) ? enriched : enriched[0] || null);
        return { data, error: null };
      }

      const allRows = await ctx.all(this.table);
      const matched = allRows.filter((row) => matches(row, this.filters));
      if (this.action === 'update') {
        const changed = [];
        for (const row of matched) {
          changed.push(await api(`/data/${encodeURIComponent(this.table)}/${encodeURIComponent(row.id)}`, { method: 'PUT', body: JSON.stringify(this.payload || {}) }));
        }
        ctx.clear(this.table); signalChange();
        return { data: { matched: matched.length, modified: changed.length, rows: changed }, error: null };
      }
      if (this.action === 'delete') {
        const result = await api(`/data/${encodeURIComponent(this.table)}/delete-many`, { method: 'POST', body: JSON.stringify({ ids: matched.map((row) => row.id) }) });
        ctx.clear(this.table); signalChange();
        return { data: result, error: null };
      }

      let rows = [...matched];
      if (this.sort) {
        const direction = this.sort.ascending ? 1 : -1;
        rows.sort((a, b) => {
          const left = valueAt(a, this.sort.field); const right = valueAt(b, this.sort.field);
          if (left === right) return 0; if (left == null) return 1; if (right == null) return -1;
          return left > right ? direction : -direction;
        });
      }
      if (Number.isFinite(this.max) && this.max > 0) rows = rows.slice(0, this.max);
      const enriched = await Promise.all(rows.map((row) => enrichRow(this.table, row, ctx)));
      if (this.one === 'single' && enriched.length !== 1) return { data: null, error: { message: `Expected one ${this.table} record, found ${enriched.length}.` } };
      return { data: this.one ? enriched[0] || null : enriched, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
    }
  }
}

export const localData = { from(table) { return new ApiQueryBuilder(table); } };
