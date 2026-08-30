import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dns from 'node:dns';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
// Render sits the API behind a reverse proxy. Without this, req.protocol always
// reports "http" (even though the public URL is https), so image URLs built from
// req.protocol (see /api/upload below) come out as http://... . Browsers then
// silently block loading that image on an https page (mixed content), which is
// why uploaded images don't show up once deployed on Render.
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 5000);
// Firebase is used ONLY for the "forgot password" email flow now (sending the
// reset email + verifying the reset code). Signup/login/session are all MongoDB + JWT.
const FIREBASE_WEB_API_KEY = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
// Where the password-reset email link should point. This must be set as the
// "action URL" in Firebase Console > Authentication > Templates > Password reset
// > Customize action URL, otherwise Firebase will send users to its own hosted page.
const RESET_PASSWORD_URL = String(process.env.RESET_PASSWORD_URL || process.env.CLIENT_URL || '').split(',')[0].trim();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

// Capacitor/Ionic WebViews use localhost-style origins even on a real Android device.
// These origins are safe to allow because authentication still requires a valid JWT.
const mobileOrigins = new Set([
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // native/non-browser clients, curl, health checks
  if (allowedOrigins.includes(origin)) return true;
  if (mobileOrigins.has(origin)) return true;
  // Safety net for Render deployments: allow any *.onrender.com frontend origin.
  try {
    if (new URL(origin).hostname.endsWith('.onrender.com')) return true;
  } catch { /* ignore invalid origin */ }
  return false;
};
app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    console.warn(`[CORS] Blocked request from origin "${origin}". Add it to CLIENT_URL env var if this is expected.`);
    cb(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
// Serve uploaded images from MongoDB GridFS so they survive Render restarts/redeploys.
// A local-disk fallback is kept for files created by older/local versions.
app.get('/uploads/:filename', async (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename) return res.status(400).send('Invalid filename');

    const localPath = path.join(uploadDir, filename);
    if (fs.existsSync(localPath)) return res.sendFile(localPath);

    if (!mongoose.connection.db) return res.status(503).send('Storage is not ready');
    const files = mongoose.connection.db.collection('uploads.files');
    const stored = await files.findOne({ filename }, { sort: { uploadDate: -1 } });
    if (!stored) return res.status(404).send('Image not found');

    res.setHeader('Content-Type', stored.contentType || stored.metadata?.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(stored.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    const stream = bucket.openDownloadStream(stored._id);
    stream.on('error', (error) => {
      console.error('Image download failed:', error);
      if (!res.headersSent) res.status(404).send('Image not found');
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Image serving failed:', error);
    if (!res.headersSent) res.status(500).send('Could not load image');
  }
});
// Return JSON errors instead of Express's default HTML error page, so the frontend never
// crashes trying to JSON.parse an HTML response (e.g. when CORS rejects an origin).
app.use((err, _req, res, next) => {
  if (!err) return next();
  console.error('Unhandled request error:', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const models = new Map();
const modelFor = (name) => {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Invalid collection name');
  if (!models.has(name)) models.set(name, mongoose.model(name, new mongoose.Schema({}, { strict: false, timestamps: false, versionKey: false }), name));
  return models.get(name);
};
const User = mongoose.model('auth_users', new mongoose.Schema({
  email: { type: String, unique: true, index: true, required: true },
  // Optional "shadow" Firebase account uid — created only so Firebase can send
  // password-reset emails for this address. Never used for actual login.
  firebase_uid: { type: String, unique: true, sparse: true, index: true },
  password_hash: { type: String, required: true },
  profile_id: { type: String, required: true }
}, { timestamps: true, versionKey: false }), 'auth_users');

const toPublic = (doc) => {
  const obj = doc?.toObject ? doc.toObject() : { ...doc };
  if (!obj) return obj;
  // Preserve stable string ids used by categories/buildings; otherwise fall
  // back to MongoDB's native id for ordinary records.
  obj.id = String(obj.id || obj._id);
  delete obj._id;
  delete obj.__v;
  return obj;
};

// Build Mongo queries that work with both native MongoDB `_id` values and
// the legacy/string `id` field used by the original CampusFix frontend.
// Imported Atlas documents may not contain an `id` field, so `.eq('id', ... )`
// must also match `_id`.
function buildMongoQuery(filters = []) {
  const clauses = [];
  for (const filter of filters) {
    const field = String(filter?.field || '');
    const value = filter?.value;
    const isIn = filter?.op === 'in';

    if (field === 'id') {
      const values = isIn ? (Array.isArray(value) ? value : []) : [value];
      const stringValues = values.filter(v => v !== null && v !== undefined).map(String);
      const objectIds = stringValues.filter(v => mongoose.isValidObjectId(v)).map(v => new mongoose.Types.ObjectId(v));
      const alternatives = [];
      if (stringValues.length) alternatives.push({ id: isIn ? { $in: stringValues } : stringValues[0] });
      if (objectIds.length) alternatives.push({ _id: isIn ? { $in: objectIds } : objectIds[0] });
      if (alternatives.length === 1) clauses.push(alternatives[0]);
      else if (alternatives.length > 1) clauses.push({ $or: alternatives });
      continue;
    }

    clauses.push({ [field]: isIn ? { $in: value } : value });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}
// --- Firebase is used ONLY for the forgot-password email flow below. ---

// Creates a throwaway Firebase account for this email if one doesn't already
// exist, purely so Firebase's sendOobCode API has an account to send a
// password-reset email for. The password set here is random and never used —
// MongoDB's password_hash is always the real, authoritative password.
async function ensureFirebaseShadowAccount(email) {
  if (!FIREBASE_WEB_API_KEY) return null;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: crypto.randomBytes(24).toString('hex'), returnSecureToken: false }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload.localId;
    if (payload?.error?.message !== 'EMAIL_EXISTS') {
      console.warn('Firebase shadow account creation skipped:', payload?.error?.message || response.status);
    }
    return null;
  } catch (error) {
    console.warn('Firebase shadow account creation failed:', error?.message || error);
    return null;
  }
}

async function firebaseSendPasswordResetEmail(email) {
  if (!FIREBASE_WEB_API_KEY) throw new Error('FIREBASE_WEB_API_KEY is missing on the server.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email,
      ...(RESET_PASSWORD_URL ? { continueUrl: RESET_PASSWORD_URL } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'RESET_EMAIL_FAILED');
}

async function firebaseConfirmPasswordReset(oobCode, newPassword) {
  if (!FIREBASE_WEB_API_KEY) throw new Error('FIREBASE_WEB_API_KEY is missing on the server.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oobCode, newPassword }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'RESET_CODE_INVALID');
  return String(payload.email || '').toLowerCase();
}

// --- MongoDB-based session auth (JWT). This is the real login/signup path. ---

function signSessionToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is missing on the server.');
  return jwt.sign({ sub: user.profile_id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

const auth = async (req, res, next) => {
  try {
    const raw = req.headers.authorization || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    if (!JWT_SECRET) return res.status(500).json({ error: 'JWT_SECRET is missing on the server.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ profile_id: decoded.sub });
    if (!user) return res.status(401).json({ error: 'Account not found. Please sign in again.' });
    req.auth = { sub: user.profile_id, email: user.email };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
};

async function getById(collection, id) {
  if (!id) return null;
  const Model = modelFor(collection);
  const doc = mongoose.isValidObjectId(id) ? await Model.findById(id).lean() : await Model.findOne({ id }).lean();
  return doc ? toPublic(doc) : null;
}
async function enrich(collection, row) {
  if (!row) return row;
  if (collection === 'complaints') {
    row.complaint_categories = await getById('complaint_categories', row.category_id);
    row.buildings = await getById('buildings', row.building_id);
    row.profiles = await getById('profiles', row.user_id);
    row.assigned_profile = await getById('profiles', row.assigned_to);
  } else if (collection === 'work_orders') {
    row.complaints = await getById('complaints', row.complaint_id);
    if (row.complaints) row.complaints = await enrich('complaints', row.complaints);
    row.profiles = await getById('profiles', row.technician_id);
  } else if (collection === 'complaint_status_history') {
    row.profiles = await getById('profiles', row.changed_by);
  } else if (collection === 'profiles' && row.role === 'staff') {
    row.technician = await getById('technicians', row.id);
  }
  return row;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email: rawEmail, password, fullName, role, ...extra } = req.body || {};
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!fullName) return res.status(400).json({ error: 'Name is required.' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'This email is already registered.' });

    const id = new mongoose.Types.ObjectId().toString();
    const now = new Date().toISOString();
    const safeRole = role === 'staff' ? 'staff' : 'student';
    const profile = { id, email, full_name: fullName, role: safeRole, is_active: true, created_at: now, updated_at: now, ...extra };
    await modelFor('profiles').create({ _id: id, ...profile });
    if (safeRole === 'staff') await modelFor('technicians').create({ _id: id, id, employee_code: extra.college_id || `STF-${Date.now().toString().slice(-6)}`, skills: [], current_workload: 0, availability_status: 'available', area_coverage: [], created_at: now, updated_at: now });

    const password_hash = await bcrypt.hash(String(password), 10);
    // Best-effort: create a shadow Firebase account so "forgot password" works later.
    // This never blocks or fails signup.
    const firebase_uid = await ensureFirebaseShadowAccount(email);
    await User.create({ email, password_hash, profile_id: id, ...(firebase_uid ? { firebase_uid } : {}) });

    const token = signSessionToken({ profile_id: id, email });
    res.status(201).json({ token, user: { uid: id, email, displayName: fullName }, profile });
  } catch (e) {
    console.error('Signup failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    const profile = await getById('profiles', user.profile_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    if (profile.is_active === false) return res.status(403).json({ error: 'Your account is inactive.' });

    const token = signSessionToken(user);
    res.json({ token, user: { uid: user.profile_id, email: user.email, displayName: profile.full_name }, profile });
  } catch (e) {
    console.error('Login failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const profile = await getById('profiles', req.auth.sub);
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });
  if (profile.is_active === false) return res.status(403).json({ error: 'Your account is inactive.' });
  res.json({ user: { uid: req.auth.sub, email: req.auth.email, displayName: profile.full_name }, profile });
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required.' });
    if (String(newPassword).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const user = await User.findOne({ profile_id: req.auth.sub });
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    const valid = await bcrypt.compare(String(currentPassword), user.password_hash || '');
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    user.password_hash = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/change-email', auth, async (req, res) => {
  try {
    const { currentPassword, newEmail: rawEmail } = req.body || {};
    const newEmail = String(rawEmail || '').trim().toLowerCase();
    if (!currentPassword || !newEmail) return res.status(400).json({ error: 'Current password and new email are required.' });

    const user = await User.findOne({ profile_id: req.auth.sub });
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    const valid = await bcrypt.compare(String(currentPassword), user.password_hash || '');
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const duplicate = await User.findOne({ email: newEmail, profile_id: { $ne: req.auth.sub } });
    if (duplicate) return res.status(409).json({ error: 'This email is already linked to another CampusFix profile.' });

    user.email = newEmail;
    await user.save();
    await modelFor('profiles').updateOne({ _id: req.auth.sub }, { $set: { email: newEmail, updated_at: new Date().toISOString() } });
    res.json({ email: newEmail });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Forgot password: step 1 — send the reset email via Firebase.
// Always responds with the same generic message, whether or not the email
// is registered, so this endpoint can't be used to check which emails exist.
app.post('/api/auth/forgot-password', async (req, res) => {
  const generic = { ok: true, message: 'If this email is registered, a password reset link has been sent.' };
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email });
    if (user) {
      if (!user.firebase_uid) {
        const uid = await ensureFirebaseShadowAccount(email);
        if (uid) { user.firebase_uid = uid; await user.save(); }
      }
      await firebaseSendPasswordResetEmail(email);
    }
    res.json(generic);
  } catch (e) {
    console.error('Forgot-password request failed:', e.message || e);
    // Still return the generic response so we don't leak account existence or provider errors.
    res.json(generic);
  }
});

// Forgot password: step 2 — the user opens the emailed link (which lands on our
// own Reset Password screen with an oobCode in the URL) and submits a new password.
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { oobCode, newPassword } = req.body || {};
    if (!oobCode || !newPassword) return res.status(400).json({ error: 'Reset code and new password are required.' });
    if (String(newPassword).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const email = await firebaseConfirmPasswordReset(oobCode, String(newPassword));
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'No CampusFix account matches this reset link.' });

    user.password_hash = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    const message = /EXPIRED_OOB_CODE/.test(e.message) ? 'This reset link has expired. Please request a new one.'
      : /INVALID_OOB_CODE/.test(e.message) ? 'This reset link is invalid or has already been used.'
      : e.message;
    res.status(400).json({ error: message });
  }
});

// Keep complaint photos and videos in MongoDB instead of Render's ephemeral filesystem.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const supported = file.mimetype?.startsWith('image/') || file.mimetype?.startsWith('video/');
    if (!supported) return cb(new Error('Only photo and video files are allowed.'));
    cb(null, true);
  },
});

const singleMediaUpload = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Photo or video must be 20 MB or smaller.' });
    }
    return res.status(400).json({ error: error.message || 'Media upload was rejected.' });
  });
};

