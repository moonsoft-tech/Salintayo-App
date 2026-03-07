import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 480,
            margin: '40px auto',
            fontFamily: 'system-ui, sans-serif',
            background: '#fff',
            color: '#1a1a1a',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <h1 style={{ marginTop: 0, fontSize: 20 }}>Something went wrong</h1>
          <p style={{ color: '#666' }}>{this.state.error.message}</p>
          <p style={{ fontSize: 14, color: '#888' }}>
            Check the browser console for details. Fix the issue and refresh the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
