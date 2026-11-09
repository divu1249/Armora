import React, { Component, ErrorInfo, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '../ui/Button.tsx';

interface Props {
  children?: ReactNode;
  /** when this value changes (for example the route), the boundary resets itself */
  resetKey?: string;
  /** full-page layout for the top-level boundary */
  fullPage?: boolean;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught UI error:', error, info.componentStack);
  }

  public componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  public render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className={this.props.fullPage ? 'flex min-h-screen items-center justify-center bg-canvas p-6' : 'py-12'}>
        <div className="mx-auto max-w-md rounded-lg border border-danger/40 bg-surface p-6 text-center shadow-e1">
          <TriangleAlert className="mx-auto h-8 w-8 text-danger" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-fg">Something went wrong on this page</h1>
          <p className="mt-1 text-sm text-muted">The rest of the app is fine. You can retry, or go back to the overview.</p>
          <pre className="mt-3 max-h-24 overflow-auto rounded bg-code p-2 text-left font-mono text-2xs text-code-fg">{this.state.error.message}</pre>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => this.setState({ error: null })}>Retry</Button>
            <Button variant="primary" onClick={() => window.location.assign('/app/overview')}>
              Go to overview
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
