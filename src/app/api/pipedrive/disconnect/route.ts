/**
 * Pipedrive Disconnect Route
 *
 * POST /api/pipedrive/disconnect
 *
 * Disconnects the Pipedrive integration:
 * - Revokes token at Pipedrive (best effort)
 * - Removes connection from database
 */

import { NextResponse } from 'next/server';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import {
  getIntegrationByProvider,
  getConnectionByIntegrationId,
} from '@/modules/integrations/core/repositories';

export async function POST() {
  try {
    // Get the current Pipedrive connection
    const integration = await getIntegrationByProvider('pipedrive');
    if (!integration) {
      return NextResponse.json({ success: true }); // Nothing to disconnect
    }

    const connection = await getConnectionByIntegrationId(integration.id);
    if (!connection) {
      return NextResponse.json({ success: true }); // Nothing to disconnect
    }

    // Disconnect using the provider
    await pipedriveProvider.disconnect(connection.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pipedrive disconnect failed:', error);

    return NextResponse.json(
      { error: 'Failed to disconnect Pipedrive' },
      { status: 500 }
    );
  }
}
