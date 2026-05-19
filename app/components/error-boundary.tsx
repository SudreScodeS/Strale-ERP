'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

// ==========================================
// ERROR BOUNDARY — Isolates crashes per section
// ==========================================

interface ErrorBoundaryProps {
  /** Unique name for logging context */
  name: string;
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary that catches render errors in its subtree
 * and shows an elegant fallback UI instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary name="Dashboard Metrics">
 *     <MetricsSection />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-2xl p-8 text-center"
          style={{
            background: 'var(--card-bg, #fff)',
            border: '1px solid var(--card-border, #e2e8f0)',
            minHeight: '180px',
          }}
        >
          {/* Warning icon */}
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger, #dc2626)' }}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary, #0f172a)' }}>
              Algo deu errado
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #64748b)' }}>
              {this.props.name} não pôde ser carregado.
            </p>
          </div>

          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-80"
            style={{ background: 'var(--brand, #8b5cf6)' }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
