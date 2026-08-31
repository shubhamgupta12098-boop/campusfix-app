import { randomBytes } from 'node:crypto';
import { config } from './config.mjs';

const FIREBASE_BASE = 'https://identitytoolkit.googleapis.com/v1';

async function firebaseRequest(endpoint, body) {
  if (!config.firebaseApiKey) throw new Error('Firebase Forgot Password is not configured. Add FIREBASE_API_KEY.');
  const response = await fetch(`${FIREBASE_BASE}/${endpoint}?key=${encodeURIComponent(config.firebaseApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.error?.message || `FIREBASE_${response.status}`;
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return payload;
}

export async function ensureFirebaseResetIdentity(email) {
  const temporary = `Tmp!${randomBytes(24).toString('base64url')}aA1`;
  try {
    await firebaseRequest('accounts:signUp', { email, password: temporary, returnSecureToken: false });
  } catch (error) {
    if (error?.code !== 'EMAIL_EXISTS') throw error;
  }
}

export async function sendFirebasePasswordReset(email, portalRole) {
  await ensureFirebaseResetIdentity(email);
  const body = { requestType: 'PASSWORD_RESET', email };
  if (config.appBaseUrl) {
    const role = ['student', 'admin', 'staff'].includes(portalRole) ? portalRole : 'student';
    body.continueUrl = `${config.appBaseUrl}/${role}/?passwordReset=done`;
  }
  return firebaseRequest('accounts:sendOobCode', body);
}

export async function verifyFirebasePassword(email, password) {
  try {
    const result = await firebaseRequest('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });
    return Boolean(result?.idToken);
  } catch {
    return false;
  }
}
