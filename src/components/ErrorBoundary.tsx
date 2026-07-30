import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StartupDebug } from '../StartupDebug';
import { logStartupError } from '../bootLogger';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logStartupError(error, 'ErrorBoundary');
    console.error('App error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <StartupDebug error={this.state.error} component="ErrorBoundary" />;
    }
    return this.props.children;
  }
}
