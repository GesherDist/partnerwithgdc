/**
 * Pipedrive account guard (PD18).
 *
 * Gesher stores Pipedrive record IDs (organizations, people, deals, notes,
 * activities). They only mean something in the Pipedrive account (company)
 * they came from. integrations.linked_account (migration 167) remembers that
 * account, also across a disconnect.
 *
 * - Connecting the same account again: nothing changes.
 * - Connecting a DIFFERENT account (e.g. sandbox -> live): every stored
 *   Pipedrive ID is cleared first, so nothing is written to an unrelated deal
 *   or organization of the new account. Customers are then linked again with
 *   "Customer mapping"; quotes / orders made before stay in Gesher unlinked.
 * - Webhook events from any other account are ignored.
 *
 * The switch (from, to, what was cleared) is kept so Settings can show it
 * with the next steps until an admin dismisses it.
 */

import { db } from '@/shared/lib/supabase/database';
import { isMissingColumnError } from './schema-guard';

export interface PipedriveAccountRef {
  companyId: string;
  companyName: string | null;
}

export interface PipedriveAccountSwitch {
  from: PipedriveAccountRef;
  to: PipedriveAccountRef;
  at: string;
  /** Rows whose Pipedrive IDs were cleared, per table */
  cleared: Record<string, number>;
  acknowledged: boolean;
}

export interface LinkedPipedriveAccount extends PipedriveAccountRef {
  linkedAt: string;
  lastSwitch?: PipedriveAccountSwitch;
}

async function loadIntegration(): Promise<{ id: string; linked: LinkedPipedriveAccount | null } | null> {
  const { data, error } = await db.from('integrations').select('id, linked_account').eq('provider', 'pipedrive').maybeSingle();
  if (error) {
    // Migration 167 not applied yet: the guard is off (same as before)
    if (isMissingColumnError(error, 'linked_account')) {return null;}
    throw new Error(`Failed to load the Pipedrive integration: ${error.message}`);
  }
  if (!data) {return null;}
  return { id: data.id as string, linked: (data.linked_account as LinkedPipedriveAccount | null) ?? null };
}

async function saveLinkedAccount(integrationId: string, linked: LinkedPipedriveAccount): Promise<void> {
  const { error } = await db.from('integrations').update({ linked_account: linked }).eq('id', integrationId);
  if (error) {
    throw new Error(`Failed to save the linked Pipedrive account: ${error.message}`);
  }
}

/** The Pipedrive account Gesher's stored IDs belong to, or null when unknown */
export async function getLinkedPipedriveAccount(): Promise<LinkedPipedriveAccount | null> {
  return (await loadIntegration())?.linked ?? null;
}

// ============================================
// CLEARING STORED IDS
// ============================================

/** Every column holding a Pipedrive record ID (or data derived from one) */
const LINK_COLUMNS: Array<{ table: string; columns: string[] }> = [
  { table: 'customers', columns: ['pipedrive_org_id', 'pipedrive_person_id', 'pipedrive_deal_id', 'pipedrive_synced_at', 'pipedrive_sync_snapshot'] },
  { table: 'customer_contacts', columns: ['pipedrive_person_id', 'pipedrive_sync_snapshot'] },
  { table: 'quotes', columns: ['pipedrive_deal_id'] },
  { table: 'leads', columns: ['pipedrive_person_id', 'pipedrive_org_id', 'pipedrive_deal_id', 'pipedrive_owner_id', 'pipedrive_lead_id'] },
  { table: 'lead_notes', columns: ['pipedrive_note_id'] },
  { table: 'deals', columns: ['pipedrive_deal_id', 'pipedrive_org_id', 'pipedrive_person_id', 'pipedrive_owner_id', 'pipedrive_synced_at'] },
  { table: 'deal_notes', columns: ['pipedrive_note_id'] },
  { table: 'deal_activities', columns: ['pipedrive_activity_id'] },
];

/**
 * Clear every stored Pipedrive ID (all rows, deleted ones too). Returns the
 * number of rows changed per table. A table or column that does not exist on
 * this database is skipped.
 */
export async function clearPipedriveLinks(): Promise<Record<string, number>> {
  const cleared: Record<string, number> = {};
  for (const { table, columns } of LINK_COLUMNS) {
    const nulls = Object.fromEntries(columns.map((column) => [column, null]));
    const { data, error } = await db
      .from(table)
      .update(nulls)
      .or(columns.map((column) => `${column}.not.is.null`).join(','))
      .select('id');
    if (error) {
      // Optional legacy tables / columns (older databases): nothing to clear
      if (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST204' || /does not exist|could not find/i.test(error.message)) {
        continue;
      }
      throw new Error(`Failed to clear Pipedrive links in ${table}: ${error.message}`);
    }
    cleared[table] = data?.length ?? 0;
  }
  return cleared;
}

// ============================================
// CONNECT / WEBHOOK CHECKS
// ============================================

/** Webhook check cache of the linked company id (reset on connect) */
let cachedCompany: { id: string | null; at: number } | null = null;
const COMPANY_CACHE_MS = 60_000;

export interface AccountConnectResult {
  switched: boolean;
  previous?: PipedriveAccountRef;
  cleared?: Record<string, number>;
}

/**
 * Called right after a successful Pipedrive connection. Clears the stored IDs
 * when the account differs from the one they belong to.
 */
export async function onPipedriveAccountConnected(account: PipedriveAccountRef): Promise<AccountConnectResult> {
  const integration = await loadIntegration();
  if (!integration) {
    return { switched: false };
  }
  cachedCompany = null;
  const now = new Date().toISOString();
  const linked = integration.linked;

  if (!linked?.companyId) {
    await saveLinkedAccount(integration.id, { ...account, linkedAt: now });
    return { switched: false };
  }
  if (String(linked.companyId) === String(account.companyId)) {
    if (linked.companyName !== account.companyName) {
      await saveLinkedAccount(integration.id, { ...linked, companyName: account.companyName });
    }
    return { switched: false };
  }

  const previous: PipedriveAccountRef = { companyId: String(linked.companyId), companyName: linked.companyName };
  const cleared = await clearPipedriveLinks();
  await saveLinkedAccount(integration.id, {
    ...account,
    linkedAt: now,
    lastSwitch: { from: previous, to: account, at: now, cleared, acknowledged: false },
  });
  return { switched: true, previous, cleared };
}

/** Settings: hide the "account changed" notice */
export async function acknowledgePipedriveAccountSwitch(): Promise<void> {
  const integration = await loadIntegration();
  if (!integration?.linked?.lastSwitch) {
    return;
  }
  await saveLinkedAccount(integration.id, {
    ...integration.linked,
    lastSwitch: { ...integration.linked.lastSwitch, acknowledged: true },
  });
}

/**
 * Webhooks: true when the event comes from the linked account (or when the
 * account or the event's company is unknown, so nothing is blocked by mistake).
 */
export async function isFromLinkedPipedriveAccount(companyId: unknown): Promise<boolean> {
  if (companyId === null || companyId === undefined || companyId === '') {
    return true;
  }
  if (!cachedCompany || Date.now() - cachedCompany.at > COMPANY_CACHE_MS) {
    const linked = await getLinkedPipedriveAccount();
    cachedCompany = { id: linked?.companyId ? String(linked.companyId) : null, at: Date.now() };
  }
  return !cachedCompany.id || cachedCompany.id === String(companyId);
}
