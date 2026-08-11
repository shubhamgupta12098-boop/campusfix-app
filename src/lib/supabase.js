// MongoDB-backed compatibility layer. Existing screens keep the familiar query-builder API.
import { api } from '@/lib/api';
class MongoQueryBuilder {
    constructor(table) {
        Object.defineProperty(this, "table", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: table
        });
        Object.defineProperty(this, "action", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'select'
        });
        Object.defineProperty(this, "payload", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "filters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "sort", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "max", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "one", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    select(_columns = '*') { return this; }
    insert(value) { this.action = 'insert'; this.payload = value; return this; }
    update(value) { this.action = 'update'; this.payload = value; return this; }
    delete() { this.action = 'delete'; return this; }
    eq(field, value) { this.filters.push({ field, op: 'eq', value }); return this; }
    in(field, value) { this.filters.push({ field, op: 'in', value }); return this; }
    order(field, options) { this.sort = { field, ascending: options?.ascending !== false }; return this; }
    limit(value) { this.max = value; return this; }
    single() { this.one = 'single'; return this; }
    maybeSingle() { this.one = 'maybeSingle'; return this; }
    then(ok, bad) { return this.execute().then(ok, bad); }
    async execute() {
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
            if (this.filters.length)
                params.set('filters', JSON.stringify(this.filters));
            if (this.sort) {
                params.set('sort', this.sort.field);
                params.set('ascending', String(this.sort.ascending));
            }
            if (this.max)
                params.set('limit', String(this.max));
            const rows = await api(`/data/${this.table}?${params}`);
            if (this.one === 'single' && rows.length !== 1)
                return { data: null, error: { message: `Expected one ${this.table} record, found ${rows.length}.` } };
            return { data: this.one ? rows[0] ?? null : rows, error: null };
        }
        catch (error) {
            return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
        }
    }
}
export const supabase = { from(table) { return new MongoQueryBuilder(table); } };
