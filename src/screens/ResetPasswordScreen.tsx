import { useState } from 'react';
import { api } from '@/lib/api';
import { KeyRound, Lock, CheckCircle2 } from 'lucide-react';

export function ResetPasswordScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters long.');
    if (password !== confirm) return setError('The passwords do not match.');
    setLoading(true);
    try {
      const result = await api<{ message: string }>('/auth/reset-password', {
        method: 'POST', body: JSON.stringify({ token, password }),
      });
      setSuccess(result.message || 'Password successfully changed.');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4"><KeyRound className="w-6 h-6" /></div>
        <h1 className="text-2xl font-bold text-slate-900">Set new password</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">Enter and confirm your new CampusFix password.</p>
        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        {success ? (
          <div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex gap-2"><CheckCircle2 className="w-5 h-5 shrink-0" />{success}</div>
            <button onClick={onDone} className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-white font-semibold">Go to Sign In</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="text-xs font-semibold text-slate-700">NEW PASSWORD</span><div className="mt-1.5 flex items-center gap-2 border rounded-xl px-3 py-2.5"><Lock className="w-4 h-4 text-slate-400"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full outline-none text-sm" /></div></label>
            <label className="block"><span className="text-xs font-semibold text-slate-700">CONFIRM PASSWORD</span><div className="mt-1.5 flex items-center gap-2 border rounded-xl px-3 py-2.5"><Lock className="w-4 h-4 text-slate-400"/><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full outline-none text-sm" /></div></label>
            <button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold disabled:opacity-60">{loading ? 'Changing…' : 'Change Password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
