/**
 * Rep Monthly Report Page
 *
 * GDC monthly rep dashboard (new leads contacted, follow-ups, won value / tires).
 * Same permission as the Deals page.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { RepMonthlyReportView } from '@/features/pipedrive/components/RepMonthlyReportView';

export default async function RepMonthlyReportPage() {
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'customers.view_module')) {
    redirect('/no-permission');
  }

  return <RepMonthlyReportView />;
}
