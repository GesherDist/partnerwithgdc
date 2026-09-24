/**
 * No Permission Page
 *
 * Displayed when user doesn't have permission to access a feature.
 * Inside dashboard layout to show sidebar with accessible modules.
 */

import { Metadata } from 'next';
import { ShieldX } from 'lucide-react';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Access Denied | Gesher Distribution',
  description: 'You do not have permission to access this page',
};

// ============================================
// PAGE
// ============================================

export default function NoPermissionPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="rounded-full bg-destructive/10 p-6 mb-6">
        <ShieldX className="h-16 w-16 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">Access Denied</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        You don&apos;t have permission to access this feature. Please contact your administrator if you believe this is an error.
      </p>
      <p className="text-sm text-muted-foreground">
        Use the sidebar to navigate to features you have access to.
      </p>
    </div>
  );
}
