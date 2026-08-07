import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { KeyRound, Lock, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

export function ResetPasswordScreen({ oobCode, onDone }: { oobCode: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkValid, setLinkValid] = useState(false);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        await api('/auth/verify-password-reset', {
          method: 'POST',
          body: JSON.stringify({ oobCode }),
        });
        if (active) setLinkValid(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setChecking(false);
      }
    };
    void verify();
    return () => { active = false; };
  }, [oobCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters long.');
    if (password !== confirm) return setError('The passwords do not match.');
    setLoading(true);
    try {
      const result = await api<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ oobCode, password }),
      });
      setSuccess(result.message || 'Password successfully changed.');
      setLinkValid(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <BrandLogo className="w-12 h-12 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Set new password</h1>
            <p className="text-sm text-slate-500 mt-0.5">Verify the reset link and choose a new password.</p>
          </div>
        </div>

        {checking && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-blue-600" /> Checking your password reset link…
          </div>
        )}

        {!checking && error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        {success ? (
          <div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex gap-2"><CheckCircle2 className="w-5 h-5 shrink-0" />{success}</div>
            <button onClick={onDone} className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-white font-semibold">Go to Sign In</button>
          </div>
        ) : !checking && linkValid ? (
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="text-xs font-semibold text-slate-700">NEW PASSWORD</span><div className="mt-1.5 flex items-center gap-2 border border-slate-200 bg-white rounded-xl px-3 py-2.5"><Lock className="w-4 h-4 text-slate-400"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required className="w-full bg-transparent outline-none text-sm text-slate-900" /></div></label>
            <label className="block"><span className="text-xs font-semibold text-slate-700">CONFIRM PASSWORD</span><div className="mt-1.5 flex items-center gap-2 border border-slate-200 bg-white rounded-xl px-3 py-2.5"><Lock className="w-4 h-4 text-slate-400"/><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={6} required className="w-full bg-transparent outline-none text-sm text-slate-900" /></div></label>
            <button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold disabled:opacity-60">{loading ? 'Changing…' : 'Change Password'}</button>
          </form>
        ) : !checking ? (
          <button onClick={onDone} className="w-full rounded-xl bg-slate-900 py-3 text-white font-semibold">Back to Sign In</button>
        ) : null}
      </div>
    </div>
  );
}
