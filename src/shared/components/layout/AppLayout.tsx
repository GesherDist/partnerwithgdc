'use client';

/**
 * AppLayout Component
 *
 * Modern professional layout with dark header, dark sidebar, and light content.
 */

import { cn } from '@/shared/lib/utils';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function AppLayout({ children, className, fullWidth = false }: AppLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header - Full Width Dark Bar */}
      <Header />

      {/* Main Area - Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Dark Navy (Fixed, doesn't scroll with content) */}
        <Sidebar />

        {/* Content - Light Background (Scrollable) */}
        <main
          className={cn(
            'flex-1 overflow-auto bg-background min-h-0',
            className
          )}
        >
          <div className={cn(!fullWidth && 'p-6', 'h-fit')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Content container with max width
interface ContentContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

function ContentContainer({ children, className, maxWidth = '2xl' }: ContentContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  return (
    <div className={cn('mx-auto w-full', maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
}

AppLayout.Content = ContentContainer;

// Loading skeleton
function AppLayoutSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header Skeleton */}
      <div className="flex h-16 items-center bg-[hsl(228,35%,14%)] px-6">
        <div className="h-8 w-32 animate-pulse rounded bg-white/10" />
        <div className="ml-auto h-8 w-8 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="flex flex-1">
        {/* Sidebar Skeleton */}
        <div className="hidden w-64 bg-[hsl(228,35%,14%)] lg:block">
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded bg-white/10"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 bg-background p-6">
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

AppLayout.Skeleton = AppLayoutSkeleton;
