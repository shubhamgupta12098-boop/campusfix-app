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
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean);
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // non-browser clients (curl, server-to-server, health checks)
  if (allowedOrigins.includes(origin)) return true;
  // Safety net for Render deployments: allow any *.onrender.com origin even if CLIENT_URL was
  // misconfigured, so a wrong/missing CLIENT_URL doesn't silently break login for everyone.
  try { if (new URL(origin).hostname.endsWith('.onrender.com')) return true; } catch { /* ignore invalid origin */ }
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
app.use('/uploads', express.static(uploadDir));
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

const PasswordResetToken = mongoose.model('password_reset_tokens', new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  token_hash: { type: String, required: true, unique: true, index: true },
  expires_at: { type: Date, required: true, index: { expires: 0 } },
  used_at: { type: Date, default: null }
}, { timestamps: true, versionKey: false }), 'password_reset_tokens');

const mailTransport = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  if (!host || !user || !pass) return null;
  const gmail = /gmail\.com$/i.test(host);
  return nodemailer.createTransport({
    ...(gmail ? { service: 'gmail' } : { host }),
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: String(user).trim(), pass },
    tls: { rejectUnauthorized: false },
  });
};

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
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const generic = { ok: true, message: 'If this email is registered, a password reset link has been sent.' };
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const user = await User.findOne({ email });
    if (!user) return res.json(generic);

    await PasswordResetToken.deleteMany({ user_id: user.profile_id, used_at: null });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await PasswordResetToken.create({
      user_id: user.profile_id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
    });

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
    const resetUrl = `${clientUrl}/?resetToken=${encodeURIComponent(rawToken)}`;
    const transport = mailTransport();
    if (!transport) {
      console.warn('SMTP is not configured. Password reset URL:', resetUrl);
      if (process.env.NODE_ENV !== 'production') return res.json({ ...generic, devResetUrl: resetUrl });
      return res.status(503).json({ error: 'Email service is not configured. Ask the administrator to configure SMTP.' });
    }

    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'CMMS password reset',
      text: `CampusFix password reset link (valid for 30 minutes): ${resetUrl}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Reset your CMMS password</h2><p>This link is valid for 30 minutes.</p><p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Reset Password</a></p><p>If you did not request this, ignore this email.</p></div>`,
    });
    res.json(generic);
  } catch (e) {
    const raw = String(e?.message || e);
    const hint = /535|BadCredentials|Username and Password not accepted/i.test(raw)
      ? 'Gmail ne login reject kiya. SMTP_PASS me normal password nahi, Google ka 16-character App Password use karein.'
      : raw;
    res.status(500).json({ error: `Password reset email could not be sent: ${hint}` });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!token || password.length < 6) return res.status(400).json({ error: 'Valid token and a password of at least 6 characters are required.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const reset = await PasswordResetToken.findOne({ token_hash: tokenHash, used_at: null, expires_at: { $gt: new Date() } });
    if (!reset) return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    const user = await User.findOne({ profile_id: reset.user_id });
    if (!user) return res.status(404).json({ error: 'User account not found.' });
    user.password_hash = await bcrypt.hash(password, 12);
    await user.save();
    reset.used_at = new Date();
    await reset.save();
    await PasswordResetToken.deleteMany({ user_id: reset.user_id, used_at: null });
    res.json({ ok: true, message: 'Password changed successfully. You can now sign in.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const storage = multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname || '') || '.jpg'}`) });
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')) });
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image is required.' });
  const base = `${req.protocol}://${req.get('host')}`;
  res.status(201).json({ url: `${base}/uploads/${req.file.filename}` });
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
  const email = (process.env.ADMIN_EMAIL || 'admin@campusfix.local').toLowerCase();
  if (await User.exists({ email })) return;
  const id = new mongoose.Types.ObjectId().toString(); const now = new Date().toISOString();
  await modelFor('profiles').create({ _id: id, id, email, full_name: 'CampusFix Admin', role: 'admin', is_active: true, created_at: now, updated_at: now });
  await User.create({ email, password_hash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 12), profile_id: id });
  console.log(`Default admin created: ${email}`);
}

const mongoUri = String(process.env.MONGODB_URI || '').trim();

function validateMongoUri(uri) {
  if (!uri) throw new Error('MONGODB_URI missing hai. server/.env file run setup-mongodb.ps1 se banayein.');
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new Error('MONGODB_URI valid MongoDB connection string nahi hai.');
  if (uri.includes('<db_password>') || uri.includes('YOUR_PASSWORD')) throw new Error('MONGODB_URI me placeholder password abhi replace nahi hua hai.');
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

    console.warn('MongoDB SRV DNS lookup fail hua. Google/Cloudflare DNS ke saath retry ho raha hai...');
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
    console.error('DNS issue: Windows me Settings > Network > DNS ko 8.8.8.8 aur 1.1.1.1 set karein, VPN/proxy temporarily off karein, phir server restart karein.');
  } else if (/bad auth|Authentication failed/i.test(message)) {
    console.error('Username/password galat hai. Atlas Database Access me password reset karke setup-mongodb.ps1 dobara chalayein.');
  } else if (/IP.*access|not authorized|whitelist/i.test(message)) {
    console.error('Atlas Network Access me current IP address add karein.');
  }
  process.exit(1);
});
