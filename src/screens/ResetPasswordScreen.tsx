import { useEffect, useState } from 'react';
import { Lock, Wrench, CheckCircle2, XCircle } from 'lucide-react';
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from '@/lib/firebase';

type Status = 'checking' | 'ready' | 'invalid' | 'success' | 'verified';

// Reads mode/oobCode straight from the URL the email link points to,
// e.g. https://yourapp.com/?mode=resetPassword&oobCode=XXXX
function getActionParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get('mode'),
    oobCode: params.get('oobCode'),
  };
}

export function isPasswordActionLink(): boolean {
  const { mode, oobCode } = getActionParams();
  return Boolean(oobCode && (mode === 'resetPassword' || mode === 'verifyEmail'));
}

export function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const { mode, oobCode } = getActionParams();
  const [status, setStatus] = useState<Status>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!oobCode) {
        setStatus('invalid');
        return;
      }
      try {
        if (mode === 'verifyEmail') {
          await applyActionCode(oobCode);
          setStatus('verified');
        } else {
          const linkedEmail = await verifyPasswordResetCode(oobCode);
          setEmail(linkedEmail);
          setStatus('ready');
        }
      } catch {
        setStatus('invalid');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPwd) {
      setError('Password and confirm password do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(oobCode as string, password);
      setStatus('success');
    } catch (err) {
      setError(
        err instanceof Error
          ? 'This reset link has expired or was already used. Please request a new one.'
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const clearUrlAndFinish = () => {
    window.history.replaceState({}, '', window.location.pathname);
    onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">CampusFix</h1>
        </div>

        {status === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div
              className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin"
              style={{ borderTopWidth: '3px' }}
            />
            <p className="text-sm text-slate-500">Checking your link…</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="text-center py-4">
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">Link expired or invalid</h2>
            <p className="text-sm text-slate-500 mb-6">
              This link has already been used or has expired. Go back and request a new password reset link.
            </p>
            <button
              onClick={clearUrlAndFinish}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm"
            >
              Back to sign in
            </button>
          </div>
        )}

        {status === 'verified' && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">Email verified</h2>
            <p className="text-sm text-slate-500 mb-6">Your email address has been verified. You can now sign in.</p>
            <button
              onClick={clearUrlAndFinish}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm"
            >
              Back to sign in
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-1 text-center">Reset your password</h2>
            <p className="text-sm text-slate-500 mb-6 text-center">
              Setting a new password for <span className="font-semibold text-slate-700">{email}</span>
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  New Password
                </label>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="field-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Confirm New Password
                </label>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="field-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm disabled:opacity-60"
              >
                {submitting ? 'Please wait…' : 'Set new password'}
              </button>
            </form>
          </>
        )}

        {status === 'success' && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">Password updated</h2>
            <p className="text-sm text-slate-500 mb-6">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <button
              onClick={clearUrlAndFinish}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
