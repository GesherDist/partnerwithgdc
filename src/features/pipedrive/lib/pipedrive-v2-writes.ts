/**
 * Pipedrive API v2 writes for deals, persons and organizations.
 *
 * Replaces the deprecated v1 PUT /deals, /persons, /organizations and
 * POST /deals calls used by the push service. Differences handled here:
 * - v2 uses PATCH (partial update) instead of PUT
 * - person emails / phones are arrays of { value, primary, label }; a PATCH
 *   replaces the whole array, so the current list is read first and merged
 *   (other addresses are kept, only the primary one changes)
 * - organization address is an object ({ value, route, locality, ... })
 *
 * Rollback: set PIPEDRIVE_LEGACY_V1_WRITES=true to send these writes through
 * the previous v1 provider methods (kept unchanged) until v1 is switched off.
 */

import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest, runPipedriveWrite } from './rate-limiter';

export function legacyV1WritesEnabled(): boolean {
  return process.env.PIPEDRIVE_LEGACY_V1_WRITES === 'true';
}

// ============================================
// DEALS
// ============================================

export interface DealPatch {
  title?: string;
  value?: number;
  currency?: string;
  status?: 'open' | 'won' | 'lost';
  stage_id?: number;
  pipeline_id?: number;
  expected_close_date?: string;
}

/** PATCH /api/v2/deals/{id} (idempotent, so transient errors are retried) */
export async function patchDealV2(connectionId: string, dealId: number, patch: DealPatch): Promise<void> {
  const body = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  if (Object.keys(body).length === 0) {
    return;
  }
  await runPipedriveRequest(() => pipedriveProvider.request(connectionId, 'PATCH', `deals/${dealId}`, body));
}

export interface DealCreate {
  title: string;
  value: number;
  currency: string;
  status: 'open' | 'won';
  person_id?: number | null;
  org_id?: number | null;
  pipeline_id?: number | null;
  stage_id?: number | null;
}

/**
 * POST /api/v2/deals. Not idempotent: only retried on 429 (the request was not
 * processed), never on 5xx/timeouts that might have created the deal.
 */
export async function createDealV2(connectionId: string, deal: DealCreate): Promise<number | null> {
  const body = Object.fromEntries(Object.entries(deal).filter(([, value]) => value !== undefined && value !== null));
  const response = await runPipedriveWrite(() =>
    pipedriveProvider.request<{ id?: number }>(connectionId, 'POST', 'deals', body)
  );
  const id = Number(response.data?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ============================================
// PERSONS
// ============================================

export interface ContactEntry {
  value: string;
  primary: boolean;
  label?: string;
}

/**
 * New list for a person's emails or phones after setting the primary value.
 * - value: becomes the primary entry (an existing equal entry is reused)
 * - null / '': the primary entry is removed, the others are kept
 * - undefined: unchanged (returns null = do not send)
 */
export function mergeContactEntries(
  existing: ContactEntry[] | null | undefined,
  value: string | null | undefined,
  label = 'work'
): ContactEntry[] | null {
  if (value === undefined) {
    return null;
  }
  const current = (existing ?? []).filter((entry) => entry?.value);
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return current.filter((entry) => !entry.primary).map((entry) => ({ ...entry, primary: false }));
  }
  const same = (entry: ContactEntry) => entry.value.trim().toLowerCase() === trimmed.toLowerCase();
  const others = current.filter((entry) => !same(entry) && !entry.primary).map((entry) => ({ ...entry, primary: false }));
  const previousPrimary = current.find((entry) => entry.primary && !same(entry));
  const kept = previousPrimary ? [{ ...previousPrimary, primary: false }, ...others] : others;
  return [{ value: trimmed, primary: true, label: current.find(same)?.label ?? label }, ...kept];
}

/** PATCH /api/v2/persons/{id}: name, primary email, primary phone */
export async function patchPersonV2(
  connectionId: string,
  personId: number,
  update: { name?: string; email?: string | null; phone?: string | null }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (update.name?.trim()) {
    body.name = update.name.trim();
  }
  if (update.email !== undefined || update.phone !== undefined) {
    const current = await runPipedriveRequest(() =>
      pipedriveProvider.request<{ emails?: ContactEntry[]; phones?: ContactEntry[] }>(connectionId, 'GET', `persons/${personId}`)
    );
    const emails = mergeContactEntries(current.data?.emails, update.email);
    const phones = mergeContactEntries(current.data?.phones, update.phone);
    if (emails) {body.emails = emails;}
    if (phones) {body.phones = phones;}
  }
  if (Object.keys(body).length === 0) {
    return;
  }
  await runPipedriveRequest(() => pipedriveProvider.request(connectionId, 'PATCH', `persons/${personId}`, body));
}

// ============================================
// ORGANIZATIONS
// ============================================

export interface AddressInput {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/** v2 organization address object; null when no part is set */
export function toV2Address(address: AddressInput | null | undefined): Record<string, string> | null {
  if (!address) {
    return null;
  }
  const parts: Array<[string, string | null | undefined]> = [
    ['route', address.street],
    ['locality', address.city],
    ['admin_area_level_1', address.state],
    ['postal_code', address.postalCode],
    ['country', address.country],
  ];
  const present = parts.filter(([, value]) => value?.trim()) as Array<[string, string]>;
  if (present.length === 0) {
    return null;
  }
  return {
    value: present.map(([, value]) => value.trim()).join(', '),
    ...Object.fromEntries(present.map(([key, value]) => [key, value.trim()])),
  };
}

/** PATCH /api/v2/organizations/{id}: name and/or address */
export async function patchOrganizationV2(
  connectionId: string,
  orgId: number,
  update: { name?: string | null; address?: AddressInput | null }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (update.name?.trim()) {
    body.name = update.name.trim();
  }
  const address = toV2Address(update.address);
  if (address) {
    body.address = address;
  }
  if (Object.keys(body).length === 0) {
    return;
  }
  await runPipedriveRequest(() => pipedriveProvider.request(connectionId, 'PATCH', `organizations/${orgId}`, body));
}
