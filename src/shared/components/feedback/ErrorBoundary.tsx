'use client';

/**
 * ErrorBoundary Component
 *
 * React error boundary for catching and displaying errors gracefully.
 * Provides fallback UI and error reporting capabilities.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';

// ============================================
// TYPES
// ============================================

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Reset key to force re-render children */
  resetKey?: string | number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================
// COMPONENT
// ============================================

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state when resetKey changes
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================
// DEFAULT FALLBACK
// ============================================

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        {/* Error Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-foreground">
          Something went wrong
        </h2>

        {/* Description */}
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again or contact support if
          the problem persists.
        </p>

        {/* Error Details (Development Only) */}
        {isDevelopment && error && (
          <div className="mt-4 rounded-lg border bg-muted/50 p-4 text-left">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Error Details:
            </p>
            <pre className="overflow-auto text-xs text-destructive">
              {error.message}
            </pre>
            {error.stack && (
              <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                {error.stack.split('\n').slice(1, 4).join('\n')}
              </pre>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {onReset && (
            <Button onClick={onReset} variant="default">
              Try Again
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPACT ERROR FALLBACK
// ============================================

interface CompactErrorFallbackProps {
  message?: string;
  onRetry?: () => void;
}

export function CompactErrorFallback({
  message = 'Failed to load',
  onRetry,
}: CompactErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
      <svg
        className="h-4 w-4 text-destructive"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <span className="text-sm text-destructive">{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="ml-2 h-7 text-xs"
        >
          Retry
        </Button>
      )}
    </div>
  );
}
