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
const IS_PRODUCTION = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const JWT_SECRET = String(process.env.JWT_SECRET || (IS_PRODUCTION ? '' : 'local-dev-only-secret')).trim();
if (!JWT_SECRET) throw new Error('JWT_SECRET is required in production. Add it in Render Environment settings.');
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
  password_hash: { type: String, required: true },
  profile_id: { type: String, required: true }
}, { timestamps: true, versionKey: false }), 'auth_users');

const FIREBASE_WEB_API_KEY = String(process.env.FIREBASE_WEB_API_KEY || '').trim();

function firebaseErrorCode(payload) {
  const raw = String(payload?.error?.message || payload?.message || 'FIREBASE_AUTH_ERROR');
  return raw.split(' : ')[0].trim();
}

async function firebaseAuthRequest(endpoint, body) {
  if (!FIREBASE_WEB_API_KEY) {
    const error = new Error('Firebase password reset is not configured. Add FIREBASE_WEB_API_KEY in Render.');
    error.code = 'FIREBASE_NOT_CONFIGURED';
    throw error;
  }

  let response;
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (cause) {
    const error = new Error('Could not reach Firebase Authentication. Please try again.');
    error.code = 'FIREBASE_UNREACHABLE';
    error.cause = cause;
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(firebaseErrorCode(payload));
    error.code = firebaseErrorCode(payload);
    throw error;
  }
  return payload;
}

async function ensureFirebaseRecoveryUser(email) {
  try {
    // Firebase is used only as the forgotten-password recovery service. App
    // signup/login/session/data remain MongoDB-backed. Existing MongoDB users
    // are lazily mirrored here only when they request a reset.
    await firebaseAuthRequest('accounts:signUp', {
      email,
      password: crypto.randomBytes(36).toString('base64url'),
      returnSecureToken: true,
    });
  } catch (error) {
    if (error?.code !== 'EMAIL_EXISTS') throw error;
  }
}

function friendlyFirebaseResetError(error) {
  const code = String(error?.code || error?.message || '');
  if (code === 'FIREBASE_NOT_CONFIGURED') return 'Password reset is not configured. Add FIREBASE_WEB_API_KEY in Render.';
  if (/API_KEY_INVALID|API key not valid|INVALID_API_KEY/i.test(code)) return 'Firebase rejected the API key. Check FIREBASE_WEB_API_KEY in Render.';
  if (code === 'OPERATION_NOT_ALLOWED') return 'Enable the Email/Password sign-in provider in Firebase Authentication.';
  if (code === 'EXPIRED_OOB_CODE') return 'This password reset link has expired. Please request a new one.';
  if (code === 'INVALID_OOB_CODE') return 'This password reset link is invalid or has already been used.';
  if (code === 'USER_DISABLED') return 'This password reset account is disabled in Firebase.';
  if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') return 'Too many reset attempts. Please wait a little and try again.';
  if (code === 'FIREBASE_UNREACHABLE') return 'Could not reach Firebase Authentication. Please try again.';
  return 'Firebase could not complete the password reset. Please try again.';
}

const toPublic = (doc) => {
  const obj = doc?.toObject ? doc.toObject() : { ...doc };
  if (!obj) return obj;
  obj.id = String(obj._id || obj.id);
  delete obj._id;
  delete obj.__v;
  return obj;
};
const tokenFor = (user) => jwt.sign({ sub: user.profile_id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

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
const auth = async (req, res, next) => {
  try {
    const raw = req.headers.authorization || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Session expired. Please sign in again.' }); }
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
    const { email, password, fullName, role, ...extra } = req.body;
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !password || !fullName) return res.status(400).json({ error: 'Name, email and password are required.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (await User.exists({ email: normalized })) return res.status(409).json({ error: 'This email is already registered.' });
    const id = new mongoose.Types.ObjectId().toString();
    const now = new Date().toISOString();
    const safeRole = role === 'staff' ? 'staff' : 'student';
    const profile = { id, email: normalized, full_name: fullName, role: safeRole, is_active: true, created_at: now, updated_at: now, ...extra };
    await modelFor('profiles').create({ _id: id, ...profile });
    if (safeRole === 'staff') await modelFor('technicians').create({ _id: id, id, employee_code: extra.college_id || `STF-${Date.now().toString().slice(-6)}`, skills: [], current_workload: 0, availability_status: 'available', area_coverage: [], created_at: now, updated_at: now });
    const user = await User.create({ email: normalized, password_hash: await bcrypt.hash(password, 12), profile_id: id });
    res.status(201).json({ token: tokenFor(user), user: { uid: id, email: normalized, displayName: fullName }, profile });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
  const profile = await getById('profiles', user.profile_id);
  if (!profile) return res.status(404).json({ error: 'User profile is missing.' });
  if (profile.is_active === false) return res.status(403).json({ error: 'Your account is inactive.' });
  res.json({ token: tokenFor(user), user: { uid: user.profile_id, email: user.email, displayName: profile.full_name }, profile });
});
app.get('/api/auth/me', auth, async (req, res) => {
  const profile = await getById('profiles', req.auth.sub);
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });
  res.json({ user: { uid: req.auth.sub, email: req.auth.email, displayName: profile.full_name }, profile });
});
app.post('/api/auth/change-password', auth, async (req, res) => {
  const user = await User.findOne({ profile_id: req.auth.sub });
  if (!user || !(await bcrypt.compare(req.body.currentPassword || '', user.password_hash))) return res.status(400).json({ error: 'Current password is incorrect.' });
  user.password_hash = await bcrypt.hash(req.body.newPassword, 12); await user.save(); res.json({ ok: true });
});
app.post('/api/auth/change-email', auth, async (req, res) => {
  const user = await User.findOne({ profile_id: req.auth.sub });
  if (!user || !(await bcrypt.compare(req.body.currentPassword || '', user.password_hash))) return res.status(400).json({ error: 'Current password is incorrect.' });
  const email = String(req.body.newEmail || '').trim().toLowerCase();
  if (await User.exists({ email, _id: { $ne: user._id } })) return res.status(409).json({ error: 'This email is already registered.' });
  user.email = email; await user.save();
  await modelFor('profiles').updateOne({ _id: req.auth.sub }, { $set: { email, updated_at: new Date().toISOString() } });
  res.json({ email, token: tokenFor(user) });
});
app.post('/api/auth/password-reset', async (req, res) => {
  const generic = { ok: true, message: 'If an account exists for this email, a Firebase password reset link has been sent.' };
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    // Keep the response generic so this endpoint cannot be used to discover
    // which email addresses are registered in MongoDB.
    const user = await User.findOne({ email }).lean();
    if (!user) return res.json(generic);

    await ensureFirebaseRecoveryUser(email);
    await firebaseAuthRequest('accounts:sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email,
    });
    res.json(generic);
  } catch (error) {
    console.error('Firebase password reset email error:', error);
    res.status(500).json({ error: friendlyFirebaseResetError(error) });
  }
});

