/**
 * Pipedrive Status Route
 *
 * GET /api/pipedrive/status
 *
 * Returns the current Pipedrive connection status for the UI.
 * Requires a signed-in user allowed to manage the integration.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/shared/lib/auth/check-permission';
import {
  pipedriveProvider,
  PIPEDRIVE_MANAGE_PERMISSION,
} from '@/modules/integrations/providers/crm/pipedrive';

export async function GET() {
  // /api routes bypass the auth middleware, so check here
  const guard = await requirePermission(PIPEDRIVE_MANAGE_PERMISSION);
  if (guard.response) {
    return guard.response;
  }

  try {
    const status = await pipedriveProvider.getConnectionStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error('Pipedrive status check failed:', error);

    return NextResponse.json(
      { connected: false, error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}
