import { redirect } from 'next/navigation';

/**
 * Root Page
 *
 * Redirects to login page.
 * Authenticated users will be redirected to dashboard by middleware.
 */
export default function RootPage() {
  redirect('/login');
}
