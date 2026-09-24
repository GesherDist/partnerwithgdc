/**
 * LoadingState Component
 *
 * Various loading states and spinners for different contexts.
 * Includes full-page, inline, and skeleton variants.
 */

import { cn } from '@/shared/lib/utils';

// ============================================
// TYPES
// ============================================

interface LoadingStateProps {
  /** Loading message to display */
  message?: string;
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
}

// ============================================
// SPINNER COMPONENT
// ============================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <svg
      className={cn(
        'animate-spin text-primary',
        sizeClasses[size],
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================
// LOADING STATE COMPONENT
// ============================================

export function LoadingState({
  message,
  size = 'md',
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        className
      )}
    >
      <Spinner size={size} />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

// ============================================
// FULL PAGE LOADING
// ============================================

interface FullPageLoadingProps {
  message?: string;
}

function FullPageLoading({ message = 'Loading...' }: FullPageLoadingProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingState message={message} size="lg" />
    </div>
  );
}

LoadingState.FullPage = FullPageLoading;

// ============================================
// INLINE LOADING
// ============================================

interface InlineLoadingProps {
  message?: string;
  className?: string;
}

function InlineLoading({ message, className }: InlineLoadingProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Spinner size="sm" />
      {message && (
        <span className="text-sm text-muted-foreground">{message}</span>
      )}
    </div>
  );
}

LoadingState.Inline = InlineLoading;

// ============================================
// OVERLAY LOADING
// ============================================

interface OverlayLoadingProps {
  message?: string;
  visible?: boolean;
}

function OverlayLoading({ message, visible = true }: OverlayLoadingProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <LoadingState message={message} size="lg" />
    </div>
  );
}

LoadingState.Overlay = OverlayLoading;

// ============================================
// BUTTON LOADING
// ============================================

interface ButtonLoadingProps {
  className?: string;
}

function ButtonLoading({ className }: ButtonLoadingProps) {
  return <Spinner size="sm" className={cn('mr-2', className)} />;
}

LoadingState.Button = ButtonLoading;

// ============================================
// SKELETON VARIANTS
// ============================================

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-muted',
        className
      )}
      style={style}
    />
  );
}

LoadingState.Skeleton = Skeleton;

// ============================================
// CARD SKELETON
// ============================================

interface CardSkeletonProps {
  className?: string;
  lines?: number;
}

function CardSkeleton({ className, lines = 3 }: CardSkeletonProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="space-y-3">
        <Skeleton className="h-5 w-1/3" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')}
          />
        ))}
      </div>
    </div>
  );
}

LoadingState.Card = CardSkeleton;

// ============================================
// TABLE SKELETON
// ============================================

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('rounded-lg border', className)}>
      {/* Header */}
      <div className="flex gap-4 border-b bg-muted/50 p-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'flex gap-4 p-4',
            rowIndex < rows - 1 && 'border-b'
          )}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 flex-1"
              style={{ animationDelay: `${(rowIndex + colIndex) * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

LoadingState.Table = TableSkeleton;

// ============================================
// LIST SKELETON
// ============================================

interface ListSkeletonProps {
  items?: number;
  className?: string;
}

function ListSkeleton({ items = 5, className }: ListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

LoadingState.List = ListSkeleton;
