/**
 * Supabase Middleware Client
 *
 * Creates a Supabase client for use in Next.js middleware.
 * This handles session refresh and cookie management.
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cookie type for Supabase SSR
 */
interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Environment variables validation
 */
function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Update session in middleware
 *
 * This function should be called in your middleware to:
 * 1. Refresh the user's session if it's expired
 * 2. Set the session cookies on the response
 *
 * Performance: Uses getSession() instead of getUser() to avoid
 * network calls to Supabase on every request. The session is
 * validated locally using the JWT. Full user verification happens
 * in the layout where it's cached.
 *
 * Usage in middleware.ts:
 * ```ts
 * import { updateSession } from '@/lib/supabase/middleware';
 *
 * export async function middleware(request: NextRequest) {
 *   return await updateSession(request);
 * }
 * ```
 */
export async function updateSession(request: NextRequest) {
  // Create an initial response that we'll modify
  let supabaseResponse = NextResponse.next({
    request,
  });

  const config = getSupabaseConfig();

  // If Supabase is not configured, just continue
  if (!config) {
    return { response: supabaseResponse, user: null };
  }

  const { supabaseUrl, supabaseAnonKey } = config;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Use getSession() for fast local JWT validation (no network call)
  // This is sufficient for route protection. Full verification with
  // getUser() happens in the layout where it's cached.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { response: supabaseResponse, user: session?.user ?? null };
}

/**
 * Check if the current path is a public route
 */
export function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
    '/api/auth',
  ];

  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Check if the current path is an API route
 */
export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/**
 * Check if the current path is a static asset
 */
export function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') // Has file extension
  );
}

/**
 * Routes that should always be accessible
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
] as const;

/**
 * Routes that require authentication
 */
export const PROTECTED_ROUTES = [
  '/dashboard',
  '/users',
  '/roles',
  '/settings',
  '/audit-logs',
] as const;
