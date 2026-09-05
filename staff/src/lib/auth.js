import { create } from 'zustand';
import { api, setToken, getToken, AUTH_CACHE_KEY } from '@/lib/api';
const message = (e) => e instanceof Error ? e.message : String(e);

function readCachedAuth() {
    try {
        const raw = localStorage.getItem(AUTH_CACHE_KEY);
        const cached = raw ? JSON.parse(raw) : null;
        return cached?.user && cached?.profile ? cached : null;
    } catch { return null; }
}
function persistAuth(user, profile) {
    if (!user || !profile) return;
    try { localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user, profile, savedAt: Date.now() })); } catch {}
}
function fallbackAuthFromToken(token) {
    try {
        const middle = String(token || '').split('.')[1];
        if (!middle) return null;
        const normalized = middle.replace(/-/g, '+').replace(/_/g, '/');
        const claims = JSON.parse(decodeURIComponent(escape(atob(normalized))));
        if (!claims?.sub || !claims?.role) return null;
        const email = String(claims.email || '');
        const name = email ? email.split('@')[0] : 'CCMMS User';
        const user = { uid: String(claims.sub), email, displayName: name, role: String(claims.role) };
        const profile = { id: String(claims.sub), email, full_name: name, role: String(claims.role), is_active: true };
        return { user, profile, savedAt: Date.now() };
    } catch { return null; }
}
export const useAuthStore = create((set, get) => ({
    session: null, user: null, profile: null, loading: true, error: null,
    signIn: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const r = await api('/auth/login', {
                method: 'POST', body: JSON.stringify({ email, password }),
            });
            setToken(r.token || null);
            persistAuth(r.user, r.profile);
            set({ session: { user: r.user }, user: r.user, profile: r.profile, loading: false });
            return { error: null };
        }
        catch (e) {
            setToken(null);
            const error = message(e);
            set({ loading: false, error });
            return { error };
        }
    },
    signUp: async ({ fullName, collegeId, email, password, ...rest }) => {
        set({ loading: true, error: null });
        try {
            const r = await api('/auth/signup', {
                method: 'POST', body: JSON.stringify({ ...rest, email, password, fullName, college_id: collegeId }),
            });
            setToken(r.token || null);
            persistAuth(r.user, r.profile);
            set({ session: { user: r.user }, user: r.user, profile: r.profile, loading: false });
            return { error: null };
        }
        catch (e) {
            setToken(null);
            const error = message(e);
            set({ loading: false, error });
            return { error };
        }
    },
    changePassword: async (currentPassword, newPassword) => {
        try {
            await api('/auth/change-password', {
                method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
            });
            return { error: null };
        }
        catch (e) {
            return { error: message(e) };
        }
    },
    changeEmail: async (currentPassword, newEmail) => {
        try {
            const r = await api('/auth/change-email', {
                method: 'POST', body: JSON.stringify({ currentPassword, newEmail: newEmail.trim().toLowerCase() }),
            });
            const user = get().user ? { ...get().user, email: r.email } : null;
            const profile = get().profile ? { ...get().profile, email: r.email } : null;
            persistAuth(user, profile);
            set({ user, profile, session: user ? { user } : null });
            return { error: null };
        }
        catch (e) {
            return { error: message(e) };
        }
    },
    resetForgottenPassword: async (email, newPassword) => {
        try {
            const result = await api('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            return { error: null, message: result.message || 'Password reset email sent.' };
        }
        catch (e) {
            return { error: message(e) };
        }
    },
    signOut: async () => {
        try { await api('/auth/logout', { method: 'POST' }); } catch {}
        setToken(null);
        try {
            ['student', 'admin', 'staff'].forEach((role) => { localStorage.removeItem(`campusfix_${role}_session_token`); localStorage.removeItem(`campusfix_${role}_auth_cache`); });
            sessionStorage.removeItem('ccmms_login_handoff');
        } catch {}
        set({ session: null, user: null, profile: null });
    },
    refreshProfile: async () => {
        try {
            const r = await api('/auth/me');
            persistAuth(r.user, r.profile);
            set({ user: r.user, profile: r.profile, session: { user: r.user } });
            return { error: null };
        }
        catch (e) {
            // A network error, Render cold start or temporary API problem must
            // never sign the user out. Only signOut() clears the saved session.
            return { error: message(e) };
        }
    },
    clearError: () => set({ error: null }),
}));
(async () => {
    // Persistent-login rule: a saved token remains signed in until the user
    // explicitly chooses Logout/Sign out. Closing the app, pressing Back,
    // refreshing, losing internet, or a Render cold start must not clear it.
    const token = getToken();
    if (!token) {
        useAuthStore.setState({ user: null, profile: null, session: null, loading: false });
        return;
    }

    const cached = readCachedAuth() || fallbackAuthFromToken(token);
    if (cached?.user && cached?.profile) {
        persistAuth(cached.user, cached.profile);
        useAuthStore.setState({ user: cached.user, profile: cached.profile, session: { user: cached.user }, loading: false });
    }

    try {
        const r = await api('/auth/me');
        persistAuth(r.user, r.profile);
        useAuthStore.setState({ user: r.user, profile: r.profile, session: { user: r.user }, loading: false });
    }
    catch {
        // Deliberately keep the local token/cache. Explicit signOut() is the
        // only client action that removes them.
        if (!cached) useAuthStore.setState({ loading: false });
    }
})();
