import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';
import { AuthScreen } from '@/screens/AuthScreen';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ResetPasswordScreen } from '@/screens/ResetPasswordScreen';

function App() {
  const { session, profile, loading } = useAuthStore();
  const resetToken = new URLSearchParams(window.location.search).get('resetToken');

  useEffect(() => {
    // ensure dark scrollbars don't appear
    document.documentElement.classList.add('antialiased');
    document.documentElement.classList.toggle('dark', localStorage.getItem('cmms_dark_mode') === 'true');
  }, []);


  if (resetToken) {
    return <ResetPasswordScreen token={resetToken} onDone={() => { window.history.replaceState({}, '', window.location.pathname); window.location.reload(); }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" style={{ borderTopWidth: '3px' }} />
          <p className="text-sm text-slate-500 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <ErrorBoundary>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

export default App;
