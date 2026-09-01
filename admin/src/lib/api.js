const TOKEN_KEY = 'campusfix_admin_session_token';
const PORTAL_ROLE = 'admin';
export const LOCAL_MODE = false;

function apiRoot() {
  const configured = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured.endsWith('/api') ? configured : configured + '/api';
  if (typeof window !== 'undefined' && ['5173', '5174', '5175', '4173', '4174', '4175'].includes(window.location.port)) {
    return 'http://localhost:3000/api';
  }
  return '/api';
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

async function request(url, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('X-Portal-Role', PORTAL_ROLE);
  const token = getToken();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.error ? payload.error : (String(payload || '') || 'Request failed.');
    throw new Error(message);
  }
  return payload;
}

export async function api(path, init = {}) {
  return request(apiRoot() + path, init);
}

export async function uploadImage(file) {
  if (!file) throw new Error('Image is required.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Only image files are allowed here.');
  const form = new FormData();
  form.append('file', file, file.name || 'photo.jpg');
  const result = await request(apiRoot() + '/media', { method: 'POST', body: form });
  return result.url;
}

export async function uploadDataUrl(dataUrl, filename = '') {
  const value = String(dataUrl || '');
  if (!value.startsWith('data:image/') && !value.startsWith('data:video/')) throw new Error('The selected photo or video is invalid.');
  const result = await request(apiRoot() + '/media/data-url', {
    method: 'POST',
    body: JSON.stringify({ dataUrl: value, filename }),
  });
  return result.url;
}

export function getApiBaseUrl() {
  return apiRoot();
}
