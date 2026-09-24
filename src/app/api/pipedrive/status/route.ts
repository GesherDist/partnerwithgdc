/**
 * Pipedrive Status Route
 *
 * GET /api/pipedrive/status
 *
 * Returns the current Pipedrive connection status for the UI.
 */

import { NextResponse } from 'next/server';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';

export async function GET() {
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
