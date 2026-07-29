import { useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import type { UserRole } from '@/lib/supabase';
import { GraduationCap, BadgeCheck, Wrench, Mail, Lock, User, Phone, Building2, Home, DoorOpen } from 'lucide-react';

type SignUpRole = Extract<UserRole, 'student' | 'faculty' | 'technician'>;

const ROLES: { value: SignUpRole; label: string; icon: typeof GraduationCap }[] = [
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'faculty', label: 'Staff', icon: BadgeCheck },
  { value: 'technician', label: 'Cleaner / Technician', icon: Wrench },
];

export function AuthScreen() {
  const { signIn, signUp, forgotPassword, resendVerification, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignUpRole>('student');
  const [collegeId, setCollegeId] = useState('');
  const [department, setDepartment] = useState('');
  const [hostel, setHostel] = useState('');
  const [block, setBlock] = useState('');
  const [room, setRoom] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setNotice('');

    if (mode === 'register' && password !== confirmPassword) {
      setNotice('Password and confirm password do not match.');
      return;
    }

    setSubmitting(true);
    if (mode === 'login') {
      await signIn(email, password);
    } else if (mode === 'forgot') {
      const result = await forgotPassword(email);
      setNotice(result.error || 'Password reset link has been sent. Please check your email and spam folder.');
    } else {
      const result = await signUp({ email, password, fullName, role, collegeId, department, hostel, block, room, phone });
      if (result.verificationSent) {
        setNotice('Account created. Verification link has been sent to your email. Verify it, then sign in.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    }
    setSubmitting(false);
  };

  const switchMode = (next: 'login' | 'register' | 'forgot') => {
    clearError();
    setNotice('');
    setMode(next);
  };

  const resend = async () => {
    clearError();
    setNotice('');
    if (!email || !password) {
      setNotice('Enter your email and password first.');
      return;
    }
    setSubmitting(true);
    const result = await resendVerification(email, password);
    setNotice(result.error || 'A new verification link has been sent to your email.');
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(59,130,246,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(14,165,233,0.3) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center"><Wrench className="w-6 h-6" /></div>
            <div><h1 className="text-xl font-bold">CampusFix</h1><p className="text-xs text-slate-400">Maintenance Management</p></div>
          </div>
          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight">Report. Track.<br /><span className="text-blue-400">Resolve.</span></h2>
            <p className="text-slate-300 text-lg max-w-md">One portal for students, staff, cleaners, technicians and campus administrators.</p>
          </div>
          <p className="text-xs text-slate-500">Secure email-verified accounts</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center"><Wrench className="w-5 h-5 text-white" /></div>
            <h1 className="text-lg font-bold text-slate-900">CampusFix</h1>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset password'}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {mode === 'login' ? 'Sign in after verifying your email' : mode === 'register' ? 'A verification link will be sent to your email' : 'We will email you a secure password reset link'}
          </p>

          {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {notice && <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${notice.includes('do not match') || notice.includes('Enter your') ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{notice}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">I am a</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map((r) => {
                      const Icon = r.icon;
                      const active = role === r.value;
                      return <button key={r.value} type="button" onClick={() => setRole(r.value)} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                        <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className={`text-[10px] font-semibold text-center ${active ? 'text-blue-700' : 'text-slate-500'}`}>{r.label}</span>
                      </button>;
                    })}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">Admin and supervisor roles can only be assigned by an existing admin.</p>
                </div>

                <Field icon={User} label="Full Name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Full name" className="field-input" /></Field>
                <Field icon={BadgeCheck} label="College / Employee ID"><input value={collegeId} onChange={(e) => setCollegeId(e.target.value)} placeholder="ID number" className="field-input" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field icon={Building2} label="Department"><input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" className="field-input" /></Field>
                  <Field icon={Phone} label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="field-input" /></Field>
                </div>
                {role === 'student' && <div className="grid grid-cols-3 gap-3">
                  <Field icon={Home} label="Hostel"><input value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="Hostel" className="field-input" /></Field>
                  <Field icon={Building2} label="Block"><input value={block} onChange={(e) => setBlock(e.target.value)} placeholder="Block" className="field-input" /></Field>
                  <Field icon={DoorOpen} label="Room"><input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room" className="field-input" /></Field>
                </div>}
              </>
            )}

            <Field icon={Mail} label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@campus.edu" className="field-input" /></Field>

            {mode !== 'forgot' && <Field icon={Lock} label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="field-input" /></Field>}
            {mode === 'register' && <Field icon={Lock} label="Confirm Password"><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="field-input" /></Field>}

            {mode === 'login' && <div className="flex justify-between text-xs">
              <button type="button" onClick={() => switchMode('forgot')} className="text-blue-600 font-semibold">Forgot password?</button>
              <button type="button" onClick={resend} disabled={submitting} className="text-blue-600 font-semibold disabled:opacity-50">Resend verification link</button>
            </div>}

            <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm disabled:opacity-60">
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            {mode === 'login' ? "Don't have an account? " : mode === 'register' ? 'Already have an account? ' : 'Remembered your password? '}
            <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} className="text-blue-600 font-semibold">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return <div>
    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">{label}</label>
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />{children}
    </div>
  </div>;
}
