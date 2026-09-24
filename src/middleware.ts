/**
 * Next.js Middleware
 *
 * Handles authentication and route protection.
 * Refreshes session and redirects unauthenticated users.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/shared/lib/supabase/middleware';

// ============================================
// ROUTE CONFIGURATION
// ============================================

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
];

/**
 * Auth routes (redirect to dashboard if authenticated)
 *
 * /reset-password is deliberately NOT here. Following a recovery link signs the
 * user in first, so treating it as an auth route bounced them to the dashboard
 * before they could ever set a new password.
 */
const AUTH_ROUTES = [
  '/login',
  '/forgot-password',
];

/**
 * API routes that should skip middleware
 */
const API_ROUTES = [
  '/api/auth',
];

// ============================================
// MIDDLEWARE
// ============================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    API_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  // Update session (refresh token if needed)
  const { response, user } = await updateSession(request);

  // Check if user is authenticated
  const isAuthenticated = !!user;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route);
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isPublicRoute && pathname !== '/') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

// ============================================
// MATCHER
// ============================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
