import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbCollection, cleanDoc, newId } from './db.mjs';
import { config } from './config.mjs';
import { sendFirebasePasswordReset, verifyFirebasePassword } from './firebase.mjs';

export const authRouter = express.Router();

const forgotAttempts = new Map();
function forgotRateLimit(req, email) {
  const key = `${req.ip || 'unknown'}:${email}`;
  const now = Date.now();
  const previous = forgotAttempts.get(key) || [];
  const recent = previous.filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  forgotAttempts.set(key, recent);
  return true;
}

function portalRole(req) {
  const role = String(req.get('x-portal-role') || '').toLowerCase();
  return ['student', 'admin', 'staff'].includes(role) ? role : null;
}

function publicUser(profile) {
  return { uid: profile.id, email: profile.email, displayName: profile.full_name };
}

function issueToken(profile) {
  return jwt.sign({ sub: profile.id, role: profile.role, email: profile.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export async function requireAuth(req, res, next) {
  try {
    const raw = String(req.get('authorization') || '');
    if (!raw.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
    const token = raw.slice(7);
    const claims = jwt.verify(token, config.jwtSecret);
    const profile = cleanDoc(await dbCollection('profiles').findOne({ id: String(claims.sub) }));
    if (!profile || profile.is_active === false) return res.status(401).json({ error: 'Account is inactive or unavailable.' });
    req.auth = { token, claims, profile, profileId: profile.id, role: profile.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const expectedRole = portalRole(req);
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const authCollection = dbCollection('auth_users');
    const authUser = await authCollection.findOne({ email });
    if (!authUser) return res.status(401).json({ error: 'Invalid email or password.' });
    const profile = cleanDoc(await dbCollection('profiles').findOne({ id: authUser.profile_id }));
    if (!profile) return res.status(401).json({ error: 'Profile not found.' });
    if (expectedRole && profile.role !== expectedRole) return res.status(403).json({ error: `Please use a ${expectedRole[0].toUpperCase() + expectedRole.slice(1)} account on this portal.` });
    if (profile.is_active === false) return res.status(403).json({ error: 'Your account is inactive.' });

    let valid = await bcrypt.compare(password, authUser.password_hash || '');
    if (!valid && config.firebaseApiKey) {
      // Firebase is only used as the forgot-password bridge. After a Firebase
      // reset succeeds, the first login with the new password re-syncs MongoDB.
      valid = await verifyFirebasePassword(email, password);
      if (valid) {
        await authCollection.updateOne({ id: authUser.id }, {
          $set: { password_hash: await bcrypt.hash(password, 12), updated_at: new Date().toISOString() },
        });
      }
    }
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    return res.json({ token: issueToken(profile), user: publicUser(profile), profile });
  } catch (error) { next(error); }
});

authRouter.post('/signup', async (req, res, next) => {
  try {
    const expectedRole = portalRole(req) || 'student';
    if (expectedRole === 'admin' && !config.allowAdminSignup) return res.status(403).json({ error: 'Admin self-signup is disabled. Use the seeded admin or create admins from User Management.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const fullName = String(req.body?.fullName || '').trim();
    if (!email || !password || !fullName) return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (await dbCollection('auth_users').findOne({ email })) return res.status(409).json({ error: 'This email is already registered.' });

    const now = new Date().toISOString();
    const id = newId('profile');
    const profile = {
      id,
      email,
      full_name: fullName,
      role: expectedRole,
      college_id: req.body?.college_id || '',
      department: req.body?.department || '',
      hostel: req.body?.hostel || '',
      block: req.body?.block || '',
      room: req.body?.room || '',
      phone: req.body?.phone || '',
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    await dbCollection('profiles').insertOne(profile);
    await dbCollection('auth_users').insertOne({
      id,
      profile_id: id,
      email,
      password_hash: await bcrypt.hash(password, 12),
      created_at: now,
      updated_at: now,
    });
    if (expectedRole === 'staff') {
      await dbCollection('technicians').insertOne({
        id,
        employee_code: profile.college_id || `STF-${Date.now().toString().slice(-6)}`,
        skills: [],
        current_workload: 0,
        availability_status: 'available',
        area_coverage: [],
        created_at: now,
        updated_at: now,
      });
    }
    return res.status(201).json({ token: issueToken(profile), user: publicUser(profile), profile });
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.auth.profile), profile: req.auth.profile });
});

authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    const authUser = await dbCollection('auth_users').findOne({ profile_id: req.auth.profileId });
    if (!authUser || !(await bcrypt.compare(currentPassword, authUser.password_hash || ''))) return res.status(400).json({ error: 'Current password is incorrect.' });
    await dbCollection('auth_users').updateOne({ id: authUser.id }, { $set: { password_hash: await bcrypt.hash(newPassword, 12), updated_at: new Date().toISOString() } });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

authRouter.post('/change-email', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();
    if (!newEmail) return res.status(400).json({ error: 'New email is required.' });
    const authUser = await dbCollection('auth_users').findOne({ profile_id: req.auth.profileId });
    if (!authUser || !(await bcrypt.compare(currentPassword, authUser.password_hash || ''))) return res.status(400).json({ error: 'Current password is incorrect.' });
    const duplicate = await dbCollection('auth_users').findOne({ email: newEmail, id: { $ne: authUser.id } });
    if (duplicate) return res.status(409).json({ error: 'This email is already linked to another account.' });
    const now = new Date().toISOString();
    await Promise.all([
      dbCollection('auth_users').updateOne({ id: authUser.id }, { $set: { email: newEmail, updated_at: now } }),
      dbCollection('profiles').updateOne({ id: req.auth.profileId }, { $set: { email: newEmail, updated_at: now } }),
    ]);
    res.json({ email: newEmail });
  } catch (error) { next(error); }
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Registered email is required.' });
    if (!forgotRateLimit(req, email)) return res.status(429).json({ error: 'Too many reset requests. Please wait a few minutes and try again.' });
    const account = await dbCollection('auth_users').findOne({ email });
    // Do not reveal whether an account exists.
    if (account) await sendFirebasePasswordReset(email, portalRole(req));
    res.json({ ok: true, message: 'If this email is registered, Firebase has sent a password reset link. Check Inbox and Spam.' });
  } catch (error) {
    if (String(error?.message || '').includes('FIREBASE_API_KEY')) return res.status(503).json({ error: error.message });
    next(error);
  }
});

authRouter.post('/reset-password', (_req, res) => {
  res.status(400).json({ error: 'Password reset is handled by the secure Firebase email link. Open the link from your email, set the new password, then sign in here.' });
});
