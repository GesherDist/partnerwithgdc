/**
 * Health Check Route
 *
 * Simple endpoint for monitoring application health.
 * Returns basic status information.
 *
 * Nov 25 2026 (server monitoring, Ankur Nov 19 call): also checks that the
 * database answers. Used by the uptime monitor (UptimeRobot / Better Stack) and
 * by scripts/monitoring/server-health.sh.
 *   200 + status "healthy"   -> app and database OK
 *   503 + status "unhealthy" -> database did not answer (or answered with an error)
 * The route is public (middleware skips /api), so it never returns error details;
 * those go to the server log.
 */

import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 5000;

type CheckResult = { status: 'ok' | 'error'; latencyMs: number };

async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();
  try {
    const supabase = createAdminClient();
    // Smallest possible read: no rows come back (head), only the response status
    const query = supabase.from('products').select('id', { head: true }).limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`database timeout after ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS)
    );
    const { error } = await Promise.race([query, timeout]);
    if (error) {
      console.error('[health] database check failed:', error.message);
      return { status: 'error', latencyMs: Date.now() - started };
    }
    return { status: 'ok', latencyMs: Date.now() - started };
  } catch (err) {
    console.error('[health] database check failed:', err instanceof Error ? err.message : err);
    return { status: 'error', latencyMs: Date.now() - started };
  }
}

export async function GET() {
  // Old response (before Nov 25 2026) - kept for reference:
  // const healthCheck = {
  //   status: 'healthy',
  //   timestamp: new Date().toISOString(),
  //   uptime: process.uptime(),
  //   environment: process.env.NODE_ENV,
  //   version: process.env.npm_package_version || '0.1.0',
  // };
  //
  // return NextResponse.json(healthCheck, { status: 200 });

  const database = await checkDatabase();
  const healthy = database.status === 'ok';

  const healthCheck = {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '0.1.0',
    checks: { database },
  };

  return NextResponse.json(healthCheck, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
