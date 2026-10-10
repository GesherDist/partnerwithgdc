/**
 * Organization & person sync with duplicate prevention.
 *
 * Matching policy (approved):
 * - Organization: stored Pipedrive ID first, then ERP Customer ID custom field,
 *   then normalized exact name. Exactly one match is reused; several matches
 *   are flagged for review and nothing is created.
 * - Person: stored Pipedrive ID first, then normalized email (exactly one
 *   match). Without an email a person is never matched globally by name; only
 *   an exact name match inside the same organization is reused, so re-running
 *   an import does not create duplicates.
 * - Existing Pipedrive IDs and relationships are preserved; an organization
 *   already carrying a different ERP Customer ID is a conflict, not a match.
 */

import { pipedriveProvider, isPipedriveNotFound } from '@/modules/integrations/providers/crm/pipedrive';
import { pipedriveSearchRateLimiter, runPipedriveRequest, runPipedriveWrite } from '../lib/rate-limiter';
import type { GdcAccountType } from './config';
import type { GdcResolvedConfig } from './settings';

// ============================================
// TYPES
// ============================================

export type MatchStatus = 'linked' | 'matched' | 'created' | 'would_create' | 'needs_review';

export interface MatchResult {
  status: MatchStatus;
  id?: number;
  reason?: string;
  /** Informational, e.g. an account type that was kept instead of downgraded */
  warnings?: string[];
}

export interface OrganizationInput {
  name: string;
  erpCustomerId?: string | null;
  accountType?: GdcAccountType | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    county?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  ownerId?: number | null;
  /** Pipedrive org already linked to the Gesher record, if any */
  existingOrgId?: number | null;
}

export interface PersonInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  orgId?: number | null;
  ownerId?: number | null;
  existingPersonId?: number | null;
}

interface OrgRecord {
  id: number;
  name: string;
  ownerId: number | null;
  hasAddress: boolean;
  customFields: Record<string, unknown>;
}

interface PersonRecord {
  id: number;
  name: string;
  orgId: number | null;
  emails: string[];
}

// ============================================
// NORMALIZATION & PARSING
// ============================================

