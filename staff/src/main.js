import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('CampusFix could not start: #root element is missing.');
}

const root = createRoot(rootElement);

// Render something immediately so a module/runtime failure can never leave a
// completely white browser page.
root.render(
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#031322', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 36, height: 36, margin: '0 auto 12px', border: '3px solid #27445f', borderTopColor: '#2f8cff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontWeight: 700 }}>Loading CampusFix…</div>
    </div>
  </div>
);

import('./App.js')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    console.error('CampusFix startup error:', error);
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#031322', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 'min(100%, 520px)', padding: 24, border: '1px solid #25415b', borderRadius: 18, background: '#071b2d' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 22 }}>CampusFix failed to start</h1>
          <p style={{ margin: '0 0 14px', color: '#aebfd0', lineHeight: 1.5 }}>The app hit a JavaScript/module error before React could open.</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 12, borderRadius: 10, background: '#020d17', color: '#ffb4b4', fontSize: 12 }}>{message}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 14, width: '100%', border: 0, borderRadius: 10, padding: '11px 14px', background: '#1677ff', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Reload App</button>
        </div>
      </div>
    );
  });
