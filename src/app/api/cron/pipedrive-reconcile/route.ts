/**
 * Pipedrive Reconcile Cron
 *
 * GET/POST /api/cron/pipedrive-reconcile[?days=30]
 *
 * 1. Retries the Won → ERP quote flow for deals whose webhook failed in the
 *    last `days` days (never for deals without a failed webhook, so a deal
 *    handled by hand gets no second quote). Creates no sales orders.
 * 2. Retries ERP sales order number write-backs: every quote linked to a
 *    Pipedrive deal and converted in the last `days` days must show its SO
 *    number on the deal. Only writes when the deal is missing it.
 * 3. Purchase history safety net: republishes the note of every linked
 *    customer whose sales orders or order lines changed in the last day
 *    (changes made outside the sales order service). Unchanged notes are not
 *    rewritten.
 * 4. Order status safety net: deals whose ERP quote or sales order changed in
 *    the last day get their "ERP Order Status" field brought up to date.
 * All steps are safe to run repeatedly.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`, fail closed.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  reconcileFailedWonDeals,
  reconcileSalesOrderWriteBacks,
} from '@/features/pipedrive/gdc/deal-erp.service';
import { reconcileRecentPurchaseHistory } from '@/features/pipedrive/gdc/purchase-history.service';
import { reconcileRecentOrderStatuses } from '@/features/pipedrive/gdc/order-status.service';
import { isCronAuthorized } from '@/features/pipedrive/lib/cron-auth';

export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = Number(request.nextUrl.searchParams.get('days') ?? '30');
  const sinceDays = Number.isInteger(days) && days > 0 && days <= 365 ? days : 30;
  try {
    // Won deals whose ERP quote failed first, so their SO numbers can follow later
    const wonDeals = await reconcileFailedWonDeals({ sinceDays });
    const result = await reconcileSalesOrderWriteBacks({ sinceDays });
    // Its own failure must not hide the results of the steps above
    const purchaseHistory = await reconcileRecentPurchaseHistory().catch((error: unknown) => {
      console.error('[Pipedrive Reconcile] Purchase history step failed:', error);
      return { customers: 0, published: 0, failed: -1 };
    });
    const orderStatus = await reconcileRecentOrderStatuses().catch((error: unknown) => {
      console.error('[Pipedrive Reconcile] Order status step failed:', error);
      return { deals: 0, written: 0, failed: -1 };
    });
    return NextResponse.json({
      success: true,
      sinceDays,
      checked: result.checked,
      written: result.written,
      failed: result.failed.length,
      wonDeals: {
        checked: wonDeals.checked,
        quotesCreated: wonDeals.created,
        failed: wonDeals.failed.length,
      },
      purchaseHistory,
      orderStatus,
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
