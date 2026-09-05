import express from 'express';
import { dbCollection, cleanDoc, newId } from './db.mjs';
import { requireAuth } from './auth.mjs';

export const dataRouter = express.Router();
dataRouter.use(requireAuth);

const STORES = new Set([
  'profiles', 'technicians', 'complaints', 'complaint_categories', 'buildings',
  'notifications', 'work_orders', 'complaint_status_history',
]);

function storeName(req) {
  const name = String(req.params.store || '');
  if (!STORES.has(name)) return null;
  return name;
}

function hasComplaintPhoto(value) {
  const direct = Array.isArray(value?.photo_urls) ? value.photo_urls.filter(Boolean) : [];
  const media = Array.isArray(value?.media_items)
    ? value.media_items.filter((item) => item?.url && ['image', 'photo'].includes(String(item.type || item.kind || '').toLowerCase()))
    : [];
  return direct.length + media.length > 0;
}

async function visibleFilter(store, auth) {
  const { role, profileId } = auth;
  if (role === 'admin') return {};
  if (store === 'notifications') return { user_id: profileId };
  if (store === 'profiles') {
    if (role === 'student') return { $or: [{ id: profileId }, { role: { $in: ['admin', 'staff'] }, is_active: true }] };
    // Staff needs reporter identity/contact on assigned complaint details and admin IDs for work-completion notifications.
    return { is_active: { $ne: false } };
  }
  if (store === 'complaints') {
    if (role === 'student') return { user_id: profileId };
    if (role === 'staff') return { $or: [{ assigned_to: profileId }, { user_id: profileId }] };
  }
  if (store === 'work_orders' || store === 'complaint_status_history') {
    const complaintFilter = role === 'student' ? { user_id: profileId } : { $or: [{ assigned_to: profileId }, { user_id: profileId }] };
    const ids = (await dbCollection('complaints').find(complaintFilter, { projection: { id: 1 } }).toArray()).map((row) => row.id);
    return store === 'work_orders' ? { complaint_id: { $in: ids } } : { complaint_id: { $in: ids } };
  }
  return {};
}

async function mayWrite(store, row, auth, existing = null) {
  const { role, profileId } = auth;
  if (role === 'admin') return true;
  if (store === 'complaint_categories' || store === 'buildings') return false;
  if (store === 'profiles') return String(row.id || existing?.id) === String(profileId);
  if (store === 'technicians') return role === 'staff' && String(row.id || existing?.id) === String(profileId);
  if (store === 'notifications') return true;
  if (store === 'complaint_status_history') return String(row.changed_by || profileId) === String(profileId);
  if (store === 'complaints') {
    const owner = existing?.user_id || row.user_id;
    if (role === 'student') return String(owner) === String(profileId);
    if (role === 'staff') return String(existing?.assigned_to || row.assigned_to || '') === String(profileId) || String(owner || '') === String(profileId);
  }
  if (store === 'work_orders') return role === 'staff' && String(existing?.technician_id || row.technician_id || '') === String(profileId);
  return false;
}

function normalizeRow(store, input, auth, existing = null) {
  const now = new Date().toISOString();
  const value = { ...(existing || {}), ...(input || {}) };
  delete value._id;
  delete value.password_hash;
  value.id = String(value.id || newId(store.replace(/s$/, '') || 'record'));
  value.created_at = existing?.created_at || value.created_at || now;
  value.updated_at = now;
  if (store === 'complaints' && !existing && !value.user_id) value.user_id = auth.profileId;
  if (store === 'complaint_status_history' && !value.changed_by) value.changed_by = auth.profileId;

  // Non-admin profiles cannot self-promote or re-enable themselves by editing payload fields.
  if (store === 'profiles' && existing && auth.role !== 'admin') {
    value.role = existing.role;
    value.is_active = existing.is_active;
    value.id = existing.id;
  }

  // Student-created complaints always belong to the authenticated student.
  if (store === 'complaints' && auth.role === 'student') {
    value.user_id = auth.profileId;
    if (!existing) {
      value.status = 'submitted';
      delete value.assigned_to;
      delete value.assigned_at;
      delete value.admin_review_status;
      delete value.admin_reviewed_at;
      delete value.admin_reviewed_by;
    } else {
      value.assigned_to = existing.assigned_to;
      value.assigned_at = existing.assigned_at;
      value.admin_review_status = existing.admin_review_status;
      value.admin_reviewed_at = existing.admin_reviewed_at;
      value.admin_reviewed_by = existing.admin_reviewed_by;
      value.verified_at = existing.verified_at;
      value.rejected_at = existing.rejected_at;
      value.rejection_reason = existing.rejection_reason;
      // The student UI is allowed to close a resolved complaint; other workflow states are controlled by Admin/Staff.
      if (!(existing.status === 'resolved' && input?.status === 'closed') && !(existing.status === 'closed' && input?.status === 'closed')) {
        value.status = existing.status;
      }
    }
  }
  return value;
}

