import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbCollection, cleanDoc, newId } from './db.mjs';
import { config } from './config.mjs';
import { createFirebasePasswordIdentity, firebaseErrorMessage, sendFirebasePasswordReset, verifyFirebasePassword } from './firebase.mjs';
import { consumePasswordResetToken, hasSmtpPasswordReset, sendSmtpPasswordReset } from './mail.mjs';

export const authRouter = express.Router();
const SESSION_COOKIE = 'ccmms_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readCookie(req, name) {
  const raw = String(req.get('cookie') || '');
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return part.slice(index + 1).trim(); }
  }
  return '';
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  };
}
function setSessionCookie(res, token) { res.cookie(SESSION_COOKIE, token, cookieOptions()); }
function clearSessionCookie(res) { res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined }); }

const forgotAttempts = new Map();
function forgotRateLimit(req, email) {
  const key = `${req.ip || 'unknown'}:${email}`;
  const now = Date.now();
  const recent = (forgotAttempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now); forgotAttempts.set(key, recent); return true;
}
function portalRole(req) {
  const role = String(req.get('x-portal-role') || '').toLowerCase();
  return ['student', 'admin', 'staff'].includes(role) ? role : null;
}
function publicUser(profile) { return { uid: profile.id, email: profile.email, displayName: profile.full_name, role: profile.role }; }
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function issueToken(profile) { return jwt.sign({ sub: profile.id, role: profile.role, email: profile.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn }); }

export async function requireAuth(req, res, next) {
  try {
    const raw = String(req.get('authorization') || '');
    const bearer = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
    const token = bearer || readCookie(req, SESSION_COOKIE);
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const claims = jwt.verify(token, config.jwtSecret);
    const profile = cleanDoc(await dbCollection('profiles').findOne({ id: String(claims.sub) }));
    if (!profile || profile.is_active === false) return res.status(401).json({ error: 'Account is inactive or unavailable.' });
    const expectedRole = portalRole(req);
    if (expectedRole && profile.role !== expectedRole) return res.status(403).json({ error: `This account belongs to the ${profile.role} portal.` });
    req.auth = { token, claims, profile, profileId: profile.id, role: profile.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const expectedRole = portalRole(req);
    if (!identifier || !password) return res.status(400).json({ error: 'Email / College ID / Employee ID and password are required.' });

    const authCollection = dbCollection('auth_users');
    const profiles = dbCollection('profiles');
    let authUser = null; let profile = null;
    if (identifier.includes('@')) {
      authUser = await authCollection.findOne({ email: identifier.toLowerCase() });
      if (authUser) profile = cleanDoc(await profiles.findOne({ id: authUser.profile_id }));
    } else {
      profile = cleanDoc(await profiles.findOne({ college_id: { $regex: `^${escapeRegex(identifier)}$`, $options: 'i' } }));
      if (profile) authUser = await authCollection.findOne({ profile_id: profile.id });
    }
    if (!authUser || !profile) return res.status(401).json({ error: 'Invalid ID/email or password.' });
    if (expectedRole && profile.role !== expectedRole) return res.status(403).json({ error: `Please use a ${expectedRole} account on this portal.` });
    if (profile.is_active === false) return res.status(403).json({ error: 'Your account is inactive.' });

    let valid = await bcrypt.compare(password, authUser.password_hash || '');
    if (!valid && config.firebaseApiKey && authUser.firebase_recovery_enabled === true) {
      valid = await verifyFirebasePassword(authUser.email, password);
      if (valid) {
        await authCollection.updateOne({ id: authUser.id }, { $set: {
          password_hash: await bcrypt.hash(password, 12), firebase_recovery_enabled: false, updated_at: new Date().toISOString(),
        }});
      }
    }
    if (!valid) return res.status(401).json({ error: 'Invalid ID/email or password.' });
    const token = issueToken(profile);
    setSessionCookie(res, token);
    return res.json({ token, user: publicUser(profile), profile });
  } catch (error) { next(error); }
});

