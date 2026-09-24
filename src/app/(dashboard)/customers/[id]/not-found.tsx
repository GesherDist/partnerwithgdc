/**
 * Customer Not Found Page
 *
 * Displayed when a customer with the given ID doesn't exist.
 */

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

export default function CustomerNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground/50 mb-6" />
      <h1 className="text-2xl font-semibold mb-2">Customer Not Found</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        The customer you&apos;re looking for doesn&apos;t exist or may have been deleted.
      </p>
      <Button asChild>
        <Link href="/customers">Back to Customers</Link>
      </Button>
    </div>
  );
}
