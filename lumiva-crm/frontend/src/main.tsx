import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.js';
import './index.css';
import { ErrorBoundary } from './ErrorBoundary';
import './i18n';

// A live deploy replaces every hashed chunk filename — a tab that's been open across a deploy
// still references the OLD names and 404s the moment it tries to fetch one. Vite's documented
// fix: reload once instead of leaving the user on a dead "Failed to fetch dynamically imported
// module" screen. Guarded by sessionStorage so a genuinely broken chunk (not just staleness)
// doesn't reload-loop forever.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const key = 'lumiva_chunk_reload_once_v1';
  const last = Number(sessionStorage.getItem(key) || '0');
  if (!last || Date.now() - last > 60_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
  // Expose for ErrorBoundary fallback (class component can't use hooks)
  (window as any).__sentry__ = Sentry;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>,
);
