/**
 * Health Check Route
 *
 * Simple endpoint for monitoring application health.
 * Returns basic status information.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '0.1.0',
  };

  return NextResponse.json(healthCheck, { status: 200 });
}
