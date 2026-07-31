const configuredApiUrl = String(import.meta.env.VITE_API_URL || 'http://localhost:5000').trim().replace(/\/$/, '');
// Render par VITE_API_URL me backend ka base URL diya jata hai, jaise
// https://campusfix-app-x04t.onrender.com. API routes server par /api se start
// hote hain, isliye /api missing ho to automatically add kar dete hain.
const API_URL = /\/api$/i.test(configuredApiUrl) ? configuredApiUrl : `${configuredApiUrl}/api`;
const TOKEN_KEY = 'campusfix_mongo_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
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
