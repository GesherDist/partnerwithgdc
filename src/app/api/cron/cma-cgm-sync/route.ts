/**
 * CMA CGM Container Tracking Sync - Cron Job API
 *
 * This endpoint is called daily (via Vercel cron or external scheduler)
 * to sync all active containers with CMA CGM Track & Trace API.
 *
 * Schedule: Daily at 6:00 AM UTC
 *
 * Authentication: CRON_SECRET header required
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncAllContainers,
  isCmaCgmConfigured,
} from '@/features/shipping/services';

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

/**
 * POST /api/cron/cma-cgm-sync
 *
 * Sync all active containers with CMA CGM API
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    if (!verifyCronSecret(request)) {
      console.error('[CMA-CGM Cron] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
 * GET /api/cron/cma-cgm-sync
 *
 * Get sync status and configuration info
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization for status check too
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const configured = isCmaCgmConfigured();

    return NextResponse.json({
      configured,
      endpoint: '/api/cron/cma-cgm-sync',
      method: 'POST',
      description: 'Sync all active containers with CMA CGM Track & Trace API',
      schedule: 'Daily at 6:00 AM UTC (recommended)',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
