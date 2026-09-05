const TOKEN_KEY = 'campusfix_student_session_token';
export const AUTH_CACHE_KEY = 'campusfix_student_auth_cache';
const PORTAL_ROLE = 'student';
export const LOCAL_MODE = false;
function apiRoot() {
  const configured = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured.endsWith('/api') ? configured : configured + '/api';
  return '/api';
}
export const getToken = () => {
  let token = localStorage.getItem(TOKEN_KEY);
  if (token) return token;
  try {
    const raw = sessionStorage.getItem('ccmms_login_handoff');
    const handoff = raw ? JSON.parse(raw) : null;
    if (handoff?.role === PORTAL_ROLE && handoff?.token) {
      token = String(handoff.token); localStorage.setItem(TOKEN_KEY, token); sessionStorage.removeItem('ccmms_login_handoff'); return token;
    }
  } catch {}
  return null;
};
export const setToken = (token) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
async function request(url, init = {}) {
  const headers = new Headers(init.headers || {}); headers.set('X-Portal-Role', PORTAL_ROLE);
  const token = getToken(); if (token) headers.set('Authorization', 'Bearer ' + token);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers, credentials: 'include', cache: 'no-store' });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) { const error = new Error(typeof payload === 'object' && payload?.error ? payload.error : (String(payload || '') || 'Request failed.')); error.status = response.status; throw error; }
  return payload;
}
export async function api(path, init = {}) { return request(apiRoot() + path, init); }
export async function uploadImage(file) {
  if (!file) throw new Error('Image is required.'); if (file.type && !file.type.startsWith('image/')) throw new Error('Only image files are allowed here.');
  const form = new FormData(); form.append('file', file, file.name || 'photo.jpg'); return (await request(apiRoot() + '/media', { method: 'POST', body: form })).url;
}
export async function uploadDataUrl(dataUrl, filename = '') {
  const value = String(dataUrl || ''); if (!value.startsWith('data:image/') && !value.startsWith('data:video/')) throw new Error('The selected photo or video is invalid.');
  return (await request(apiRoot() + '/media/data-url', { method: 'POST', body: JSON.stringify({ dataUrl: value, filename }) })).url;
}
export function getApiBaseUrl() { return apiRoot(); }
