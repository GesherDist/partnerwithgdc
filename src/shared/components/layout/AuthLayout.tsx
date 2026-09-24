/**
 * AuthLayout Component
 *
 * Layout for authentication pages (login, forgot password, etc.).
 * Centered card layout with logo.
 */

import { cn } from '@/shared/lib/utils';
import { Logo } from './Logo';

// ============================================
// TYPES
// ============================================

interface AuthLayoutProps {
  /** Page content */
  children: React.ReactNode;
  /** Page title */
  title: string;
  /** Page description */
  description?: string;
  /** Custom class name */
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function AuthLayout({
  children,
  title,
  description,
  className,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className={cn('w-full max-w-[440px] space-y-6', className)}>
          {/* Logo */}
          <div className="flex justify-center">
            <Logo asLink={false} variant="default" />
          </div>

          {/* Card */}
          <div className="rounded-xl border border-border bg-card px-8 py-10 shadow-soft">
            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>

            {/* Form Content */}
            {children}
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Gesher Distribution. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * AuthLayout.Skeleton
 * Loading state for auth layout
 */
function AuthLayoutSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-[440px] space-y-6">
          {/* Logo Skeleton */}
          <div className="flex justify-center">
            <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
          </div>

          {/* Card Skeleton */}
          <div className="rounded-xl border border-border bg-card px-8 py-10 shadow-soft">
            <div className="mb-6 space-y-3 text-center">
              <div className="mx-auto h-7 w-40 animate-pulse rounded-lg bg-muted" />
              <div className="mx-auto h-4 w-64 animate-pulse rounded-lg bg-muted/50" />
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-11 w-full animate-pulse rounded-lg bg-muted/50" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-11 w-full animate-pulse rounded-lg bg-muted/50" />
              </div>
              <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          </div>

          {/* Footer Skeleton */}
          <div className="flex justify-center">
            <div className="h-4 w-52 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </main>
    </div>
  );
}

AuthLayout.Skeleton = AuthLayoutSkeleton;
