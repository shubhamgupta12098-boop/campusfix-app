import { randomBytes } from 'node:crypto';
import { config } from './config.mjs';

const FIREBASE_BASE = 'https://identitytoolkit.googleapis.com/v1';

function firebaseHelp(code) {
  const value = String(code || '');
  if (/OPERATION_NOT_ALLOWED/i.test(value)) return 'Enable Email/Password in Firebase Console > Authentication > Sign-in method.';
  if (/API_KEY_HTTP_REFERRER_BLOCKED/i.test(value)) return 'This Firebase Web API key is restricted to browser referrers. CCMMS will retry from the browser.';
  if (/API_KEY_SERVICE_BLOCKED|SERVICE_DISABLED/i.test(value)) return 'Enable Identity Toolkit / Firebase Authentication for this Firebase project.';
  if (/API_KEY_INVALID|INVALID_API_KEY/i.test(value)) return 'The Firebase Web API key is invalid. Check Firebase Project settings > General > Web API Key.';
  if (/PROJECT_NOT_FOUND/i.test(value)) return 'The Firebase API key does not belong to an active Firebase project.';
  if (/TOO_MANY_ATTEMPTS|TOO_MANY_REQUESTS/i.test(value)) return 'Firebase temporarily rate-limited password reset requests. Wait a few minutes and try again.';
  if (/EMAIL_NOT_FOUND/i.test(value)) return 'Firebase could not find the recovery identity for this email.';
  if (/INVALID_EMAIL/i.test(value)) return 'Enter a valid registered email address.';
  return 'Check Firebase Authentication, the Web API key, and the Email/Password provider settings.';
}

async function firebaseRequest(endpoint, body) {
  if (!config.firebaseApiKey) {
    const error = new Error('Firebase Forgot Password is not configured.');
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
    error.help = 'CCMMS can retry the Firebase request from the browser.';
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

export function canUseBrowserFirebaseFallback(error) {
  const code = String(error?.code || error?.message || '');
  return /API_KEY_HTTP_REFERRER_BLOCKED|FIREBASE_NETWORK_ERROR|NETWORK|FETCH/i.test(code);
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
  if (!config.firebaseApiKey) return { ok: false, idToken: '' };
  try {
    const result = await firebaseRequest('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });
    return { ok: Boolean(result?.idToken), idToken: String(result?.idToken || '') };
  } catch {
    return { ok: false, idToken: '' };
  }
}

export async function deleteFirebaseRecoveryIdentity(idToken) {
  if (!idToken) return false;
  try {
    await firebaseRequest('accounts:delete', { idToken });
    return true;
  } catch (error) {
    console.warn('[Firebase recovery cleanup]', error?.code || error?.message || error);
    return false;
  }
}