authRouter.post('/signup', async (req, res, next) => {
  try {
    const requestedRole = String(req.body?.role || '').trim().toLowerCase();
    const role = portalRole(req) || (['student', 'staff', 'admin'].includes(requestedRole) ? requestedRole : 'student');
    if (role === 'admin' && !config.allowAdminSignup) return res.status(403).json({ error: 'Admin self-signup is disabled.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const fullName = String(req.body?.fullName || '').trim();
    const collegeId = String(req.body?.college_id || req.body?.collegeId || '').trim();
    if (!email || !password || !fullName || !collegeId) return res.status(400).json({ error: 'Name, college/employee ID, email and password are required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (await dbCollection('auth_users').findOne({ email })) return res.status(409).json({ error: 'This email is already registered.' });
    if (await dbCollection('profiles').findOne({ college_id: { $regex: `^${escapeRegex(collegeId)}$`, $options: 'i' } })) return res.status(409).json({ error: 'This college/employee ID is already registered.' });

    const now = new Date().toISOString(); const id = newId('profile');
    const profile = {
      id, email, full_name: fullName, role, college_id: collegeId,
      department: req.body?.department || '', hostel: req.body?.hostel || '', block: req.body?.block || '', room: req.body?.room || '', phone: req.body?.phone || '',
      is_active: true, created_at: now, updated_at: now,
    };
    await dbCollection('profiles').insertOne(profile);
    await dbCollection('auth_users').insertOne({ id, profile_id: id, email, password_hash: await bcrypt.hash(password, 12), firebase_recovery_enabled: false, created_at: now, updated_at: now });
    if (role === 'staff') await dbCollection('technicians').insertOne({ id, employee_code: collegeId, skills: [], current_workload: 0, availability_status: 'available', area_coverage: [], created_at: now, updated_at: now });
    if (config.firebaseApiKey) createFirebasePasswordIdentity(email, password).catch((e) => console.warn('[Firebase signup]', e?.message || e));
    const token = issueToken(profile); setSessionCookie(res, token);
    res.status(201).json({ token, user: publicUser(profile), profile });
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, async (req, res) => res.json({ user: publicUser(req.auth.profile), profile: req.auth.profile }));
authRouter.post('/logout', (_req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || ''); const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    const authUser = await dbCollection('auth_users').findOne({ profile_id: req.auth.profileId });
    if (!authUser || !(await bcrypt.compare(currentPassword, authUser.password_hash || ''))) return res.status(400).json({ error: 'Current password is incorrect.' });
    await dbCollection('auth_users').updateOne({ id: authUser.id }, { $set: { password_hash: await bcrypt.hash(newPassword, 12), firebase_recovery_enabled: false, updated_at: new Date().toISOString() } });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

authRouter.post('/change-email', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || ''); const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();
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
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid registered email address.' });
    if (!forgotRateLimit(req, email)) return res.status(429).json({ error: 'Too many reset requests. Please wait and try again.' });

    const account = await dbCollection('auth_users').findOne({ email });
    if (!account) {
      return res.json({ ok: true, message: 'If this email is registered, a reset link will be sent.' });
    }

    let firebaseError = null;
    if (config.firebaseApiKey) {
      try {
        await sendFirebasePasswordReset(email);
        await dbCollection('auth_users').updateOne({ id: account.id }, { $set: {
          firebase_recovery_enabled: true,
          updated_at: new Date().toISOString(),
        }});
        return res.json({
          ok: true,
          delivery: 'firebase',
          message: 'Password reset link sent. Check Inbox, Promotions and Spam folders.',
        });
      } catch (error) {
        firebaseError = error;
        console.warn('[Firebase reset]', error?.code || error?.message || error);
      }
    }

    if (hasSmtpPasswordReset()) {
      try {
        await sendSmtpPasswordReset(email);
        await dbCollection('auth_users').updateOne({ id: account.id }, { $set: {
          firebase_recovery_enabled: false,
          updated_at: new Date().toISOString(),
        }});
        return res.json({
          ok: true,
          delivery: 'smtp',
          message: 'Password reset link sent by CCMMS email. Check Inbox, Promotions and Spam folders.',
        });
      } catch (error) {
        console.error('[SMTP reset]', error?.code || error?.message || error);
        if (!firebaseError) firebaseError = error;
      }
    }

    if (firebaseError) {
      return res.status(503).json({
        error: firebaseErrorMessage(firebaseError),
        hint: 'You can also configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM on Render as a fallback.',
      });
    }

    return res.status(503).json({
      error: 'Password reset email is not configured. Add FIREBASE_API_KEY or SMTP settings on Render.',
    });
  } catch (error) { next(error); }
});

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!token) return res.status(400).json({ error: 'Reset token is missing.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

    const email = await consumePasswordResetToken(token);
    if (!email) return res.status(400).json({ error: 'This reset link is invalid, expired, or already used.' });

    const account = await dbCollection('auth_users').findOne({ email });
    if (!account) return res.status(400).json({ error: 'This reset link is no longer valid.' });

    await dbCollection('auth_users').updateOne({ id: account.id }, { $set: {
      password_hash: await bcrypt.hash(newPassword, 12),
      firebase_recovery_enabled: false,
      updated_at: new Date().toISOString(),
    }});

    return res.json({ ok: true, message: 'Password updated successfully. You can sign in now.' });
  } catch (error) { next(error); }
});
