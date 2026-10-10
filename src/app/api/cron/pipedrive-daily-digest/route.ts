/**
 * Pipedrive Daily Digest Cron
 *
 * GET/POST /api/cron/pipedrive-daily-digest[?dryRun=1]
 *
 * Emails each rep their overdue activities, activities due today and GDC Sales
 * deals without a next step. Scheduled in vercel.json.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it).
 * Fails closed: without CRON_SECRET configured every request is rejected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyDigest } from '@/features/pipedrive/gdc/daily-digest.service';
import { isCronAuthorized } from '@/features/pipedrive/lib/cron-auth';

// Several Pipedrive list calls per rep; allow more than the default duration
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  try {
    const result = await runDailyDigest({ dryRun });
    return NextResponse.json({
      success: true,
      date: result.date,
      timeZone: result.timeZone,
      dryRun: result.dryRun,
      reps: result.digests.length,
      sent: result.digests.filter((d) => d.sent).length,
      failed: result.digests.filter((d) => d.error).map((d) => ({ userId: d.userId, error: d.error })),
      // Counts only: the response must not leak customer data
      summary: result.digests.map((d) => ({
        userId: d.userId,
        overdue: d.overdue.length,
        dueToday: d.dueToday.length,
        dealsWithoutNextStep: d.dealsWithoutNextStep.length,
      })),
    });
  } catch (error) {
    console.error('[Pipedrive Digest] Failed:', error);
    return NextResponse.json({ success: false, error: 'Digest failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
