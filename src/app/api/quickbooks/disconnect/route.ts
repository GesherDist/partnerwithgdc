/**
 * QuickBooks Disconnect Route
 *
 * POST /api/quickbooks/disconnect
 *
 * Disconnects the QuickBooks integration:
 * - Revokes token at Intuit (best effort)
 * - Removes connection from database
 */

import { NextResponse } from 'next/server';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';
import {
  getIntegrationByProvider,
  getConnectionByIntegrationId,
} from '@/modules/integrations/core/repositories';

export async function POST() {
  try {
    // Get the current QuickBooks connection
    const integration = await getIntegrationByProvider('quickbooks');
    if (!integration) {
      return NextResponse.json({ success: true }); // Nothing to disconnect
    }

    const connection = await getConnectionByIntegrationId(integration.id);
    if (!connection) {
      return NextResponse.json({ success: true }); // Nothing to disconnect
    }

    // Disconnect using the provider
    await quickBooksProvider.disconnect(connection.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('QuickBooks disconnect failed:', error);

    return NextResponse.json(
      { error: 'Failed to disconnect QuickBooks' },
      { status: 500 }
    );
  }
}
