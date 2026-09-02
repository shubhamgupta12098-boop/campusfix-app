import { create } from 'zustand';
import { api, setToken, getToken } from '@/lib/api';
const message = (e) => e instanceof Error ? e.message : String(e);
export const useAuthStore = create((set, get) => ({
    session: null, user: null, profile: null, loading: true, error: null,
    signIn: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const r = await api('/auth/login', {
                method: 'POST', body: JSON.stringify({ email, password }),
            });
            setToken(r.token || null);
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
            ['student', 'admin', 'staff'].forEach((role) => localStorage.removeItem(`campusfix_${role}_session_token`));
            sessionStorage.removeItem('ccmms_login_handoff');
        } catch {}
        set({ session: null, user: null, profile: null });
    },
    refreshProfile: async () => {
        try {
            const r = await api('/auth/me');
            set({ user: r.user, profile: r.profile, session: { user: r.user } });
        }
        catch {
            setToken(null);
            set({ user: null, profile: null, session: null });
        }
    },
    clearError: () => set({ error: null }),
}));
(async () => {
    try {
        // getToken() also consumes the short-lived login handoff when present.
        getToken();
        // Always ask /me once. The localhost server also accepts its same-origin
        // HttpOnly session cookie, so a successful login cannot bounce back to /.
        const r = await api('/auth/me');
        useAuthStore.setState({ user: r.user, profile: r.profile, session: { user: r.user }, loading: false });
    }
    catch {
        setToken(null);
        useAuthStore.setState({ user: null, profile: null, session: null, loading: false });
    }
})();
