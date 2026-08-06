const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://campusfix-app-x04t.onrender.com').replace(/\/$/, '');
// Accept either https://host or https://host/api in VITE_API_URL.
// All frontend calls below use paths such as /auth/login, so normalize to the /api base.
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
const TOKEN_KEY = 'campusfix_mongo_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

if (!import.meta.env.VITE_API_URL) {
  console.warn('[CampusFix] VITE_API_URL is not set at build time. Falling back to', API_URL, '- set VITE_API_URL in your Render static site env vars and redeploy.');
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Could not reach the server at ${API_URL}. Check that the API is deployed/running and VITE_API_URL is set correctly.`);
  }

  const text = await response.text();
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { throw new Error(`Server returned an unexpected (non-JSON) response from ${API_URL}${path} (status ${response.status}). This usually means VITE_API_URL is pointing at the wrong place, or CORS/the backend rejected the request.`); }
  }
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  if (body === null) throw new Error('Server returned an empty response. Check that the backend is deployed and reachable.');
  return body as T;
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const result = await api<{ url: string }>('/upload', { method: 'POST', body: form });
  return result.url;
}

export async function uploadDataUrl(dataUrl: string, filename = 'image.jpg'): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return uploadImage(new File([blob], filename, { type: blob.type || 'image/jpeg' }));
}
