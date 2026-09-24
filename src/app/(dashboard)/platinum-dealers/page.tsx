/**
 * Platinum Dealers Page
 *
 * Manage platinum dealers and their inventory.
 */

import { Suspense } from 'react';
import { PlatinumDealersContent } from './platinum-dealers-content';

export const metadata = {
  title: 'Platinum Dealers | GDC',
  description: 'Manage platinum dealers and their inventory',
};

export default function PlatinumDealersPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <Suspense fallback={<div>Loading...</div>}>
        <PlatinumDealersContent />
      </Suspense>
    </div>
  );
}
