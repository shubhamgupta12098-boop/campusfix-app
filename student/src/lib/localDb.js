const DATA_CHANNEL = 'ccmms_remote_change';
const DATA_SIGNAL_KEY = 'ccmms_remote_change_signal';

function tokenKey() {
  if (typeof window === 'undefined') return 'campusfix_student_session_token';
  const path = window.location.pathname;
  if (path.startsWith('/admin')) return 'campusfix_admin_session_token';
  if (path.startsWith('/staff')) return 'campusfix_staff_session_token';
  return 'campusfix_student_session_token';
}

function apiRoot() {
  const configured = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured.endsWith('/api') ? configured : configured + '/api';
  return '/api';
}

function authHeaders(json = true) {
  const headers = new Headers();
  const token = localStorage.getItem(tokenKey());
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (json) headers.set('Content-Type', 'application/json');
  return headers;
}

async function remote(path, init = {}) {
  const response = await fetch(apiRoot() + path, {
    ...init,
    headers: init.headers || authHeaders(!(init.body instanceof FormData)),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'CCMMS API request failed.');
  return payload;
}

function announceLocalChange(storeName) {
  const payload = { storeName, at: Date.now(), id: Math.random().toString(36).slice(2) };
  try { localStorage.setItem(DATA_SIGNAL_KEY, JSON.stringify(payload)); } catch {}
  try { const channel = new BroadcastChannel(DATA_CHANNEL); channel.postMessage(payload); channel.close(); } catch {}
}

export const LOCAL_DEMO_USERS = [
  { email: 'student@campusfix.local', password: 'Student@123', profile: { id: 'local-student', role: 'student', full_name: 'Alex Student' } },
  { email: 'staff@campusfix.local', password: 'Staff@123', profile: { id: 'local-staff', role: 'staff', full_name: 'Sam Technician' } },
  { email: 'admin@campusfix.local', password: 'Admin@123', profile: { id: 'local-admin', role: 'admin', full_name: 'CCMMS Admin' } },
];

export function createLocalId(prefix = 'record') {
  const cryptoApi = typeof window !== 'undefined' ? window.crypto : null;
  const random = typeof cryptoApi?.randomUUID === 'function' ? cryptoApi.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + '-' + random;
}

export async function hashLocalPassword(password) {
  return String(password || '');
}

export async function ensureLocalSeeded() {
  return true;
}

export async function localGetAll(storeName) {
  return remote('/data/' + encodeURIComponent(storeName));
}

export async function localGet(storeName, id) {
  if (!id) return null;
  try {
    return await remote('/data/' + encodeURIComponent(storeName) + '/' + encodeURIComponent(String(id)));
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('not found')) return null;
    throw error;
  }
}

export async function localPut(storeName, value) {
  const row = { ...(value || {}), id: value?.id || createLocalId(storeName.replace(/s$/, '') || 'record') };
  const result = await remote('/data/' + encodeURIComponent(storeName) + '/' + encodeURIComponent(row.id), {
    method: 'PUT',
    body: JSON.stringify(row),
  });
  announceLocalChange(storeName);
  return result;
}

export async function localPutMany(storeName, values) {
  const rows = (values || []).map((value) => ({ ...(value || {}), id: value?.id || createLocalId(storeName.replace(/s$/, '') || 'record') }));
  const result = await remote('/data/' + encodeURIComponent(storeName) + '/bulk', {
    method: 'POST',
    body: JSON.stringify({ values: rows }),
  });
  announceLocalChange(storeName);
  return result;
}

export async function localDeleteMany(storeName, ids) {
  const result = await remote('/data/' + encodeURIComponent(storeName) + '/delete-many', {
    method: 'POST',
    body: JSON.stringify({ ids: (ids || []).map(String) }),
  });
  announceLocalChange(storeName);
  return result;
}
