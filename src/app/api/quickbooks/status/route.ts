/**
 * QuickBooks Status Route
 *
 * GET /api/quickbooks/status
 *
 * Returns the current QuickBooks connection status for the UI.
 */

import { NextResponse } from 'next/server';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';

export async function GET() {
  try {
    const status = await quickBooksProvider.getConnectionStatus();

    // Map to UI-expected format
    return NextResponse.json({
      connected: status.connected,
      companyName: status.accountName,
      realmId: status.accountId,
      environment: status.environment,
      connectedAt: status.connectedAt,
      tokenExpiresAt: status.tokenExpiresAt,
      status: status.status,
      errorMessage: status.errorMessage,
    });
  } catch (error) {
    console.error('QuickBooks status check failed:', error);

    return NextResponse.json(
      { connected: false, error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}
