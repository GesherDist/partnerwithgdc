/**
 * PageHeader Component
 *
 * Standard page header with title, description, breadcrumb, and actions.
 * Used at the top of every page for consistent layout.
 */

import { cn } from '@/shared/lib/utils';
import { AppBreadcrumb } from './AppBreadcrumb';

// ============================================
// TYPES
// ============================================

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Page description */
  description?: string;
  /** Custom breadcrumb items (auto-generated if not provided) */
  breadcrumbs?: BreadcrumbItem[];
  /** Action buttons (right side) */
  actions?: React.ReactNode;
  /** Show breadcrumb */
  showBreadcrumb?: boolean;
  /** Custom class name */
  className?: string;
  /** Children rendered below the header */
  children?: React.ReactNode;
}

// ============================================
// COMPONENT
// ============================================

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  showBreadcrumb = true,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Breadcrumb */}
      {showBreadcrumb && (
        <AppBreadcrumb items={breadcrumbs} showHome />
      )}

      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title & Description */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Children (e.g., tabs, filters) */}
      {children}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * PageHeader.Skeleton
 * Loading state for page header
 */
function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1 animate-pulse rounded bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </div>

      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

PageHeader.Skeleton = PageHeaderSkeleton;
