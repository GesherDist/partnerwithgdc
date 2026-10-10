/**
 * Pipedrive Reconcile Cron
 *
 * GET/POST /api/cron/pipedrive-reconcile[?days=30]
 *
 * Retries ERP sales order number write-backs: every quote linked to a
 * Pipedrive deal and converted in the last `days` days must show its SO
 * number on the deal. Only writes when the deal is missing it, so it is safe
 * to run repeatedly. Creates no quotes and no sales orders.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`, fail closed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { reconcileSalesOrderWriteBacks } from '@/features/pipedrive/gdc/deal-erp.service';
import { isCronAuthorized } from '@/features/pipedrive/lib/cron-auth';

export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = Number(request.nextUrl.searchParams.get('days') ?? '30');
  const sinceDays = Number.isInteger(days) && days > 0 && days <= 365 ? days : 30;
  try {
    const result = await reconcileSalesOrderWriteBacks({ sinceDays });
    return NextResponse.json({
      success: true,
      sinceDays,
      checked: result.checked,
      written: result.written,
      failed: result.failed.length,
    });
  } catch (error) {
    console.error('[Pipedrive Reconcile] Failed:', error);
    return NextResponse.json({ success: false, error: 'Reconcile failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
