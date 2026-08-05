import { useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import type { UserRole } from '@/lib/mongodb';
import { GraduationCap, BadgeCheck, Wrench, Mail, Lock, User, Phone, Building2, Home, DoorOpen, X, KeyRound, CheckCircle2 } from 'lucide-react';

// Admin accounts are never offered on public signup — an existing admin
// creates them from User Management instead.
const ROLES: { value: UserRole; label: string; icon: typeof GraduationCap; color: string }[] = [
  { value: 'student', label: 'Student', icon: GraduationCap, color: 'blue' },
  { value: 'staff', label: 'Staff', icon: BadgeCheck, color: 'cyan' },
];

export function AuthScreen() {
  const { signIn, signUp, sendPasswordResetLink, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [collegeId, setCollegeId] = useState('');
  const [department, setDepartment] = useState('');
  const [hostel, setHostel] = useState('');
  const [block, setBlock] = useState('');
  const [room, setRoom] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotNotice, setForgotNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setNotice('');
    setSubmitting(true);
    if (mode === 'login') {
      await signIn(email, password);
    } else {
      const result = await signUp({ email, password, fullName, role, collegeId, department, hostel, block, room, phone });
      if (!result.error) {
        setNotice('Account created successfully.');
      }
    }
    setSubmitting(false);
  };

  const openForgotPassword = () => {
    clearError();
    setForgotEmail(email.trim());
    setForgotError('');
    setForgotNotice('');
    setForgotOpen(true);
  };

  const sendResetLink = async () => {
    setForgotError('');
    setForgotNotice('');
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setSubmitting(true);
    const result = await sendPasswordResetLink(forgotEmail);
    setSubmitting(false);
    if (result.error) {
      setForgotError(result.error);
      return;
    }
    setForgotNotice('A password reset link has been sent. Please check your inbox and Spam or Junk folder.');
  };

  const switchMode = () => {
    clearError();
    setNotice('');
    setMode(mode === 'login' ? 'register' : 'login');
  };


  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(59,130,246,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(14,165,233,0.3) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <img src="/cmms-logo.jpeg" alt="CCMMS logo" className="w-14 h-14 rounded-xl object-cover bg-white shadow-lg" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">CCMMS</h1>
              <p className="text-xs text-slate-400">Campus Complaint Management</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Report. Track.<br />
              <span className="text-blue-400">Resolve.</span>
            </h2>
            <p className="text-slate-300 text-lg max-w-md">
              A unified complaint and maintenance system for your campus — from raising issues to tracking repairs in real time.
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-md pt-4">
              {[
                { icon: '⚡', label: 'Quick Reporting' },
                { icon: '📍', label: 'Live Tracking' },
                { icon: '🔧', label: 'Smart Assignment' },
                { icon: '📊', label: 'Analytics' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <span className="text-lg">{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">Trusted by campus maintenance teams</p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src="/cmms-logo.jpeg" alt="CCMMS logo" className="w-12 h-12 rounded-xl object-cover" />
            <h1 className="text-lg font-bold text-slate-900">CCMMS</h1>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {mode === 'login' ? 'Sign in to manage campus maintenance' : 'Join CCMMS to report and track issues'}
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">I am a</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => {
                      const Icon = r.icon;
                      const active = role === r.value;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRole(r.value)}
                          className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                            active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className={`text-[10px] font-semibold ${active ? 'text-blue-700' : 'text-slate-500'}`}>{r.label.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field icon={User} label="Full Name">
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Doe"
                    className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                </Field>

                <Field icon={BadgeCheck} label="College ID">
                  <input value={collegeId} onChange={(e) => setCollegeId(e.target.value)} placeholder="e.g. CS21B001"
                    className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field icon={Building2} label="Department">
                    <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="CSE"
                      className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                  </Field>
                  <Field icon={Phone} label="Phone">
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…"
                      className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                  </Field>
                </div>

                {role === 'student' && (
                  <div className="grid grid-cols-3 gap-3">
                    <Field icon={Home} label="Hostel">
                      <input value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="HBA"
                        className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                    </Field>
                    <Field icon={Building2} label="Block">
                      <input value={block} onChange={(e) => setBlock(e.target.value)} placeholder="B"
                        className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                    </Field>
                    <Field icon={DoorOpen} label="Room">
                      <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="203"
                        className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                    </Field>
                  </div>
                )}
              </>
            )}

            <Field icon={Mail} label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@campus.edu"
                className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
            </Field>

            <Field icon={Lock} label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••"
                className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
            </Field>

            {mode === 'login' && (
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={openForgotPassword} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all disabled:opacity-60"
            >
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={switchMode} className="text-blue-600 font-semibold hover:text-blue-700">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><KeyRound className="h-5 w-5" /></div>
                <div><h3 className="font-bold text-slate-900">Request password reset</h3><p className="mt-1 text-xs text-slate-500">We will email a secure password reset link that expires in 30 minutes.</p></div>
              </div>
              <button type="button" onClick={() => setForgotOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              {forgotError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{forgotError}</div>}
              {forgotNotice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /><span>{forgotNotice}</span></div></div>}
              <Field icon={Mail} label="Registered Email">
                <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@campus.edu" autoFocus className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
              </Field>
              <button type="button" onClick={sendResetLink} disabled={submitting} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{submitting ? 'Sending link…' : 'Send Password Reset Link'}</button>
              <p className="text-center text-xs text-slate-500">If you do not see the email, check your Spam or Junk folder.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
        {children}
      </div>
    </div>
  );
}
