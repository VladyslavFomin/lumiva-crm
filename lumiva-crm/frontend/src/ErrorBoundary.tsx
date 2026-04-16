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
