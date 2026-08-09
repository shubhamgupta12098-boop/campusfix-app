import { useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { KeyRound, Lock, CheckCircle2, XCircle } from 'lucide-react';

// Rendered when the URL has a `mode=resetPassword&oobCode=...` query string —
// i.e. the link the user clicked in the "forgot password" email. The oobCode
// comes from Firebase (that's the only thing Firebase is used for here); the
// new password itself is saved into MongoDB by the backend.
export function ResetPasswordScreen({ oobCode }: { oobCode: string }) {
  const { confirmPasswordReset } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setSubmitting(true);
    const result = await confirmPasswordReset(oobCode, password);
    setSubmitting(false);
    if (result.error) return setError(result.error);
    setDone(true);
  };

  const goToLogin = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-5">
          <KeyRound className="h-6 w-6" />
        </div>

        {done ? (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Password updated</h2>
            <p className="text-sm text-slate-500 mb-6">Your password has been reset. You can now sign in with your new password.</p>
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>All set — head back to the sign in page.</span>
            </div>
            <button onClick={goToLogin} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Set a new password</h2>
            <p className="text-sm text-slate-500 mb-6">Choose a new password for your CampusFix account.</p>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">New Password</label>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                    placeholder="••••••••" className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Confirm Password</label>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6}
                    placeholder="••••••••" className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all disabled:opacity-60">
                {submitting ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