export const normalizeName = (value: string | null | undefined) =>
  (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export const normalizeEmail = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

function toId(value: unknown): number | null {
  const raw = value && typeof value === 'object' ? (value as { value?: unknown; id?: unknown }).value ?? (value as { id?: unknown }).id : value;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

function parseOrg(raw: unknown): OrgRecord | null {
  const r = raw as Record<string, unknown> | null;
  const id = toId(r?.id);
  if (!r || id === null || r.is_deleted === true) {
    return null;
  }
  const address = r.address as { value?: string } | string | null | undefined;
  return {
    id,
    name: String(r.name ?? ''),
    ownerId: toId(r.owner_id),
    hasAddress: typeof address === 'string' ? address.trim() !== '' : Boolean(address?.value),
    customFields: (r.custom_fields as Record<string, unknown>) ?? {},
  };
}

function parsePerson(raw: unknown): PersonRecord | null {
  const r = raw as Record<string, unknown> | null;
  const id = toId(r?.id);
  if (!r || id === null || r.is_deleted === true) {
    return null;
  }
  const emailList = (r.emails ?? r.email) as Array<{ value?: string } | string> | undefined;
  return {
    id,
    name: String(r.name ?? ''),
    orgId: toId(r.org_id),
    emails: (Array.isArray(emailList) ? emailList : [])
      .map((e) => normalizeEmail(typeof e === 'string' ? e : e?.value))
      .filter(Boolean),
  };
}

/** Search results: v2 wraps hits as data.items[].item; tolerate a plain list too */
function searchHitIds(data: unknown): number[] {
  const container = data as { items?: unknown[] } | unknown[] | null;
  const hits = Array.isArray(container) ? container : container?.items ?? [];
  return hits
    .map((hit) => toId((hit as { item?: { id?: unknown } })?.item?.id ?? (hit as { id?: unknown })?.id))
    .filter((id): id is number => id !== null);
}

// ============================================
// PIPEDRIVE ACCESS
// ============================================

async function searchIds(
  connectionId: string,
  entity: 'organizations' | 'persons',
  term: string,
  fields: string,
  extra?: Record<string, string>
): Promise<number[]> {
  // Collapse whitespace so "Bob  Smith" finds "Bob Smith" (exact match is whitespace-sensitive)
  const cleanTerm = term.trim().replace(/\s+/g, ' ');
  if (!cleanTerm) {
    return [];
  }
  const params = new URLSearchParams({ term: cleanTerm, fields, exact_match: 'true', limit: '100', ...extra });
  const response = await pipedriveSearchRateLimiter.execute(() =>
    runPipedriveRequest(() =>
      pipedriveProvider.request<unknown>(connectionId, 'GET', `${entity}/search?${params.toString()}`)
    )
  );
  return [...new Set(searchHitIds(response.data))];
}

async function getOrg(connectionId: string, id: number): Promise<OrgRecord | null> {
  try {
    const response = await runPipedriveRequest(() =>
      pipedriveProvider.request<unknown>(connectionId, 'GET', `organizations/${id}`)
    );
    return parseOrg(response.data);
  } catch (error) {
    if (isPipedriveNotFound(error)) {return null;}
    throw error;
  }
}

async function getPerson(connectionId: string, id: number): Promise<PersonRecord | null> {
  try {
    const response = await runPipedriveRequest(() =>
      pipedriveProvider.request<unknown>(connectionId, 'GET', `persons/${id}`)
    );
    return parsePerson(response.data);
  } catch (error) {
    if (isPipedriveNotFound(error)) {return null;}
    throw error;
  }
}

/** Pipedrive user id by lower-cased email (assigned rep mapping) */
export async function getPipedriveUsersByEmail(connectionId: string): Promise<Map<string, number>> {
  // GET /v1/users is not on Pipedrive's v1 deprecation list
  const response = await runPipedriveRequest(() =>
    pipedriveProvider.request<unknown[]>(connectionId, 'GET', 'users', undefined, 'v1')
  );
  const users = new Map<string, number>();
  for (const raw of Array.isArray(response.data) ? response.data : []) {
    const user = raw as { id?: unknown; email?: string; active_flag?: boolean };
    const id = toId(user.id);
    if (id !== null && user.email && user.active_flag !== false) {
      users.set(normalizeEmail(user.email), id);
    }
  }
  return users;
}

// ============================================
// ORGANIZATIONS
// ============================================

/** Account types only move forward: Lead -> Prospect -> Current Customer */
const ACCOUNT_TYPE_RANK: Record<GdcAccountType, number> = { Lead: 0, Prospect: 1, 'Current Customer': 2 };

/** The organization's current Account Type, from its enum option id */
export function currentAccountType(config: GdcResolvedConfig, org: { customFields: Record<string, unknown> }): GdcAccountType | null {
  const raw = org.customFields[config.fields.org_account_type.code];
  const optionId = toId(raw);
  if (optionId === null) {
    return null;
  }
  const entry = Object.entries(config.fields.org_account_type.options ?? {}).find(([, id]) => Number(id) === optionId);
  return (entry?.[0] as GdcAccountType | undefined) ?? null;
}

/**
 * Account type to write: always when the org has none, otherwise only an
 * upgrade. A downgrade (e.g. a new Gesher lead for a Current Customer) is
 * never written.
 */
export function accountTypeToWrite(
  config: GdcResolvedConfig,
  existing: OrgRecord | null,
  requested: GdcAccountType | null | undefined
): { write: GdcAccountType | null; kept: GdcAccountType | null } {
  if (!requested) {
    return { write: null, kept: null };
  }
  const current = existing ? currentAccountType(config, existing) : null;
  if (!current || ACCOUNT_TYPE_RANK[requested] > ACCOUNT_TYPE_RANK[current]) {
    return { write: requested, kept: null };
  }
  return { write: null, kept: current !== requested ? current : null };
}

function buildOrgBody(config: GdcResolvedConfig, input: OrganizationInput, existing: OrgRecord | null) {
  const body: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};

  if (!existing) {
    body.name = input.name.trim();
  }

  if (input.erpCustomerId) {
    customFields[config.fields.org_erp_customer_id.code] = input.erpCustomerId;
  }
  const accountType = accountTypeToWrite(config, existing, input.accountType).write;
  if (accountType) {
    const optionId = config.fields.org_account_type.options?.[accountType];
    if (optionId !== undefined) {
      customFields[config.fields.org_account_type.code] = optionId;
    }
  }

  // Address and owner are only filled when missing, so rep edits in Pipedrive win
  const address = input.address;
  if (address && (!existing || !existing.hasAddress)) {
    const parts = [address.street, address.city, address.state, address.postalCode, address.country]
      .map((part) => part?.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      body.address = {
        value: parts.join(', '),
        ...(address.street ? { route: address.street } : {}),
        ...(address.city ? { locality: address.city } : {}),
        ...(address.state ? { admin_area_level_1: address.state } : {}),
        ...(address.county ? { admin_area_level_2: address.county } : {}),
        ...(address.postalCode ? { postal_code: address.postalCode } : {}),
        ...(address.country ? { country: address.country } : {}),
      };
    }
  }
  if (input.ownerId && (!existing || !existing.ownerId)) {
    body.owner_id = input.ownerId;
  }

  if (Object.keys(customFields).length > 0) {
    body.custom_fields = customFields;
  }
  return body;
}

/**
 * Find or create the Pipedrive organization for a Gesher record.
 */
export async function upsertOrganization(
  connectionId: string,
  config: GdcResolvedConfig,
  input: OrganizationInput,
  options: { dryRun?: boolean } = {}
): Promise<MatchResult> {
  const erpField = config.fields.org_erp_customer_id.code;
  const erpOf = (org: OrgRecord) => {
    const value = org.customFields[erpField];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };

  let target: OrgRecord | null = null;
  let status: MatchStatus = 'matched';

  // 1. Stored link
  if (input.existingOrgId) {
    target = await getOrg(connectionId, input.existingOrgId);
    if (target) {
      status = 'linked';
    }
  }

  // 2. ERP Customer ID
  if (!target && input.erpCustomerId) {
    const candidates = (
      await Promise.all(
        (await searchIds(connectionId, 'organizations', input.erpCustomerId, 'custom_fields')).map((id) =>
          getOrg(connectionId, id)
        )
      )
    ).filter((org): org is OrgRecord => org !== null && erpOf(org) === input.erpCustomerId);

    if (candidates.length > 1) {
      return {
        status: 'needs_review',
        reason: `${candidates.length} organizations carry ERP Customer ID ${input.erpCustomerId}`,
      };
    }
    target = candidates[0] ?? null;
  }

  // 3. Exact normalized name
  if (!target) {
    const candidates = (
      await Promise.all(
        (await searchIds(connectionId, 'organizations', input.name, 'name')).map((id) => getOrg(connectionId, id))
      )
    ).filter((org): org is OrgRecord => org !== null && normalizeName(org.name) === normalizeName(input.name));

    if (candidates.length > 1) {
      return { status: 'needs_review', reason: `${candidates.length} organizations are named "${input.name}"` };
    }
    const byName = candidates[0] ?? null;
    if (byName) {
      const otherErp = erpOf(byName);
      if (input.erpCustomerId && otherErp && otherErp !== input.erpCustomerId) {
        return {
          status: 'needs_review',
          id: byName.id,
          reason: `organization "${byName.name}" already has ERP Customer ID ${otherErp}`,
        };
      }
      target = byName;
    }
  }

  // Stored link pointing at an org that carries another ERP ID is a conflict too
  if (target && input.erpCustomerId) {
    const targetErp = erpOf(target);
    if (targetErp && targetErp !== input.erpCustomerId) {
      return {
        status: 'needs_review',
        id: target.id,
        reason: `linked organization has ERP Customer ID ${targetErp}, expected ${input.erpCustomerId}`,
      };
    }
  }

  if (target) {
    const body = buildOrgBody(config, input, target);
    if (!options.dryRun && Object.keys(body).length > 0) {
      await runPipedriveWrite(() =>
        pipedriveProvider.request<unknown>(connectionId, 'PATCH', `organizations/${target!.id}`, body)
      );
    }
    const kept = accountTypeToWrite(config, target, input.accountType).kept;
    return {
      status,
      id: target.id,
      ...(kept ? { warnings: [`account type "${kept}" kept (not changed to "${input.accountType}")`] } : {}),
    };
  }

  if (options.dryRun) {
    return { status: 'would_create' };
  }

  const created = await runPipedriveWrite(() =>
    pipedriveProvider.request<unknown>(connectionId, 'POST', 'organizations', buildOrgBody(config, input, null))
  );
  const createdOrg = parseOrg(created.data);
  if (!createdOrg) {
    throw new Error(`Pipedrive did not return the created organization "${input.name}"`);
  }
  return { status: 'created', id: createdOrg.id };
}

// ============================================
// PERSONS
// ============================================

function buildPersonBody(config: GdcResolvedConfig, input: PersonInput, existing: PersonRecord | null) {
  const body: Record<string, unknown> = {};
  if (!existing) {
    body.name = input.name.trim();
    if (input.email) {body.emails = [{ value: input.email.trim(), primary: true, label: 'work' }];}
    if (input.phone) {body.phones = [{ value: input.phone.trim(), primary: true, label: 'work' }];}
    if (input.ownerId) {body.owner_id = input.ownerId;}
  }
  if (input.orgId && (!existing || !existing.orgId)) {
    body.org_id = input.orgId;
  }
  if (input.role) {
    body.custom_fields = { [config.fields.person_role.code]: input.role.trim() };
  }
  return body;
}

/**
 * Find or create the Pipedrive person for a contact.
 */
export async function upsertPerson(
  connectionId: string,
  config: GdcResolvedConfig,
  input: PersonInput,
  options: { dryRun?: boolean } = {}
): Promise<MatchResult> {
  let target: PersonRecord | null = null;
  let status: MatchStatus = 'matched';

  if (input.existingPersonId) {
    target = await getPerson(connectionId, input.existingPersonId);
    if (target) {
      status = 'linked';
    }
  }

  const email = normalizeEmail(input.email);
  if (!target && email) {
    const candidates = (
      await Promise.all(
        (await searchIds(connectionId, 'persons', email, 'email')).map((id) => getPerson(connectionId, id))
      )
    ).filter((person): person is PersonRecord => person !== null && person.emails.includes(email));

    if (candidates.length > 1) {
      return { status: 'needs_review', reason: `${candidates.length} people use the email ${email}` };
    }
    target = candidates[0] ?? null;
  }

  // No email: never match by name alone; only within the same organization
  if (!target && !email && input.orgId) {
    const candidates = (
      await Promise.all(
        (await searchIds(connectionId, 'persons', input.name, 'name', { organization_id: String(input.orgId) })).map(
          (id) => getPerson(connectionId, id)
        )
      )
    ).filter(
      (person): person is PersonRecord =>
        person !== null && person.orgId === input.orgId && normalizeName(person.name) === normalizeName(input.name)
    );

    if (candidates.length > 1) {
      return {
        status: 'needs_review',
        reason: `${candidates.length} people named "${input.name}" in the same organization`,
      };
    }
    target = candidates[0] ?? null;
  }

  if (target && input.orgId && target.orgId && target.orgId !== input.orgId) {
    return {
      status: 'needs_review',
      id: target.id,
      reason: `person ${target.name} belongs to another organization`,
    };
  }

  if (target) {
    const body = buildPersonBody(config, input, target);
    if (!options.dryRun && Object.keys(body).length > 0) {
      await runPipedriveWrite(() =>
        pipedriveProvider.request<unknown>(connectionId, 'PATCH', `persons/${target!.id}`, body)
      );
    }
    return { status, id: target.id };
  }

  if (options.dryRun) {
    return { status: 'would_create' };
  }

  const created = await runPipedriveWrite(() =>
    pipedriveProvider.request<unknown>(connectionId, 'POST', 'persons', buildPersonBody(config, input, null))
  );
  const createdPerson = parsePerson(created.data);
  if (!createdPerson) {
    throw new Error(`Pipedrive did not return the created person "${input.name}"`);
  }
  return { status: 'created', id: createdPerson.id };
}
