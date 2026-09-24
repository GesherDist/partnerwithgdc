'use client';

/**
 * ProtectedRoute Component
 *
 * Wrapper component for protecting routes that require authentication
 * and specific permissions.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/stores';
import { LoadingState } from '@/shared/components/feedback';

// ============================================
// TYPES
// ============================================

interface ProtectedRouteProps {
  /** Child components to render if authorized */
  children: React.ReactNode;
  /** Required permission(s) to access this route */
  permissions?: string | string[];
  /** Require ALL permissions (default) or ANY permission */
  requireAll?: boolean;
  /** Custom fallback component when unauthorized */
  fallback?: React.ReactNode;
  /** Redirect path when unauthorized (default: /forbidden) */
  redirectTo?: string;
}

// ============================================
// COMPONENT
// ============================================

export function ProtectedRoute({
  children,
  permissions,
  requireAll = true,
  fallback,
  redirectTo = '/forbidden',
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading, hasPermission, hasAnyPermission } = useAuthStore();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Wait for auth state to load
    if (isLoading) {
      return;
    }

    // Check if user is authenticated
    if (!user) {
      router.push('/login');
      return;
    }

    // If no permissions required, user is authorized
    if (!permissions) {
      setIsAuthorized(true);
      return;
    }

    // Check permissions
    const permissionList = Array.isArray(permissions) ? permissions : [permissions];
    const hasAccess = requireAll
      ? permissionList.every((p) => hasPermission(p))
      : hasAnyPermission(permissionList);

    if (!hasAccess) {
      if (fallback) {
        setIsAuthorized(false);
      } else {
        router.push(redirectTo);
      }
      return;
    }

    setIsAuthorized(true);
  }, [user, isLoading, permissions, requireAll, hasPermission, hasAnyPermission, router, redirectTo, fallback]);

  // Show loading state while checking auth
  if (isLoading || isAuthorized === null) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingState message="Checking permissions..." />
      </div>
    );
  }

  // Show fallback if unauthorized and fallback is provided
  if (!isAuthorized && fallback) {
    return <>{fallback}</>;
  }

  // Show children if authorized
  if (isAuthorized) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
}

// ============================================
// HOC VERSION
// ============================================

/**
 * Higher-order component for protecting components
 */
export function withProtectedRoute<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };
}
