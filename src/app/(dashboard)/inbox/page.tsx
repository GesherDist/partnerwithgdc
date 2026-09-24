/**
 * Inbox Page
 *
 * Displays list of inbound emails received via Postmark.
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { InboxContent } from './inbox-content';

export const metadata: Metadata = {
  title: 'Inbox | Gesher Distribution',
  description: 'View and manage inbound emails',
};

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-12 w-full bg-muted animate-pulse rounded" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 w-full bg-muted animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}
