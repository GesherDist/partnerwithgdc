/**
 * CMA CGM Container Tracking Sync - Cron Job API
 *
 * This endpoint is called daily (via Vercel cron or external scheduler)
 * to sync all active containers with CMA CGM Track & Trace API.
 *
 * Schedule: Daily at 6:00 AM UTC
 *
 * Authentication: CRON_SECRET header required
 *
 * GET and POST both run the sync: schedulers (Vercel cron, crontab + curl)
 * send GET. Add ?status=1 to only check configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncAllContainers,
  isCmaCgmConfigured,
} from '@/features/shipping/services';

// About 1 second per container (API rate limit)
export const maxDuration = 300;

/**
 * Verify cron secret to prevent unauthorized access
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If no CRON_SECRET is set, only allow in development
  if (!cronSecret) {
    return process.env.NODE_ENV === 'development';
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <secret>" and just "<secret>" formats
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return token === cronSecret;
}

async function handle(request: NextRequest) {
  try {
    // Verify authorization
    if (!verifyCronSecret(request)) {
      console.error('[CMA-CGM Cron] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Status check only (no sync)
    if (request.nextUrl.searchParams.get('status') === '1') {
      return NextResponse.json({
        configured: isCmaCgmConfigured(),
        endpoint: '/api/cron/cma-cgm-sync',
        description: 'Sync all active containers with CMA CGM Track & Trace API',
        schedule: 'Daily at 6:00 AM UTC (recommended)',
      });
    }

    console.log('[CMA-CGM Cron] Starting scheduled container sync...');

    // Check if CMA CGM is configured
    if (!isCmaCgmConfigured()) {
      console.log('[CMA-CGM Cron] API not configured - skipping');
      return NextResponse.json({
        success: false,
        message: 'CMA CGM API key not configured',
        configured: false,
      });
    }

    // Run the sync
    const result = await syncAllContainers();

    console.log(
      `[CMA-CGM Cron] Sync completed: ${result.successCount}/${result.totalContainers} success`
    );

    return NextResponse.json({
      ...result,
      message: `Synced ${result.successCount} of ${result.totalContainers} containers`,
    });
  } catch (error) {
    console.error('[CMA-CGM Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/cma-cgm-sync - run the sync (what cron schedulers call)
 */
export async function GET(request: NextRequest) {
  return handle(request);
}

/**
 * POST /api/cron/cma-cgm-sync - run the sync
 */
export async function POST(request: NextRequest) {
  return handle(request);
}
