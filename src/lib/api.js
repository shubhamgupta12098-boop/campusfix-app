const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
// Accept either https://host or https://host/api in VITE_API_URL.
// All frontend calls use /api paths, so normalize to the /api base.
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
// Session token issued by our own MongoDB-backed /auth/login and /auth/signup
// endpoints. Firebase is no longer involved in the frontend at all — it's used
// server-side only, for the forgot-password email flow.
const TOKEN_KEY = 'campusfix_session_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => {
    if (token)
        localStorage.setItem(TOKEN_KEY, token);
    else
        localStorage.removeItem(TOKEN_KEY);
};
if (!import.meta.env.VITE_API_URL) {
    console.info('[CampusFix] VITE_API_URL is not set. Using the local API at', API_URL);
}
export async function api(path, init = {}) {
    const token = getToken();
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData))
        headers.set('Content-Type', 'application/json');
    if (token)
        headers.set('Authorization', `Bearer ${token}`);
    let response;
    try {
        response = await fetch(`${API_URL}${path}`, { ...init, headers });
    }
    catch {
        throw new Error(`Could not reach the server at ${API_URL}. Check that the API is deployed/running and VITE_API_URL is set correctly.`);
    }
    const text = await response.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        }
        catch {
            throw new Error(`Server returned an unexpected (non-JSON) response from ${API_URL}${path} (status ${response.status}). This usually means VITE_API_URL is pointing at the wrong place, or CORS/the backend rejected the request.`);
        }
    }
    if (!response.ok)
        throw new Error(body?.error || `Request failed (${response.status})`);
    if (body === null)
        throw new Error('Server returned an empty response. Check that the backend is deployed and reachable.');
    return body;
}
async function uploadFile(file) {
    const form = new FormData();
    form.append('file', file);
    const result = await api('/upload', { method: 'POST', body: form });
    return result.url;
}

export async function uploadImage(file) {
    if (!file?.type?.startsWith('image/'))
        throw new Error('Please choose a valid image file.');
    return uploadFile(file);
}

export async function uploadDataUrl(dataUrl, filename = 'image.jpg') {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') && !blob.type.startsWith('video/'))
        throw new Error('Please choose a supported photo or video file.');
    const extensionByType = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
        'video/3gpp': '3gp',
    };
    const extension = extensionByType[blob.type] || (blob.type.startsWith('video/') ? 'mp4' : 'jpg');
    const safeFilename = /\.[a-z0-9]{2,5}$/i.test(filename) ? filename : `${filename}.${extension}`;
    return uploadFile(new File([blob], safeFilename, { type: blob.type }));
}
