import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { AuthScreen } from '@/screens/AuthScreen';
import { AppShell } from '@/components/AppShell';
import { isPasswordActionLink, ResetPasswordScreen } from '@/screens/ResetPasswordScreen';

function App() {
  const { session, profile, loading } = useAuthStore();
  const [showActionScreen, setShowActionScreen] = useState(isPasswordActionLink());

  useEffect(() => {
    // ensure dark scrollbars don't appear
    document.documentElement.classList.add('antialiased');
  }, []);

  // The moment the user opens the email link (?mode=resetPassword / verifyEmail&oobCode=...)
  // this takes over the whole screen so the reset form appears immediately.
  if (showActionScreen) {
    return <ResetPasswordScreen onDone={() => setShowActionScreen(false)} />;
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
    return <AuthScreen />;
  }

  return <AppShell />;
}

export default App;
