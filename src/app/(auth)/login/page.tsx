/**
 * Login Page
 *
 * Authentication page for user sign-in.
 * Uses AuthLayout for consistent styling.
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { AuthLayout } from '@/shared/components/layout';
import { LoginForm } from '@/features/auth/components/LoginForm';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Sign In | Gesher Distribution',
  description: 'Sign in to your Gesher Distribution account',
};

// ============================================
// PAGE
// ============================================

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      description="Enter your credentials to access your account"
    >
      <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