app.post('/api/upload', auth, singleMediaUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A photo or video is required.' });
    if (!mongoose.connection.db) return res.status(503).json({ error: 'Media storage is not ready.' });

    const extension = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
        metadata: {
          contentType: req.file.mimetype,
          originalName: req.file.originalname,
          uploadedBy: req.auth?.sub || null,
        },
      });
      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.end(req.file.buffer);
    });

    const base = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({ url: `${base}/uploads/${filename}` });
  } catch (error) {
    console.error('Media upload failed:', error);
    res.status(500).json({ error: error.message || 'Media upload failed.' });
  }
});

app.get('/api/data/:collection', auth, async (req, res) => {
  try {
    const Model = modelFor(req.params.collection);
    const filters = req.query.filters ? JSON.parse(String(req.query.filters)) : [];
    const query = buildMongoQuery(filters);
    let cursor = Model.find(query).lean();
    if (req.query.sort) cursor = cursor.sort({ [String(req.query.sort)]: req.query.ascending === 'false' ? -1 : 1 });
    if (req.query.limit) cursor = cursor.limit(Number(req.query.limit));
    const docs = await cursor;
    const rows = await Promise.all(docs.map(d => enrich(req.params.collection, toPublic(d))));
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/data/:collection', auth, async (req, res) => {
  try {
    const values = Array.isArray(req.body) ? req.body : [req.body];
    const now = new Date().toISOString();
    const made = [];
    for (const raw of values) {
      const id = raw.id && mongoose.isValidObjectId(raw.id) ? raw.id : new mongoose.Types.ObjectId().toString();
      const doc = await modelFor(req.params.collection).create({ _id: id, ...raw, id, created_at: raw.created_at || now, updated_at: now });
      made.push(await enrich(req.params.collection, toPublic(doc)));
    }
    res.status(201).json(Array.isArray(req.body) ? made : made[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.patch('/api/data/:collection', auth, async (req, res) => {
  try {
    const filters = req.body.filters || [];
    if (!Array.isArray(filters) || filters.length === 0) {
      return res.status(400).json({ error: 'At least one filter is required for an update.' });
    }
    const query = buildMongoQuery(filters);
    const result = await modelFor(req.params.collection).updateMany(query, { $set: { ...req.body.values, updated_at: new Date().toISOString() } });
    res.json({ matched: result.matchedCount, modified: result.modifiedCount });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/data/:collection', auth, async (req, res) => {
  try {
    const filters = req.body.filters || [];
    if (!Array.isArray(filters) || filters.length === 0) {
      return res.status(400).json({ error: 'At least one filter is required for a delete.' });
    }
    const query = buildMongoQuery(filters);
    const result = await modelFor(req.params.collection).deleteMany(query);
    res.json({ deleted: result.deletedCount });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

const DEFAULT_CATEGORIES = [
  { id: 'electrical', name: 'Electrical', color: '#176fe5', sla_hours: 24 },
  { id: 'plumbing', name: 'Plumbing', color: '#2d9a58', sla_hours: 24 },
  { id: 'furniture', name: 'Furniture', color: '#8b5cf6', sla_hours: 72 },
  { id: 'it-network', name: 'IT / Network', color: '#0ea5e9', sla_hours: 24 },
  { id: 'cleanliness', name: 'Cleanliness', color: '#f59e0b', sla_hours: 12 },
  { id: 'other', name: 'Other', color: '#64748b', sla_hours: 48 },
];

const DEFAULT_BUILDINGS = [
  { id: 'main-block', name: 'Main Block' },
  { id: 'academic-block', name: 'Academic Block' },
  { id: 'hostel-a', name: 'Hostel A' },
  { id: 'hostel-b', name: 'Hostel B' },
  { id: 'library', name: 'Library' },
];

async function seedReferenceData() {
  const now = new Date().toISOString();
  const categories = modelFor('complaint_categories');
  const buildings = modelFor('buildings');
  await Promise.all([
    ...DEFAULT_CATEGORIES.map(item => categories.updateOne(
      { id: item.id },
      { $setOnInsert: { ...item, created_at: now, updated_at: now } },
      { upsert: true },
    )),
    ...DEFAULT_BUILDINGS.map(item => buildings.updateOne(
      { id: item.id },
      { $setOnInsert: { ...item, created_at: now, updated_at: now } },
      { upsert: true },
    )),
  ]);
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) {
    console.log('Admin auto-seed skipped. Set ADMIN_EMAIL and ADMIN_PASSWORD to enable it.');
    return;
  }
  if (!JWT_SECRET) console.warn('JWT_SECRET is not set — logins will fail until it is configured.');

  const existing = await User.findOne({ email });
  if (existing) return; // already seeded

  const id = new mongoose.Types.ObjectId().toString();
  const now = new Date().toISOString();
  await modelFor('profiles').create({ _id: id, id, email, full_name: 'CampusFix Admin', role: 'admin', is_active: true, created_at: now, updated_at: now });
  const password_hash = await bcrypt.hash(password, 10);
  const firebase_uid = await ensureFirebaseShadowAccount(email); // best-effort, only for "forgot password" later
  await User.create({ email, password_hash, profile_id: id, ...(firebase_uid ? { firebase_uid } : {}) });
  console.log(`Default admin created: ${email}`);
}


const mongoUri = String(process.env.MONGODB_URI || '').trim();

function validateMongoUri(uri) {
  if (!uri) throw new Error('MONGODB_URI is missing. Create server/.env with a valid MongoDB connection string (see MONGODB_SETUP.md).');
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new Error('MONGODB_URI is not a valid MongoDB connection string.');
  if (uri.includes('<db_password>') || uri.includes('YOUR_PASSWORD')) throw new Error('MONGODB_URI still contains a placeholder password. Replace it with your real Atlas database password.');
}

async function connectMongoDB() {
  validateMongoUri(mongoUri);
  dns.setDefaultResultOrder('ipv4first');

  const options = {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    family: 4,
  };

  try {
    await mongoose.connect(mongoUri, options);
  } catch (firstError) {
    const message = String(firstError?.message || firstError);
    const isSrvDnsError = /querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT/i.test(message) && mongoUri.startsWith('mongodb+srv://');
    if (!isSrvDnsError) throw firstError;

    console.warn('MongoDB SRV DNS lookup failed. Retrying with Google/Cloudflare DNS...');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    await mongoose.disconnect().catch(() => {});
    await mongoose.connect(mongoUri, options);
  }
}

connectMongoDB().then(async () => {
  console.log('MongoDB connected');
  await seedReferenceData();
  await seedAdmin();
  app.listen(PORT, () => console.log(`CampusFix API running on http://localhost:${PORT}`));
}).catch(err => {
  const message = String(err?.message || err);
  console.error('MongoDB connection failed:', message);
  if (/querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT/i.test(message)) {
    console.error('DNS issue: on Windows, set your network DNS to 8.8.8.8 and 1.1.1.1 in Settings > Network, temporarily turn off any VPN/proxy, then restart the server.');
  } else if (/bad auth|Authentication failed/i.test(message)) {
    console.error('Username or password is incorrect. Reset the password in MongoDB Atlas > Database Access, update MONGODB_URI, and restart the server.');
  } else if (/IP.*access|not authorized|whitelist/i.test(message)) {
    console.error('Add your current IP address (or 0.0.0.0/0 for Render) in MongoDB Atlas > Network Access.');
  }
  process.exit(1);
});
