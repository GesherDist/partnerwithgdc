'use client';

/**
 * AppBreadcrumb Component
 *
 * Dynamic breadcrumb navigation based on current path.
 * Automatically generates breadcrumb items from URL segments.
 */

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components/ui/breadcrumb';

// ============================================
// TYPES
// ============================================

interface BreadcrumbItemData {
  label: string;
  href?: string;
}

interface AppBreadcrumbProps {
  /** Override automatic breadcrumb generation */
  items?: BreadcrumbItemData[];
  /** Show home icon as first item */
  showHome?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================
// PATH LABEL MAPPING
// ============================================

/**
 * Map path segments to readable labels
 */
const PATH_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  'audit-logs': 'Audit Logs',
  settings: 'Settings',
  profile: 'Profile',
  create: 'Create',
  edit: 'Edit',
  new: 'New',
};

/**
 * Get label for a path segment
 */
function getSegmentLabel(segment: string): string {
  // Check if segment is in our mapping
  if (PATH_LABELS[segment]) {
    return PATH_LABELS[segment];
  }

  // Check if it looks like a UUID (skip displaying)
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment
    )
  ) {
    return 'Details';
  }

  // Convert kebab-case or snake_case to Title Case
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Generate breadcrumb items from pathname
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItemData[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [];
  }

  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = getSegmentLabel(segment);

    // Last segment doesn't need href
    const isLast = index === segments.length - 1;

    return {
      label,
      href: isLast ? undefined : href,
    };
  });
}

// ============================================
// COMPONENT
// ============================================

export function AppBreadcrumb({
  items,
  showHome = true,
  className,
}: AppBreadcrumbProps) {
  const pathname = usePathname();

  // Use provided items or generate from path
  const breadcrumbItems = items ?? generateBreadcrumbs(pathname);

  // Don't render if no items
  if (breadcrumbItems.length === 0 && !showHome) {
    return null;
  }

  return (
    <Breadcrumb className={cn(className)}>
      <BreadcrumbList>
        {/* Home Item */}
        {showHome && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="flex items-center">
                  <Home className="h-4 w-4" />
                  <span className="sr-only">Home</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbItems.length > 0 && <BreadcrumbSeparator />}
          </>
        )}

        {/* Dynamic Items */}
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <Fragment key={item.label + index}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
