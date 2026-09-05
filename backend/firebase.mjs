import { randomBytes } from 'node:crypto';
import { config } from './config.mjs';

const FIREBASE_BASE = 'https://identitytoolkit.googleapis.com/v1';

function firebaseHelp(code) {
  const value = String(code || '');
  if (/OPERATION_NOT_ALLOWED/i.test(value)) return 'Enable Email/Password in Firebase Console > Authentication > Sign-in method.';
  if (/API_KEY_HTTP_REFERRER_BLOCKED/i.test(value)) return 'The Firebase Web API key is restricted to browser referrers. Allow server use for this key or configure SMTP fallback on Render.';
  if (/API_KEY_INVALID|INVALID_API_KEY/i.test(value)) return 'FIREBASE_API_KEY is invalid. Use the Web API Key from Firebase Project settings.';
  if (/PROJECT_NOT_FOUND/i.test(value)) return 'The Firebase API key does not belong to an active Firebase project.';
  if (/TOO_MANY_ATTEMPTS|TOO_MANY_REQUESTS/i.test(value)) return 'Firebase temporarily rate-limited password reset requests. Wait a few minutes and try again.';
  if (/EMAIL_NOT_FOUND/i.test(value)) return 'Firebase could not find the recovery identity for this email.';
  return 'Check Firebase Authentication, the Web API key, and the Email/Password provider settings.';
}

async function firebaseRequest(endpoint, body) {
  if (!config.firebaseApiKey) {
    const error = new Error('Firebase Forgot Password is not configured. Add FIREBASE_API_KEY in Render Environment.');
    error.code = 'FIREBASE_NOT_CONFIGURED';
    throw error;
  }

  let response;
  try {
    response = await fetch(`${FIREBASE_BASE}/${endpoint}?key=${encodeURIComponent(config.firebaseApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (cause) {
    const error = new Error('Firebase could not be reached from the server.');
    error.code = 'FIREBASE_NETWORK_ERROR';
    error.cause = cause;
    error.help = 'Check Render networking and Firebase API-key restrictions.';
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.error?.message || `FIREBASE_${response.status}`;
    const error = new Error(`Firebase password reset failed: ${code}`);
    error.code = code;
    error.status = response.status;
    error.help = firebaseHelp(code);
    throw error;
  }
  return payload;
}

export function firebaseErrorMessage(error) {
  const code = String(error?.code || error?.message || 'FIREBASE_ERROR');
  return `${error?.message || 'Firebase password reset failed.'} ${error?.help || firebaseHelp(code)}`.trim();
}

export async function createFirebasePasswordIdentity(email, password) {
  if (!config.firebaseApiKey) return { configured: false, created: false };
  try {
    await firebaseRequest('accounts:signUp', { email, password, returnSecureToken: false });
    return { configured: true, created: true };
  } catch (error) {
    if (String(error?.code || '').includes('EMAIL_EXISTS')) return { configured: true, created: false };
    throw error;
  }
}

export async function ensureFirebaseResetIdentity(email) {
  const temporary = `Tmp!${randomBytes(24).toString('base64url')}aA1`;
  return createFirebasePasswordIdentity(email, temporary);
}

export async function sendFirebasePasswordReset(email) {
  await ensureFirebaseResetIdentity(email);
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
