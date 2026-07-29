import { create } from 'zustand';
import {
  decodeDoc,
  encodeFields,
  firestoreFetch,
  getStoredUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInEmail,
  signUpEmail,
  storeUser,
  type FirebaseUser,
} from '@/lib/firebase';
import type { Profile, UserRole } from '@/lib/supabase';

type Session = { user: FirebaseUser };
type SignUpRole = Extract<UserRole, 'student' | 'faculty' | 'technician'>;

interface AuthState {
  session: Session | null;
  user: FirebaseUser | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    role: SignUpRole;
    collegeId?: string;
    department?: string;
    hostel?: string;
    block?: string;
    room?: string;
    phone?: string;
  }) => Promise<{ error: string | null; verificationSent?: boolean }>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const friendlyError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes('EMAIL_NOT_VERIFIED')) return 'Please verify your email first. We have sent a verification link to your email.';
  if (m.includes('INVALID_LOGIN_CREDENTIALS') || m.includes('INVALID_PASSWORD') || m.includes('EMAIL_NOT_FOUND')) return 'Invalid email or password.';
  if (m.includes('EMAIL_EXISTS')) return 'This email is already registered.';
  if (m.includes('WEAK_PASSWORD')) return 'Password must be at least 6 characters.';
  if (m.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) return 'Too many attempts. Please try again later.';
  return m.split('_').join(' ').toLowerCase().replace(/^./, (c: string) => c.toUpperCase());
};

async function loadProfile(uid: string): Promise<Profile | null> {
  try {
    return decodeDoc(await firestoreFetch(`/profiles/${uid}`)) as Profile;
  } catch (e) {
    if (String(e).includes('NOT_FOUND')) return null;
    throw e;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  error: null,

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const user = await signInEmail(email, password);
      if (!user.emailVerified) {
        await sendEmailVerification(user.idToken).catch(() => undefined);
        storeUser(null);
        throw new Error('EMAIL_NOT_VERIFIED');
      }
      const profile = await loadProfile(user.uid);
      if (!profile) throw new Error('User profile is missing. Please create a new account.');
      if (profile.is_active === false) throw new Error('Your account is inactive. Please contact the administrator.');
      storeUser(user);
      set({ session: { user }, user, profile, loading: false });
      return { error: null };
    } catch (e) {
      const error = friendlyError(e);
      set({ loading: false, error });
      return { error };
    }
  },

  signUp: async ({ email, password, fullName, role, collegeId, department, hostel, block, room, phone }) => {
    set({ loading: true, error: null });
    try {
      const safeRole: SignUpRole = ['student', 'faculty', 'technician'].includes(role) ? role : 'student';
      const user = await signUpEmail(email, password, fullName);
      const timestamp = new Date().toISOString();
      const profile: Profile = {
        id: user.uid,
        email: user.email,
        full_name: fullName,
        role: safeRole,
        college_id: collegeId,
        department,
        hostel,
        block,
        room,
        phone,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
      };
      const { id, ...data } = profile;
      await firestoreFetch(`/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(encodeFields(data)) });
      if (safeRole === 'technician') {
        await firestoreFetch(`/technicians/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(encodeFields({
            employee_code: collegeId || `TECH-${Date.now().toString().slice(-6)}`,
            skills: [],
            current_workload: 0,
            availability_status: 'available',
            area_coverage: [],
            created_at: timestamp,
            updated_at: timestamp,
          })),
        });
      }
      storeUser(null);
      set({ session: null, user: null, profile: null, loading: false });
      return { error: null, verificationSent: true };
    } catch (e) {
      storeUser(null);
      const error = friendlyError(e);
      set({ loading: false, error });
      return { error };
    }
  },

  forgotPassword: async (email) => {
    try {
      await sendPasswordResetEmail(email);
      return { error: null };
    } catch (e) {
      return { error: friendlyError(e) };
    }
  },

  resendVerification: async (email, password) => {
    try {
      const user = await signInEmail(email, password);
      await sendEmailVerification(user.idToken);
      storeUser(null);
      return { error: null };
    } catch (e) {
      storeUser(null);
      return { error: friendlyError(e) };
    }
  },

  signOut: async () => {
    storeUser(null);
    set({ session: null, user: null, profile: null });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (user) set({ profile: await loadProfile(user.uid) });
  },

  clearError: () => set({ error: null }),
}));

(async () => {
  const user = getStoredUser();
  if (!user || !user.emailVerified) {
    if (user && !user.emailVerified) storeUser(null);
    return useAuthStore.setState({ loading: false });
  }
  try {
    const profile = await loadProfile(user.uid);
    useAuthStore.setState({ session: { user }, user, profile, loading: false });
  } catch {
    storeUser(null);
    useAuthStore.setState({ session: null, user: null, profile: null, loading: false });
  }
})();
