import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { AuthScreen } from '@/screens/AuthScreen';
import { ResetPasswordScreen } from '@/screens/ResetPasswordScreen';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  const { session, profile, loading } = useAuthStore();
  // The "forgot password" email link lands here with ?mode=resetPassword&oobCode=...
  // (Firebase's standard params). This is the only place Firebase touches the frontend.
  const [resetCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'resetPassword' ? params.get('oobCode') : null;
  });

  useEffect(() => {
    // ensure dark scrollbars don't appear
    document.documentElement.classList.add('antialiased');
    document.documentElement.classList.toggle('dark', localStorage.getItem('cmms_dark_mode') === 'true');
  }, []);

  if (resetCode) {
    return (
      <ErrorBoundary>
        <ResetPasswordScreen oobCode={resetCode} />
      </ErrorBoundary>
    );
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
