import { create } from 'zustand';
import { api, getToken, setToken } from '@/lib/api';
import type { Profile, UserRole } from '@/lib/mongodb';

export interface AppUser { uid: string; email: string; displayName?: string; }
type Session = { user: AppUser };
interface AuthState {
  session: Session | null; user: AppUser | null; profile: Profile | null; loading: boolean; error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: { email: string; password: string; fullName: string; role: UserRole; collegeId?: string; department?: string; hostel?: string; block?: string; room?: string; phone?: string; }) => Promise<{ error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  changeEmail: (currentPassword: string, newEmail: string) => Promise<{ error: string | null }>;
  sendPasswordResetLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>; refreshProfile: () => Promise<void>; clearError: () => void;
}
type AuthResponse = { token: string; user: AppUser; profile: Profile };
const message = (e: unknown) => e instanceof Error ? e.message : String(e);

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null, user: null, profile: null, loading: true, error: null,
  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try { const r = await api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setToken(r.token); set({ session: { user: r.user }, user: r.user, profile: r.profile, loading: false }); return { error: null }; }
    catch (e) { const error = message(e); set({ loading: false, error }); return { error }; }
  },
  signUp: async ({ fullName, collegeId, ...rest }) => {
    set({ loading: true, error: null });
    try { const r = await api<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify({ ...rest, fullName, college_id: collegeId }) }); setToken(r.token); set({ session: { user: r.user }, user: r.user, profile: r.profile, loading: false }); return { error: null }; }
    catch (e) { const error = message(e); set({ loading: false, error }); return { error }; }
  },
  changePassword: async (currentPassword, newPassword) => { try { await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); return { error: null }; } catch (e) { return { error: message(e) }; } },
  changeEmail: async (currentPassword, newEmail) => {
    try { const r = await api<{ email: string; token: string }>('/auth/change-email', { method: 'POST', body: JSON.stringify({ currentPassword, newEmail }) }); setToken(r.token); const user = get().user ? { ...get().user!, email: r.email } : null; const profile = get().profile ? { ...get().profile!, email: r.email } : null; set({ user, profile, session: user ? { user } : null }); return { error: null }; }
    catch (e) { return { error: message(e) }; }
  },
  sendPasswordResetLink: async (email) => { try { await api('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) }); return { error: null }; } catch (e) { return { error: message(e) }; } },
  signOut: async () => { setToken(null); set({ session: null, user: null, profile: null }); },
  refreshProfile: async () => { try { const r = await api<{ user: AppUser; profile: Profile }>('/auth/me'); set({ user: r.user, profile: r.profile, session: { user: r.user } }); } catch { setToken(null); set({ user: null, profile: null, session: null }); } },
  clearError: () => set({ error: null }),
}));

(async () => {
  if (!getToken()) return useAuthStore.setState({ loading: false });
  try { const r = await api<{ user: AppUser; profile: Profile }>('/auth/me'); useAuthStore.setState({ user: r.user, profile: r.profile, session: { user: r.user }, loading: false }); }
  catch { setToken(null); useAuthStore.setState({ user: null, profile: null, session: null, loading: false }); }
})();