app.post('/api/auth/verify-password-reset', async (req, res) => {
  try {
    const oobCode = String(req.body.oobCode || '');
    if (!oobCode) return res.status(400).json({ error: 'Password reset code is missing.' });
    const result = await firebaseAuthRequest('accounts:resetPassword', { oobCode });
    const email = String(result.email || '').trim().toLowerCase();
    if (!email || !(await User.exists({ email }))) return res.status(400).json({ error: 'This reset link is not connected to a CampusFix account.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: friendlyFirebaseResetError(error) });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const oobCode = String(req.body.oobCode || '');
    const password = String(req.body.password || '');
    if (!oobCode || password.length < 6) return res.status(400).json({ error: 'A valid reset code and a password of at least 6 characters are required.' });

    // First verify without consuming the one-time code, then make sure it maps
    // to a real MongoDB account. Firebase remains only the recovery mechanism.
    const verified = await firebaseAuthRequest('accounts:resetPassword', { oobCode });
    const email = String(verified.email || '').trim().toLowerCase();
    const user = email ? await User.findOne({ email }) : null;
    if (!user) return res.status(400).json({ error: 'This reset link is not connected to a CampusFix account.' });

    // Confirm the Firebase reset, then write the same new password hash into
    // MongoDB. Normal sign-in continues to validate only against MongoDB.
    await firebaseAuthRequest('accounts:resetPassword', { oobCode, newPassword: password });
    user.password_hash = await bcrypt.hash(password, 12);
    await user.save();
    res.json({ ok: true, message: 'Password changed successfully. You can now sign in.' });
  } catch (error) {
    console.error('Firebase password reset confirmation error:', error);
    res.status(400).json({ error: friendlyFirebaseResetError(error) });
  }
});

// Keep uploads in MongoDB instead of Render's ephemeral filesystem.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});

app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image is required.' });
    if (!mongoose.connection.db) return res.status(503).json({ error: 'Image storage is not ready.' });

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
    console.error('Image upload failed:', error);
    res.status(500).json({ error: error.message || 'Image upload failed.' });
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
    const query = buildMongoQuery(filters);
    const result = await modelFor(req.params.collection).updateMany(query, { $set: { ...req.body.values, updated_at: new Date().toISOString() } });
    res.json({ matched: result.matchedCount, modified: result.modifiedCount });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/data/:collection', auth, async (req, res) => {
  try {
    const filters = req.body.filters || [];
    const query = buildMongoQuery(filters);
    const result = await modelFor(req.params.collection).deleteMany(query);
    res.json({ deleted: result.deletedCount });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || 'admin@campusfix.local').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '').trim();
  if (await User.exists({ email })) return;
  if (!password) {
    console.warn('ADMIN_PASSWORD is not set; skipping automatic admin creation.');
    return;
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  const id = new mongoose.Types.ObjectId().toString(); const now = new Date().toISOString();
  await modelFor('profiles').create({ _id: id, id, email, full_name: 'CampusFix Admin', role: 'admin', is_active: true, created_at: now, updated_at: now });
  await User.create({ email, password_hash: await bcrypt.hash(password, 12), profile_id: id });
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
