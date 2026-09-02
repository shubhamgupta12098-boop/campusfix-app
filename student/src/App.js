import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
function App() {
    const { session, profile, loading } = useAuthStore();
    useEffect(() => {
        // ensure dark scrollbars don't appear
        document.documentElement.classList.add('antialiased');
        document.documentElement.classList.toggle('dark', localStorage.getItem('cmms_dark_mode') === 'true');
    }, []);
    useEffect(() => {
        if (!loading && (!session || !profile)) {
            window.location.replace('/');
        }
    }, [loading, session, profile]);
    if (loading) {
        return (<div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" style={{ borderTopWidth: '3px' }}/>
          <p className="text-sm text-slate-500 font-medium">Loading…</p>
        </div>
      </div>);
    }
    if (!session || !profile) {
        return (<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <p className="text-sm font-medium">Opening secure sign in…</p>
      </div>);
    }
    return (<ErrorBoundary>
      <AppShell />
    </ErrorBoundary>);
}
export default App;