async function validateRow(store, row, existing = null) {
  if (store === 'complaints') {
    const categoryId = String(row?.category_id || '').trim();
    if (!categoryId) throw Object.assign(new Error('Category * is required. Complaint cannot be saved without a category.'), { status: 400 });
    row.category_id = categoryId;
    const locationDescription = String(row?.location_description || '').trim();
    if (!locationDescription) throw Object.assign(new Error('Location * is required. Complaint cannot be saved without a location.'), { status: 400 });
    row.location_description = locationDescription;
    if (!hasComplaintPhoto(row)) throw Object.assign(new Error('Photo * is required. Complaint cannot be saved without at least one photo.'), { status: 400 });
  }
  if (store === 'profiles' && !row.email) throw Object.assign(new Error('Profile email is required.'), { status: 400 });
  if (store === 'work_orders' && row.status === 'in_progress' && (!Array.isArray(row.before_photo_urls) || row.before_photo_urls.filter(Boolean).length < 1)) {
    throw Object.assign(new Error('Before photo is required before work can start.'), { status: 400 });
  }
  if (store === 'work_orders' && ['awaiting_approval', 'completed', 'closed'].includes(row.status) && (!Array.isArray(row.completion_photo_urls) || row.completion_photo_urls.filter(Boolean).length < 1)) {
    throw Object.assign(new Error('After photo is required before work can be completed.'), { status: 400 });
  }
  return true;
}

dataRouter.get('/:store', async (req, res, next) => {
  try {
    const store = storeName(req);
    if (!store) return res.status(404).json({ error: 'Unknown data resource.' });
    const filter = await visibleFilter(store, req.auth);
    const rows = await dbCollection(store).find(filter).toArray();
    res.json(rows.map(cleanDoc));
  } catch (error) { next(error); }
});

dataRouter.get('/:store/:id', async (req, res, next) => {
  try {
    const store = storeName(req);
    if (!store) return res.status(404).json({ error: 'Unknown data resource.' });
    const filter = await visibleFilter(store, req.auth);
    const row = await dbCollection(store).findOne({ $and: [filter, { id: String(req.params.id) }] });
    if (!row) return res.status(404).json({ error: 'Record not found.' });
    res.json(cleanDoc(row));
  } catch (error) { next(error); }
});

dataRouter.put('/:store/:id', async (req, res, next) => {
  try {
    const store = storeName(req);
    if (!store) return res.status(404).json({ error: 'Unknown data resource.' });
    const id = String(req.params.id);
    const existing = cleanDoc(await dbCollection(store).findOne({ id }));
    const row = normalizeRow(store, { ...req.body, id }, req.auth, existing);
    if (!(await mayWrite(store, row, req.auth, existing))) return res.status(403).json({ error: 'You do not have permission to change this record.' });
    await validateRow(store, row, existing);
    await dbCollection(store).replaceOne({ id }, row, { upsert: true });
    // When Admin promotes/creates a Staff profile, keep the technician record in sync.
    if (store === 'profiles' && row.role === 'staff') {
      const now = new Date().toISOString();
      await dbCollection('technicians').updateOne(
        { id: row.id },
        { $setOnInsert: {
          id: row.id,
          employee_code: row.college_id || `STF-${Date.now().toString().slice(-6)}`,
          skills: [], current_workload: 0, availability_status: 'available', area_coverage: [], created_at: now,
        }, $set: { updated_at: now } },
        { upsert: true },
      );
    }
    res.json(cleanDoc(row));
  } catch (error) { next(error); }
});

dataRouter.post('/:store/bulk', async (req, res, next) => {
  try {
    const store = storeName(req);
    if (!store) return res.status(404).json({ error: 'Unknown data resource.' });
    const values = Array.isArray(req.body?.values) ? req.body.values : [];
    if (!values.length) return res.json([]);
    const output = [];
    for (const input of values) {
      const id = String(input?.id || newId(store.replace(/s$/, '') || 'record'));
      const existing = cleanDoc(await dbCollection(store).findOne({ id }));
      const row = normalizeRow(store, { ...input, id }, req.auth, existing);
      if (!(await mayWrite(store, row, req.auth, existing))) return res.status(403).json({ error: `No permission to change ${store}/${id}.` });
      await validateRow(store, row, existing);
      await dbCollection(store).replaceOne({ id }, row, { upsert: true });
      output.push(cleanDoc(row));
    }
    res.json(output);
  } catch (error) { next(error); }
});

dataRouter.post('/:store/delete-many', async (req, res, next) => {
  try {
    const store = storeName(req);
    if (!store) return res.status(404).json({ error: 'Unknown data resource.' });
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) return res.json({ deleted: 0 });
    if (req.auth.role !== 'admin' && store !== 'notifications') return res.status(403).json({ error: 'Delete permission denied.' });
    const scope = await visibleFilter(store, req.auth);
    const result = await dbCollection(store).deleteMany({ $and: [scope, { id: { $in: ids } }] });
    res.json({ deleted: result.deletedCount || 0 });
  } catch (error) { next(error); }
});
