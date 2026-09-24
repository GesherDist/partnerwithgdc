/**
 * Integration Repository
 *
 * Database operations for integrations master list.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  IntegrationRow,
  IntegrationProvider,
  IntegrationType,
  IntegrationStatus,
} from '../types';

const TABLE_NAME = 'integrations';

/**
 * Get all available integrations
 */
export async function getIntegrations(
  options?: {
    type?: IntegrationType;
    status?: IntegrationStatus;
  }
): Promise<IntegrationRow[]> {
  const supabase = createAdminClient();

  let query = supabase.from(TABLE_NAME).select('*');

  if (options?.type) {
    query = query.eq('type', options.type);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query.order('name');

  if (error) {
    console.error('Failed to get integrations:', error);
    throw error;
  }

  return data as IntegrationRow[];
}

/**
 * Get active integrations only
 */
export async function getActiveIntegrations(): Promise<IntegrationRow[]> {
  return getIntegrations({ status: 'active' });
}

/**
 * Get integration by provider
 */
export async function getIntegrationByProvider(
  provider: IntegrationProvider
): Promise<IntegrationRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('provider', provider)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get integration by provider:', error);
    throw error;
  }

  return data as IntegrationRow;
}

/**
 * Get integration by ID
 */
export async function getIntegrationById(id: string): Promise<IntegrationRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get integration by ID:', error);
    throw error;
  }

  return data as IntegrationRow;
}

/**
 * Get integrations by type
 */
export async function getIntegrationsByType(type: IntegrationType): Promise<IntegrationRow[]> {
  return getIntegrations({ type, status: 'active' });
}
