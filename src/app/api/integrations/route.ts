/**
 * Integrations API Route
 *
 * GET /api/integrations
 *
 * Returns all available integrations with their connection status.
 */

import { NextResponse } from 'next/server';
import {
  getActiveIntegrations,
  getConnections,
} from '@/modules/integrations/core/repositories';
import type { AvailableIntegration } from '@/modules/integrations/core';

export async function GET() {
  try {
    // Get all active integrations
    const integrations = await getActiveIntegrations();

    // Get all connections for this organization (null for single-tenant)
    const connections = await getConnections(null);

    // Build connection map for quick lookup
    const connectionMap = new Map(
      connections.map((c) => [c.integration_id, c])
    );

    // Map integrations with connection status
    const result: AvailableIntegration[] = integrations.map((integration) => {
      const connection = connectionMap.get(integration.id);

      return {
        id: integration.id,
        provider: integration.provider,
        type: integration.type,
        name: integration.name,
        description: integration.description ?? undefined,
        iconUrl: integration.icon_url ?? undefined,
        documentationUrl: integration.documentation_url ?? undefined,
        status: integration.status,
        connected: connection?.status === 'connected',
        connectionStatus: connection?.status,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to get integrations:', error);

    return NextResponse.json(
      { error: 'Failed to get integrations' },
      { status: 500 }
    );
  }
}
