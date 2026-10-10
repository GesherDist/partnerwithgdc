/**
 * GDC Pipedrive settings storage.
 *
 * Resolved Pipedrive IDs (pipeline, stages, custom field codes, activity type
 * keys) are stored in the Pipedrive connection's metadata under `gdc`, so no
 * schema change is needed. A reconnect creates a new connection row; services
 * then re-resolve the IDs from Pipedrive (see getGdcConfig in setup.service).
 *
 * Queries mirror the integration repositories (integrations /
 * integration_connections, same service-role access) through the shared `db`
 * client.
 */

import { db } from '@/shared/lib/supabase/database';
import type { GdcActivityTypeKey, GdcFieldKey, GdcStageKey } from './config';

export interface GdcFieldMapping {
  /** Pipedrive field_code (40-char hash) used as the key in custom_fields */
  code: string;
  /** Enum option label -> option id */
  options?: Record<string, number>;
}

export interface GdcResolvedConfig {
  pipelineId: number;
  stageIds: Record<GdcStageKey, number>;
  fields: Record<GdcFieldKey, GdcFieldMapping>;
  /** Activity type key_string as used in activity.type */
  activityTypes: Record<GdcActivityTypeKey, string>;
  resolvedAt: string;
}

/**
 * The connected Pipedrive connection, or null when Pipedrive is not connected.
 */
export async function getActivePipedriveConnectionId(): Promise<string | null> {
  const { data: integration, error: integrationError } = await db
    .from('integrations')
    .select('id')
    .eq('provider', 'pipedrive')
    .limit(1)
    .maybeSingle();
  if (integrationError) {
    throw new Error(`Failed to load the Pipedrive integration: ${integrationError.message}`);
  }
  if (!integration) {
    return null;
  }

  const { data: connection, error } = await db
    .from('integration_connections')
    .select('id, status')
    .eq('integration_id', integration.id)
    .is('deleted_at', null)
    .is('organization_id', null)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load the Pipedrive connection: ${error.message}`);
  }
  return connection && connection.status === 'connected' ? (connection.id as string) : null;
}

/**
 * Scopes Pipedrive granted to the connection, or null when unknown
 * (connections made before scopes were recorded).
 */
export async function getGrantedScopes(connectionId: string): Promise<string[] | null> {
  const metadata = await getConnectionMetadata(connectionId);
  const scopes = (metadata as { grantedScopes?: unknown } | null)?.grantedScopes;
  return Array.isArray(scopes) ? scopes.map(String) : null;
}

async function getConnectionMetadata(connectionId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from('integration_connections')
    .select('metadata')
    .eq('id', connectionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load the Pipedrive connection: ${error.message}`);
  }
  return data ? ((data.metadata as Record<string, unknown> | null) ?? {}) : null;
}

export async function loadGdcConfig(connectionId: string): Promise<GdcResolvedConfig | null> {
  const metadata = await getConnectionMetadata(connectionId);
  const stored = (metadata as { gdc?: GdcResolvedConfig } | null)?.gdc;
  return stored && typeof stored.pipelineId === 'number' ? stored : null;
}

export async function saveGdcConfig(connectionId: string, config: GdcResolvedConfig): Promise<void> {
  const metadata = await getConnectionMetadata(connectionId);
  if (metadata === null) {
    throw new Error('Pipedrive connection not found');
  }
  const { error } = await db
    .from('integration_connections')
    .update({ metadata: { ...metadata, gdc: config } })
    .eq('id', connectionId)
    .is('deleted_at', null);
  if (error) {
    throw new Error(`Failed to save GDC Pipedrive settings: ${error.message}`);
  }
}
