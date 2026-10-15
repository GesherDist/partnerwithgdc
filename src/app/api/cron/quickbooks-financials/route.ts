/**
 * QuickBooks Financials Cron
 *
 * GET/POST /api/cron/quickbooks-financials
 *
 * Daily: refreshes the chart of accounts, reads the QuickBooks reports
 * (Balance Sheet, A/R and A/P Aging, Cash Flow, Profit and Loss) and stores
 * today's snapshot for the management dashboard. Safe to run repeatedly
 * (one snapshot per company per day, replaced on re-run). Read-only towards
 * QuickBooks.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`, fail closed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/features/pipedrive/lib/cron-auth';
import { syncFinancials } from '@/modules/integrations/quickbooks/services/qbo-financials.service';

export const maxDuration = 120;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { financials, stored } = await syncFinancials();
    return NextResponse.json({
      success: true,
      asOf: financials.asOf,
      environment: financials.environment,
      stored,
      ...(stored ? {} : { warning: 'Database migration 162 is required to store the snapshot' }),
      unmappedAccounts: financials.unmappedAccounts.length,
    });
  } catch (error) {
    console.error('[QuickBooks Financials Cron] Failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
