import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** When this value changes (e.g. the active screen name), the boundary
   *  resets itself so navigating away from the broken screen recovers
   *  automatically instead of staying stuck on the error card. */
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  message: string;
}

// Without this, an uncaught error anywhere in the tree below unmounts the
// whole app and the user is left staring at a blank white page with no
// indication anything went wrong and no way to recover except a hard
// refresh. This boundary catches that, shows a readable message, and lets
// the person retry without losing their session.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Something went wrong while loading this screen.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a console trace for debugging; still avoids a blank page for the user.
    console.error('CampusFix crashed while rendering:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-1 break-words">{this.state.message}</p>
            <p className="text-xs text-slate-400 mb-5">
              This is usually a network problem (couldn't reach the server) rather than lost data.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" /> Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
