/**
 * Forgot Password Page
 *
 * Page for requesting password reset email.
 */

import { Metadata } from 'next';
import { AuthLayout } from '@/shared/components/layout';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Forgot Password | Gesher Distribution',
  description: 'Reset your Gesher Distribution account password',
};

// ============================================
// PAGE
// ============================================

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Forgot password?"
      description="Enter your email and we'll send you a reset link"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
