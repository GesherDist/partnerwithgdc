/**
 * 401 Unauthorized Page
 *
 * Displayed when user is not authenticated.
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '401 - Unauthorized | Gesher Distribution',
  description: 'Authentication required',
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-10 w-10 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>

        {/* Code */}
        <p className="text-sm font-medium text-yellow-600">401</p>

        {/* Title */}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Authentication Required
        </h1>

        {/* Description */}
        <p className="mt-4 text-muted-foreground">
          You need to sign in to access this page. Please log in with your
          credentials to continue.
        </p>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
