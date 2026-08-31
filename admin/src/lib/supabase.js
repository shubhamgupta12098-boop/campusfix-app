import {
    createLocalId,
    ensureLocalSeeded,
    localDeleteMany,
    localGet,
    localGetAll,
    localPut,
    localPutMany,
} from '@/lib/localDb';

function matchesFilters(row, filters) {
    return filters.every((filter) => {
        if (filter.op === 'in')
            return Array.isArray(filter.value) && filter.value.includes(row?.[filter.field]);
        return row?.[filter.field] === filter.value;
    });
}

async function enrichRow(collection, source) {
    if (!source)
        return source;
    const row = { ...source };
    if (collection === 'complaints') {
        const [category, building, reporter, assignee] = await Promise.all([
            localGet('complaint_categories', row.category_id),
            localGet('buildings', row.building_id),
            localGet('profiles', row.user_id),
            localGet('profiles', row.assigned_to),
        ]);
        row.complaint_categories = category;
        row.buildings = building;
        row.profiles = reporter;
        row.assigned_profile = assignee;
    }
    else if (collection === 'work_orders') {
        const [complaint, technician] = await Promise.all([
            localGet('complaints', row.complaint_id),
            localGet('profiles', row.technician_id),
        ]);
        row.complaints = complaint ? await enrichRow('complaints', complaint) : null;
        row.profiles = technician;
    }
    else if (collection === 'complaint_status_history') {
        row.profiles = await localGet('profiles', row.changed_by);
    }
    else if (collection === 'profiles' && row.role === 'staff') {
        row.technician = await localGet('technicians', row.id);
    }
    return row;
}

class LocalQueryBuilder {
    constructor(table) {
        this.table = table;
        this.action = 'select';
        this.payload = null;
        this.filters = [];
        this.sort = null;
        this.max = null;
        this.one = null;
    }

    select() {
        return this;
    }

    insert(value) {
        this.action = 'insert';
        this.payload = value;
        return this;
    }

    update(value) {
        this.action = 'update';
        this.payload = value;
        return this;
    }

    delete() {
        this.action = 'delete';
        return this;
    }

    eq(field, value) {
        this.filters.push({ field, op: 'eq', value });
        return this;
    }

    in(field, value) {
        this.filters.push({ field, op: 'in', value });
        return this;
    }

    order(field, options) {
        this.sort = { field, ascending: options?.ascending !== false };
        return this;
    }

    limit(value) {
        this.max = value;
        return this;
    }

    single() {
        this.one = 'single';
        return this;
    }

    maybeSingle() {
        this.one = 'maybeSingle';
        return this;
    }

    then(ok, bad) {
        return this.execute().then(ok, bad);
    }

    async execute() {
        try {
            await ensureLocalSeeded();
            if (this.action === 'insert') {
                const values = Array.isArray(this.payload) ? this.payload : [this.payload];
                if (this.table === 'complaints') {
                    const invalidComplaint = values.find((value) => {
                        const photos = Array.isArray(value?.photo_urls) ? value.photo_urls.filter(Boolean) : [];
                        const imageItems = Array.isArray(value?.media_items)
                            ? value.media_items.filter((item) => {
                                if (!item?.url)
                                    return false;
                                const type = String(item.type || item.kind || '').toLowerCase();
                                return type === 'image' || type === 'photo';
                            })
                            : [];
                        return photos.length + imageItems.length < 1;
                    });
                    if (invalidComplaint)
                        return { data: null, error: { message: 'At least one photo is required for every complaint.' } };
                }
                const now = new Date().toISOString();
                const made = values.map((value) => ({
                    ...value,
                    id: value?.id || createLocalId(this.table.replace(/_+$/g, '') || 'record'),
                    created_at: value?.created_at || now,
                    updated_at: now,
                }));
                await localPutMany(this.table, made);
                const enriched = await Promise.all(made.map((row) => enrichRow(this.table, row)));
                if (this.one === 'single' && enriched.length !== 1)
                    return { data: null, error: { message: 'Expected exactly one record.' } };
                const data = this.one ? enriched[0] || null : Array.isArray(this.payload) ? enriched : enriched[0];
                return { data, error: null };
            }

            const allRows = await localGetAll(this.table);
            const matched = allRows.filter((row) => matchesFilters(row, this.filters));

            if (this.action === 'update') {
                const now = new Date().toISOString();
                const changed = matched.map((row) => ({ ...row, ...this.payload, updated_at: now }));
                await localPutMany(this.table, changed);
                if (this.table === 'profiles' && this.payload?.role === 'staff') {
                    for (const profile of changed) {
                        const existingTechnician = await localGet('technicians', profile.id);
                        if (!existingTechnician) {
                            await localPut('technicians', {
                                id: profile.id,
                                employee_code: profile.college_id || 'STF-' + Date.now().toString().slice(-6),
                                skills: [],
                                current_workload: 0,
                                availability_status: 'available',
                                area_coverage: [],
                                created_at: now,
                                updated_at: now,
                            });
                        }
                    }
                }
                return {
                    data: { matched: matched.length, modified: changed.length },
                    error: null,
                };
            }

            if (this.action === 'delete') {
                await localDeleteMany(this.table, matched.map((row) => row.id));
                return { data: { deleted: matched.length }, error: null };
            }

            let rows = [...matched];
            if (this.sort) {
                const direction = this.sort.ascending ? 1 : -1;
                rows.sort((left, right) => {
                    const a = left?.[this.sort.field];
                    const b = right?.[this.sort.field];
                    if (a === b)
                        return 0;
                    if (a === undefined || a === null)
                        return 1;
                    if (b === undefined || b === null)
                        return -1;
                    return a > b ? direction : -direction;
                });
            }
            if (this.max)
                rows = rows.slice(0, this.max);
            const enriched = await Promise.all(rows.map((row) => enrichRow(this.table, row)));
            if (this.one === 'single' && enriched.length !== 1)
                return { data: null, error: { message: 'Expected one ' + this.table + ' record, found ' + enriched.length + '.' } };
            return { data: this.one ? enriched[0] || null : enriched, error: null };
        }
        catch (error) {
            return {
                data: null,
                error: { message: error instanceof Error ? error.message : String(error) },
            };
        }
    }
}

export const supabase = {
    from(table) {
        return new LocalQueryBuilder(table);
    },
};
