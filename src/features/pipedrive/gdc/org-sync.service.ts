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
  /** Written as a phone labelled "mobile" */
  mobile?: string | null;
  role?: string | null;
  orgId?: number | null;
  ownerId?: number | null;
  existingPersonId?: number | null;
}

/** A Pipedrive email or phone entry */
export interface PersonChannel {
  value: string;
  label: string | null;
  primary: boolean;
}

/** Contact details of a Pipedrive person, as used by the two-way contact sync */
export interface PersonDetails {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  orgId: number | null;
  /** Primary email, else the first one */
  email: string | null;
  /** Primary phone not labelled "mobile", else the first such phone */
  phone: string | null;
  /** First phone labelled "mobile" */
  mobile: string | null;
  role: string | null;
}

/** Structured organization address (Pipedrive address components) */
export interface OrgAddress {
  street: string | null;
  city: string | null;
  state: string | null;
  county: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface OrgRecord {
  id: number;
  name: string;
  ownerId: number | null;
  /** Null when the organization has no structured address */
  address: OrgAddress | null;
  customFields: Record<string, unknown>;
}

interface PersonRecord {
  id: number;
  name: string;
  orgId: number | null;
  /** Normalized, for matching */
  emails: string[];
  emailList: PersonChannel[];
  phoneList: PersonChannel[];
  /** custom_fields (v2), or the whole record (v1 keeps custom fields at the top level) */
  customFields: Record<string, unknown>;
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

const text = (value: unknown): string | null => {
  const s = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  return s ? s : null;
};

/**
 * Structured address of an organization, from the API v2 / webhooks v2 shape
 * (address: { route, locality, ... }) or the v1 shape (address_route, ...).
 * Returns null when there are no components (no address, or free text only).
 */
export function parseOrgAddress(raw: unknown): OrgAddress | null {
  const r = raw as Record<string, unknown> | null;
  if (!r) {
    return null;
  }
  const nested = r.address && typeof r.address === 'object' ? (r.address as Record<string, unknown>) : null;
  const part = (key: string) => (nested ? text(nested[key]) : text(r[`address_${key}`]));

  const street = [part('street_number'), part('route')].filter(Boolean).join(' ') || null;
  const address: OrgAddress = {
    street,
    city: part('locality'),
    state: part('admin_area_level_1'),
    county: part('admin_area_level_2'),
    postalCode: part('postal_code'),
    country: part('country'),
  };
  return address.street || address.city || address.state || address.postalCode ? address : null;
}

/** Comparable form of an address part: case and spacing do not count as a change */
export const normalizeAddressPart = (value: string | null | undefined) =>
  (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const US_COUNTRY_NAMES = new Set(['us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america']);

/** "United States" / "USA" / "US" compare equal; ERP stores the code "US" */
export function normalizeCountry(value: string | null | undefined): string {
  const n = normalizeAddressPart(value);
  return US_COUNTRY_NAMES.has(n) ? 'us' : n;
}

function parseOrg(raw: unknown): OrgRecord | null {
  const r = raw as Record<string, unknown> | null;
  const id = toId(r?.id);
  if (!r || id === null || r.is_deleted === true) {
    return null;
  }
  return {
    id,
    name: String(r.name ?? ''),
    ownerId: toId(r.owner_id),
    address: parseOrgAddress(r),
    customFields: (r.custom_fields as Record<string, unknown>) ?? {},
  };
}

/** Emails / phones from v2 (emails, phones) or v1 (email, phone) */
function parseChannels(list: unknown): PersonChannel[] {
  return (Array.isArray(list) ? list : [])
    .map((entry) => {
      if (typeof entry === 'string') {
        return { value: entry.trim(), label: null, primary: false };
      }
      const e = entry as { value?: unknown; label?: unknown; primary?: unknown };
      return {
        value: text(e?.value) ?? '',
        label: text(e?.label)?.toLowerCase() ?? null,
        primary: e?.primary === true,
      };
    })
    .filter((channel) => channel.value !== '');
}

function parsePerson(raw: unknown): PersonRecord | null {
  const r = raw as Record<string, unknown> | null;
  const id = toId(r?.id);
  if (!r || id === null || r.is_deleted === true) {
    return null;
  }
  const emailList = parseChannels(r.emails ?? r.email);
  return {
    id,
    name: String(r.name ?? ''),
    orgId: toId(r.org_id),
    emails: emailList.map((e) => normalizeEmail(e.value)).filter(Boolean),
    emailList,
    phoneList: parseChannels(r.phones ?? r.phone),
    customFields: (r.custom_fields as Record<string, unknown> | undefined) ?? r,
  };
}

const isMobile = (channel: PersonChannel) => channel.label === 'mobile';
const primaryEmailOf = (list: PersonChannel[]) => (list.find((e) => e.primary) ?? list[0])?.value ?? null;
const workPhoneOf = (list: PersonChannel[]) => {
  const work = list.filter((p) => !isMobile(p));
  return (work.find((p) => p.primary) ?? work[0])?.value ?? null;
};
const mobilePhoneOf = (list: PersonChannel[]) => list.find(isMobile)?.value ?? null;

/** Phone numbers compare by digits only: "(402) 555-0100" = "402-555-0100" */
export const normalizePhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

/**
 * Contact details of a person (webhook or API record, v1 or v2 shape).
 */
export function parsePersonDetails(raw: unknown, roleFieldCode: string | null): PersonDetails | null {
  const person = parsePerson(raw);
  if (!person) {
    return null;
  }
  const r = raw as Record<string, unknown>;
  return {
    id: person.id,
    name: person.name.trim(),
    firstName: text(r.first_name),
    lastName: text(r.last_name),
    orgId: person.orgId,
    email: primaryEmailOf(person.emailList),
    phone: workPhoneOf(person.phoneList),
    mobile: mobilePhoneOf(person.phoneList),
    role: roleFieldCode ? text(person.customFields[roleFieldCode]) : null,
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

export async function getOrg(connectionId: string, id: number): Promise<OrgRecord | null> {
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

/**
 * True when the ERP address has something to write and differs from the
 * organization's address (no address, free text only, or another component).
 */
function addressDiffers(address: NonNullable<OrganizationInput['address']>, existing: OrgRecord | null): boolean {
  const hasErpAddress = [address.street, address.city, address.state, address.postalCode].some((part) => part?.trim());
  if (!hasErpAddress) {
    return false;
  }
  const current = existing?.address;
  if (!current) {
    return true;
  }
  return (
    normalizeAddressPart(address.street) !== normalizeAddressPart(current.street) ||
    normalizeAddressPart(address.city) !== normalizeAddressPart(current.city) ||
    normalizeAddressPart(address.state) !== normalizeAddressPart(current.state) ||
    normalizeAddressPart(address.postalCode) !== normalizeAddressPart(current.postalCode) ||
    normalizeCountry(address.country) !== normalizeCountry(current.country) ||
    // A county from the CSV import replaces the one in Pipedrive
    (Boolean(address.county) && normalizeAddressPart(address.county) !== normalizeAddressPart(current.county))
  );
}

function buildOrgBody(config: GdcResolvedConfig, input: OrganizationInput, existing: OrgRecord | null) {
  const body: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};

  // Two-way customer sync: the ERP name and address are written whenever they
  // differ, so the last change wins (Pipedrive edits reach the ERP through the
  // organization webhook). Unchanged values are not written, so a sync with
  // nothing new sends no update and triggers no webhook.
  const name = input.name.trim();
  if (!existing || (name && existing.name.trim() !== name)) {
    body.name = name;
  }

  const erpField = config.fields.org_erp_customer_id.code;
  if (input.erpCustomerId && existing?.customFields[erpField] !== input.erpCustomerId) {
    customFields[erpField] = input.erpCustomerId;
  }
  const accountType = accountTypeToWrite(config, existing, input.accountType).write;
  if (accountType) {
    const optionId = config.fields.org_account_type.options?.[accountType];
    if (optionId !== undefined) {
      customFields[config.fields.org_account_type.code] = optionId;
    }
  }

  // Address: written when it differs from Pipedrive. An empty ERP address never
  // clears a Pipedrive address, and the county (not stored in the ERP) is kept.
  const address = input.address;
  if (address && addressDiffers(address, existing)) {
    const county = address.county ?? existing?.address?.county ?? null;
    const parts = [address.street, address.city, address.state, address.postalCode, address.country]
      .map((part) => part?.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      body.address = {
        value: parts.join(', '),
        ...(address.street ? { route: address.street } : {}),
        ...(address.city ? { locality: address.city } : {}),
        ...(address.state ? { admin_area_level_1: address.state } : {}),
        ...(county ? { admin_area_level_2: county } : {}),
        ...(address.postalCode ? { postal_code: address.postalCode } : {}),
        ...(address.country ? { country: address.country } : {}),
      };
    }
  }
  // Owner (assigned rep) comes only from an explicit rep in the import CSV.
  // Every Pipedrive org already has an owner (its creator), so "only when
  // missing" would never apply: the given rep is written whenever it differs.
  if (input.ownerId && input.ownerId !== existing?.ownerId) {
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

/**
 * Customer mapping: mark an organization as the given ERP customer (ERP
 * Customer ID + account type "Current Customer", upgrade only). Name and
 * address are not touched. Returns false when the organization is gone.
 */
export async function markOrganizationAsCustomer(
  connectionId: string,
  config: GdcResolvedConfig,
  orgId: number,
  erpCustomerId: string
): Promise<boolean> {
  const org = await getOrg(connectionId, orgId);
  if (!org) {
    return false;
  }
  const customFields: Record<string, unknown> = {};
  const erpField = config.fields.org_erp_customer_id.code;
  if (org.customFields[erpField] !== erpCustomerId) {
    customFields[erpField] = erpCustomerId;
  }
  const accountType = accountTypeToWrite(config, org, 'Current Customer').write;
  const optionId = accountType ? config.fields.org_account_type.options?.[accountType] : undefined;
  if (optionId !== undefined) {
    customFields[config.fields.org_account_type.code] = optionId;
  }
  if (Object.keys(customFields).length > 0) {
    await runPipedriveWrite(() =>
      pipedriveProvider.request<unknown>(connectionId, 'PATCH', `organizations/${orgId}`, { custom_fields: customFields })
    );
  }
  return true;
}

// ============================================
// PERSONS
// ============================================

/**
 * Emails to write, or null when the person's primary email already matches.
 * The given email becomes the primary one and replaces the old primary; other
 * emails added in Pipedrive are kept.
 */
function emailsToWrite(email: string | null | undefined, existing: PersonRecord | null) {
  const value = email?.trim();
  if (!value) {
    return null;
  }
  const current = existing?.emailList ?? [];
  if (normalizeEmail(primaryEmailOf(current)) === normalizeEmail(value)) {
    return null;
  }
  const oldPrimary = normalizeEmail(primaryEmailOf(current));
  const others = current.filter((e) => {
    const n = normalizeEmail(e.value);
    return n !== oldPrimary && n !== normalizeEmail(value);
  });
  return [
    { value, primary: true, label: 'work' },
    ...others.map((e) => ({ value: e.value, primary: false, label: e.label ?? 'other' })),
  ];
}

/**
 * Phones to write, or null when the work phone and mobile already match.
 * The given phone replaces the work phone (primary), the mobile replaces the
 * "mobile" phone; other numbers added in Pipedrive are kept.
 */
function phonesToWrite(phone: string | null | undefined, mobile: string | null | undefined, existing: PersonRecord | null) {
  const work = phone?.trim() || null;
  const cell = mobile?.trim() || null;
  const current = existing?.phoneList ?? [];
  const oldWork = workPhoneOf(current);
  const oldMobile = mobilePhoneOf(current);
  const workChanged = Boolean(work) && normalizePhone(work) !== normalizePhone(oldWork);
  const mobileChanged = Boolean(cell) && normalizePhone(cell) !== normalizePhone(oldMobile);
  if (!workChanged && !mobileChanged) {
    return null;
  }

  const result: Array<{ value: string; primary: boolean; label: string }> = [];
  const finalWork = work ?? oldWork;
  const finalMobile = cell ?? oldMobile;
  if (finalWork) {result.push({ value: finalWork, primary: true, label: 'work' });}
  if (finalMobile) {result.push({ value: finalMobile, primary: !finalWork, label: 'mobile' });}
  const replaced = new Set([oldWork, oldMobile, finalWork, finalMobile].map(normalizePhone).filter(Boolean));
  for (const p of current) {
    if (!replaced.has(normalizePhone(p.value))) {
      result.push({ value: p.value, primary: false, label: p.label ?? 'other' });
    }
  }
  return result;
}

function buildPersonBody(config: GdcResolvedConfig, input: PersonInput, existing: PersonRecord | null) {
  const body: Record<string, unknown> = {};
  // Two-way contact sync: name, email, phones and role are written whenever
  // they differ (last change wins); unchanged values are not sent.
  const name = input.name.trim();
  if (!existing || (name && existing.name.trim() !== name)) {
    body.name = name;
  }
  const emails = emailsToWrite(input.email, existing);
  if (emails) {body.emails = emails;}
  const phones = phonesToWrite(input.phone, input.mobile, existing);
  if (phones) {body.phones = phones;}
  if (!existing && input.ownerId) {
    body.owner_id = input.ownerId;
  }
  if (input.orgId && (!existing || !existing.orgId)) {
    body.org_id = input.orgId;
  }
  const roleCode = config.fields.person_role.code;
  const currentRole = existing ? text(existing.customFields[roleCode]) : null;
  if (input.role && input.role.trim() !== currentRole) {
    body.custom_fields = { [roleCode]: input.role.trim() };
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
