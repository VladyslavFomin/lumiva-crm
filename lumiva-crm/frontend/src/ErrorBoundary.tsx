import React from 'react';
import i18next from 'i18next';

type ErrorBoundaryState = {
  hasError: boolean;
  message?: string;
  stack?: string;
};

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: undefined, stack: undefined };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
      stack: error.stack,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('React error boundary caught:', error, info);
    const message = `${error.name || ''} ${error.message || ''}`;
    const isDomPlacementError =
      message.includes('insertBefore') ||
      message.includes('removeChild') ||
      message.includes('replaceChild');
    if (isDomPlacementError && typeof window !== 'undefined') {
      const key = 'lumiva_dom_recover_once_v1';
      const last = Number(sessionStorage.getItem(key) || '0');
      if (!last || Date.now() - last > 60_000) {
        sessionStorage.setItem(key, String(Date.now()));
        const url = new URL(window.location.href);
        url.searchParams.set('_recover', String(Date.now()));
        window.location.replace(url.toString());
        return;
      }
    }
    try {
      const Sentry = (window as any).__sentry__;
      if (Sentry) Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    } catch {
      // Sentry not available
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0f172a',
            color: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily:
              '-apple-system,BlinkMacSystemFont,system-ui,Segoe UI,Roboto,sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '640px',
              width: '100%',
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '14px',
              padding: '18px 16px',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#f87171' }}>
              {i18next.t('crm.errors.appFailedTitle')}
            </div>
            <div style={{ fontSize: 14, color: '#cbd5e1' }}>
              {this.state.message || 'Unknown error'}
            </div>
            {this.state.stack && (
              <pre
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  color: '#94a3b8',
                }}
              >
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
