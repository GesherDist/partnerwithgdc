/**
 * Reset Password Page
 *
 * Page for setting a new password after reset.
 */

import { Metadata } from 'next';
import { AuthLayout } from '@/shared/components/layout';
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Reset Password | Gesher Distribution',
  description: 'Set a new password for your Gesher Distribution account',
};

// ============================================
// PAGE
// ============================================

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Set new password"
      description="Create a strong password for your account"
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
