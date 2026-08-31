import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const EXPECTED_ROLE = 'staff';

function Redirecting() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Opening secure login…</p>
      </div>
    </div>
  );
}

function App() {
  const { session, profile, loading } = useAuthStore();

  useEffect(() => {
    document.documentElement.classList.add('antialiased');
    document.documentElement.classList.toggle('dark', localStorage.getItem('cmms_dark_mode') === 'true');
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session || !profile) {
      window.location.replace('/');
      return;
    }
    if (profile.role !== EXPECTED_ROLE) {
      window.location.replace('/');
    }
  }, [loading, session, profile]);

  if (loading || !session || !profile || profile.role !== EXPECTED_ROLE) {
    return <Redirecting />;
  }

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

export default App;
