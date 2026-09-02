import { randomBytes } from 'node:crypto';
import { config } from './config.mjs';

const FIREBASE_BASE = 'https://identitytoolkit.googleapis.com/v1';

async function firebaseRequest(endpoint, body) {
  if (!config.firebaseApiKey) {
    throw new Error('Firebase Forgot Password is not configured. Add FIREBASE_API_KEY in Render Environment.');
  }

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

// Keeps a Firebase Authentication identity available for password-recovery email.
// CCMMS remains the source of truth for app accounts/profile/roles in MongoDB.
export async function createFirebasePasswordIdentity(email, password) {
  if (!config.firebaseApiKey) return { configured: false, created: false };
  try {
    await firebaseRequest('accounts:signUp', {
      email,
      password,
      returnSecureToken: false,
    });
    return { configured: true, created: true };
  } catch (error) {
    if (error?.code === 'EMAIL_EXISTS') return { configured: true, created: false };
    throw error;
  }
}

export async function ensureFirebaseResetIdentity(email) {
  const temporary = `Tmp!${randomBytes(24).toString('base64url')}aA1`;
  return createFirebasePasswordIdentity(email, temporary);
}

export async function sendFirebasePasswordReset(email) {
  await ensureFirebaseResetIdentity(email);
  // Do not force a continueUrl here. Firebase's hosted reset page works without
  // extra authorized-domain configuration, which makes both localhost testing
  // and Render deployment more reliable.
  return firebaseRequest('accounts:sendOobCode', {
    requestType: 'PASSWORD_RESET',
    email,
  });
}

export async function verifyFirebasePassword(email, password) {
  if (!config.firebaseApiKey) return false;
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
