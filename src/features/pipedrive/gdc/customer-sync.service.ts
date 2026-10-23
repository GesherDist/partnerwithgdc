/**
 * Gesher customers -> Pipedrive organizations and people.
 *
 * - syncCustomerToPipedrive: one ERP customer (organization + its contacts);
 *   also runs automatically when a customer is created or edited in the ERP
 * - applyOrganizationToCustomer / unlinkDeletedOrganization: Pipedrive -> ERP
 *   (organization webhook), so customer name and address sync both ways
 * - syncContactToPipedrive / applyPersonToContact / unlinkDeletedPerson: the
 *   same for contacts (ERP customer_contacts <-> Pipedrive persons)
 * - parseCustomerImportCsv / runCustomerImport: CSV import keyed by ERP Customer ID
 *
 * Both are safe to retry: matching follows org-sync.service, and the Gesher
 * customer stores the linked Pipedrive IDs. An existing link is never replaced.
 */

import { parse } from 'csv-parse/sync';
import { db } from '@/shared/lib/supabase/database';
import { customerRepository } from '@/features/customers/repositories/customer.repository';
import { customerService } from '@/features/customers/services/customer.service';
import { customerContactService } from '@/features/customers/services/customer-contact.service';
import type { CreateCustomerInput, UpdateCustomerContactInput, UpdateCustomerInput } from '@/features/customers/lib/schemas';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest } from '../lib/rate-limiter';
import { CONTACT_TYPE_LABELS, type ContactType, type Customer } from '@/features/customers/types';
import { GDC_ACCOUNT_TYPES, type GdcAccountType } from './config';
import { getGdcConfig } from './setup.service';
import { getActivePipedriveConnectionId, loadGdcConfig, type GdcResolvedConfig } from './settings';
import {
  getOrg,
  getPipedriveUsersByEmail,
  normalizeAddressPart,
  normalizeCountry,
  normalizeEmail,
  normalizePhone,
  parseOrgAddress,
  parsePersonDetails,
  upsertOrganization,
  type OrgRecord,
  type PersonDetails,
  upsertPerson,
  type MatchResult,
} from './org-sync.service';

// ============================================
// TYPES
// ============================================

export interface CustomerImportRow {
  rowNumber: number;
  erpCustomerId: string;
  accountType?: string;
  repEmail?: string;
  county?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface CustomerImportRowResult {
  rowNumber: number;
  erpCustomerId: string;
  organization?: MatchResult;
  person?: MatchResult;
  errors: string[];
  warnings: string[];
}

export interface CustomerImportSummary {
  dryRun: boolean;
  processed: number;
  /** Index of the next row to process, or null when finished */
  nextRow: number | null;
  totalRows: number;
  results: CustomerImportRowResult[];
}

/** Rows handled per call, keeping each server action well inside function time limits */
export const CUSTOMER_IMPORT_BATCH_SIZE = 50;

/** Accepted CSV headers (case/spacing-insensitive) */
const HEADER_ALIASES: Record<string, keyof Omit<CustomerImportRow, 'rowNumber'>> = {
  erp_customer_id: 'erpCustomerId',
  customer_id: 'erpCustomerId',
  customer_code: 'erpCustomerId',
  account_type: 'accountType',
  rep_email: 'repEmail',
  assigned_rep: 'repEmail',
  county: 'county',
  contact_name: 'contactName',
  contact_role: 'contactRole',
  role: 'contactRole',
  contact_email: 'contactEmail',
  email: 'contactEmail',
  contact_phone: 'contactPhone',
  phone: 'contactPhone',
};

// ============================================
// CSV PARSING
// ============================================

export function parseCustomerImportCsv(csvText: string): { rows: CustomerImportRow[]; errors: string[] } {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: (header: string[]) =>
        header.map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s/-]+/g, '_')] ?? `__ignored_${h}`),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch (error) {
    return { rows: [], errors: [`CSV could not be parsed: ${error instanceof Error ? error.message : 'invalid CSV'}`] };
  }

  const rows: CustomerImportRow[] = [];
  const errors: string[] = [];
  records.forEach((record, index) => {
    const rowNumber = index + 2; // header is row 1
    const erpCustomerId = (record.erpCustomerId ?? '').trim().toUpperCase();
    if (!erpCustomerId) {
      errors.push(`Row ${rowNumber}: ERP customer ID is required`);
      return;
    }
    rows.push({
      rowNumber,
      erpCustomerId,
      accountType: record.accountType || undefined,
      repEmail: record.repEmail || undefined,
      county: record.county || undefined,
      contactName: record.contactName || undefined,
      contactRole: record.contactRole || undefined,
      contactEmail: record.contactEmail || undefined,
      contactPhone: record.contactPhone || undefined,
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push('CSV has no data rows (expected a header row with an "erp_customer_id" column)');
  }
  return { rows, errors };
}

function resolveAccountType(value: string | undefined): GdcAccountType | null {
  if (!value) {
    return 'Current Customer';
  }
  return GDC_ACCOUNT_TYPES.find((type) => type.toLowerCase() === value.trim().toLowerCase()) ?? null;
}

// ============================================
// CUSTOMER LINKING
// ============================================

/**
 * Store Pipedrive IDs on a Gesher customer without replacing an existing link.
 * Returns a warning when the customer is already linked to a different record.
 *
 * `orgLinkDead`: the stored organization no longer exists in Pipedrive
 * (deleted or merged; upsertOrganization did not find it by its ID), so the
 * organization found or created instead replaces the link. A stored
 * organization that still exists is never replaced.
 */
async function linkCustomer(
  customer: Customer,
  ids: { orgId?: number; personId?: number },
  options: { orgLinkDead?: boolean } = {}
): Promise<string | null> {
  const updates: Record<string, number> = {};
  const warnings: string[] = [];
  let replacedOrgId: number | null = null;

  if (ids.orgId) {
    if (!customer.pipedriveOrgId) {
      updates.pipedrive_org_id = ids.orgId;
    } else if (customer.pipedriveOrgId !== ids.orgId) {
      if (options.orgLinkDead) {
        updates.pipedrive_org_id = ids.orgId;
        replacedOrgId = customer.pipedriveOrgId;
        warnings.push(`Pipedrive organization ${customer.pipedriveOrgId} no longer exists; customer relinked to organization ${ids.orgId}`);
      } else {
        warnings.push(`customer is linked to Pipedrive organization ${customer.pipedriveOrgId}, kept`);
      }
    }
  }
  if (ids.personId && !customer.pipedrivePersonId) {
    updates.pipedrive_person_id = ids.personId;
  }

  if (Object.keys(updates).length > 0) {
    // Conditional update (safe under concurrency): fill an empty link, or
    // replace the dead one only if it was not changed in the meantime
    let query = db.from('customers').update(updates).eq('id', customer.id);
    if (updates.pipedrive_org_id) {
      query = replacedOrgId ? query.eq('pipedrive_org_id', replacedOrgId) : query.is('pipedrive_org_id', null);
    }
    const { error } = await query;
    if (error) {
      throw new Error(`Failed to link customer ${customer.customerCode}: ${error.message}`);
    }
    if (updates.pipedrive_org_id) {
      publishPurchaseHistoryInBackground(customer.id);
    }
  }
  return warnings.length > 0 ? warnings.join('; ') : null;
}

/**
 * A customer newly linked (or relinked) to an organization gets its purchase
 * history note right away. Background, never throws.
 */
export function publishPurchaseHistoryInBackground(customerId: string): void {
  void (async () => {
    try {
      const { publishPurchaseHistory } = await import('./purchase-history.service');
      await publishPurchaseHistory(customerId);
    } catch (error) {
      console.error(`[PurchaseHistory] Publish after linking customer ${customerId} failed:`, error);
    }
  })();
}

function customerAddress(customer: Customer, county?: string) {
  return {
    street: [customer.address1, customer.address2].filter(Boolean).join(', ') || null,
    city: customer.city,
    state: customer.state,
    county: county ?? null, // Not stored in Gesher; only from the CSV
    postalCode: customer.zip,
    country: customer.country,
  };
}

// ============================================
// SYNC SNAPSHOT (migration 166)
// ============================================
// The values both systems agreed on at the last sync, normalized. The
// "Sync with Pipedrive" button compares each side with it to see which side
// changed a field (two-way-sync.service). Every successful sync stores it.

export type SyncSnapshot = Record<string, string>;

export const CUSTOMER_SYNC_COLUMNS = 'id, customer_code, name, address_1, address_2, city, state, zip, country';

export interface CustomerSyncRow {
  id: string;
  customer_code: string;
  name: string;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

/** Customer fields shared with the organization, normalized for comparison */
export function customerSyncValues(row: Omit<CustomerSyncRow, 'id' | 'customer_code'>): SyncSnapshot {
  return {
    name: normalizeAddressPart(row.name),
    street: normalizeAddressPart([row.address_1, row.address_2].filter(Boolean).join(', ')),
    city: normalizeAddressPart(row.city),
    state: normalizeAddressPart(row.state),
    zip: normalizeAddressPart(row.zip),
    country: normalizeCountry(row.country),
  };
}

/** Contact fields shared with the person, normalized for comparison */
export function contactSyncValues(row: Pick<ContactRow, 'first_name' | 'last_name' | 'email' | 'phone' | 'mobile' | 'contact_type'>): SyncSnapshot {
  return {
    name: normalizeAddressPart(contactName(row)),
    email: normalizeEmail(row.email),
    phone: normalizePhone(row.phone),
    mobile: normalizePhone(row.mobile),
    type: row.contact_type ?? '',
  };
}

/** Store the customer's current values as the agreed state. Never throws. */
export async function saveCustomerSnapshot(customerId: string): Promise<void> {
  try {
    const { data, error } = await db.from('customers').select(CUSTOMER_SYNC_COLUMNS).eq('id', customerId).maybeSingle();
    if (error || !data) {
      throw new Error(error?.message ?? 'customer not found');
    }
    const { error: saveError } = await db
      .from('customers')
      .update({ pipedrive_sync_snapshot: customerSyncValues(data as CustomerSyncRow), pipedrive_synced_at: new Date().toISOString() })
      .eq('id', customerId);
    if (saveError) {
      throw new Error(saveError.message);
    }
  } catch (error) {
    console.error(`[Pipedrive] Failed to save the sync snapshot of customer ${customerId}:`, error);
  }
}

/** Store the contact's current values as the agreed state. Never throws. */
export async function saveContactSnapshot(contactId: string): Promise<void> {
  try {
    const { data, error } = await db.from('customer_contacts').select(CONTACT_COLUMNS).eq('id', contactId).maybeSingle();
    if (error || !data) {
      throw new Error(error?.message ?? 'contact not found');
    }
    const { error: saveError } = await db
      .from('customer_contacts')
      .update({ pipedrive_sync_snapshot: contactSyncValues(data as ContactRow) })
      .eq('id', contactId);
    if (saveError) {
      throw new Error(saveError.message);
    }
  } catch (error) {
    console.error(`[Pipedrive] Failed to save the sync snapshot of contact ${contactId}:`, error);
  }
}

// ============================================
// CONTACTS (ERP -> Pipedrive)
// ============================================

export const CONTACT_COLUMNS = 'id, customer_id, first_name, last_name, contact_type, email, phone, mobile, pipedrive_person_id, deleted_at';

export interface ContactRow {
  id: string;
  customer_id: string;
  first_name: string | null;
  last_name: string | null;
  contact_type: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  pipedrive_person_id: number | null;
  deleted_at: string | null;
}

/** "-" stands in for a missing last name (ERP requires one); it is not a real name */
const NO_LAST_NAME = '-';

export function contactName(contact: Pick<ContactRow, 'first_name' | 'last_name'>): string {
  const last = contact.last_name?.trim() === NO_LAST_NAME ? '' : contact.last_name;
  return `${contact.first_name ?? ''} ${last ?? ''}`.trim();
}

/**
 * Create or update the Pipedrive person of one ERP contact and store the link
 * on the contact. Returns null when the contact has no name.
 */
export async function pushContact(
  connectionId: string,
  config: GdcResolvedConfig,
  contact: ContactRow,
  orgId: number,
  dryRun?: boolean
): Promise<{ name: string; result: MatchResult } | null> {
  const name = contactName(contact);
  if (!name) {
    return null;
  }
  const result = await upsertPerson(
    connectionId,
    config,
    {
      name,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,
      // Pipedrive "Role" = the contact type label shown in Gesher (e.g. "Purchasing")
      role: CONTACT_TYPE_LABELS[contact.contact_type as ContactType] ?? null,
      orgId,
      existingPersonId: contact.pipedrive_person_id,
    },
    { dryRun }
  );
  if (!dryRun && result.id && result.status !== 'needs_review') {
    if (result.id !== contact.pipedrive_person_id) {
      const { error } = await db.from('customer_contacts').update({ pipedrive_person_id: result.id }).eq('id', contact.id);
      if (error) {
        throw new Error(`Failed to link contact ${name}: ${error.message}`);
      }
    }
    await saveContactSnapshot(contact.id);
  }
  return { name, result };
}

/**
 * Push one ERP contact to Pipedrive (runs after a contact is created or
 * edited). The customer's organization is created first when it is missing.
 */
export async function syncContactToPipedrive(contactId: string): Promise<MatchResult | null> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    return null;
  }
  const { data, error } = await db.from('customer_contacts').select(CONTACT_COLUMNS).eq('id', contactId).maybeSingle();
  if (error) {
    throw new Error(`Failed to load contact ${contactId}: ${error.message}`);
  }
  const contact = data as ContactRow | null;
  if (!contact || contact.deleted_at) {
    return null;
  }

  const customer = await customerRepository.findById(contact.customer_id);
  if (!customer) {
    return null;
  }
  let orgId = customer.pipedriveOrgId;
  if (!orgId) {
    const synced = await syncCustomerToPipedrive(customer.id, { includeContacts: false });
    if (!synced.organization.id || synced.organization.status === 'needs_review') {
      return { status: 'needs_review', reason: synced.organization.reason ?? 'customer organization not available' };
    }
    orgId = synced.organization.id;
  }

  const config = await getGdcConfig(connectionId);
  const pushed = await pushContact(connectionId, config, contact, orgId);
  if (pushed?.result.id && pushed.result.status !== 'needs_review') {
    await linkCustomer(customer, { personId: pushed.result.id });
  }
  return pushed?.result ?? null;
}

// ============================================
// SINGLE CUSTOMER SYNC
// ============================================

export interface CustomerSyncResult {
  organization: MatchResult;
  people: Array<{ contact: string; result: MatchResult }>;
  warnings: string[];
}

/**
 * Push one Gesher customer and its contacts to Pipedrive as a "Current Customer".
 */
export async function syncCustomerToPipedrive(
  customerId: string,
  options: { dryRun?: boolean; accountType?: GdcAccountType; includeContacts?: boolean } = {}
): Promise<CustomerSyncResult> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    throw new Error('Pipedrive is not connected');
  }
  const config = await getGdcConfig(connectionId);

  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const warnings: string[] = [];
  const organization = await upsertOrganization(
    connectionId,
    config,
    {
      name: customer.name,
      erpCustomerId: customer.customerCode,
      accountType: options.accountType ?? 'Current Customer',
      address: customerAddress(customer),
      existingOrgId: customer.pipedriveOrgId,
    },
    { dryRun: options.dryRun }
  );

  // County and assigned rep are not stored in the ERP: they come from the CSV import or Pipedrive
  warnings.push(...(organization.warnings ?? []));
  const people: CustomerSyncResult['people'] = [];
  if (organization.id && organization.status !== 'needs_review') {
    // Save the organization link right away, so a later failure (contacts)
    // cannot leave an organization in Pipedrive that Gesher does not know about
    if (!options.dryRun) {
      // A stored link that upsertOrganization could not open ('linked') is dead
      const orgLinkDead = Boolean(customer.pipedriveOrgId) && organization.status !== 'linked';
      const warning = await linkCustomer(customer, { orgId: organization.id }, { orgLinkDead });
      if (warning) {warnings.push(warning);}
      await saveCustomerSnapshot(customer.id);
    }
    if (options.includeContacts === false) {
      return { organization, people, warnings };
    }

    const { data: contacts, error } = await db
      .from('customer_contacts')
      .select(CONTACT_COLUMNS)
      .eq('customer_id', customer.id)
      .is('deleted_at', null);
    if (error) {
      throw new Error(`Failed to load contacts: ${error.message}`);
    }

    let firstPersonId: number | undefined;
    for (const contact of (contacts ?? []) as ContactRow[]) {
      const pushed = await pushContact(connectionId, config, contact, organization.id, options.dryRun);
      if (!pushed) {continue;}
      people.push({ contact: pushed.name, result: pushed.result });
      firstPersonId ??= pushed.result.status !== 'needs_review' ? pushed.result.id : undefined;
    }

    if (!options.dryRun && firstPersonId) {
      await linkCustomer(customer, { personId: firstPersonId });
    }
  }

  return { organization, people, warnings };
}

// ============================================
// PIPEDRIVE -> ERP (organization webhook)
// ============================================

export interface OrganizationToCustomerResult {
  status: 'updated' | 'unchanged' | 'not_linked' | 'needs_review' | 'unlinked' | 'failed';
  message: string;
  customerId?: string;
}

interface LinkedCustomerRow {
  id: string;
  customer_code: string;
  name: string;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

async function findCustomersByOrg(orgId: number): Promise<LinkedCustomerRow[]> {
  const { data, error } = await db
    .from('customers')
    .select('id, customer_code, name, address_1, address_2, city, state, zip, country')
    .eq('pipedrive_org_id', orgId)
    .is('deleted_at', null);
  if (error) {
    throw new Error(`Failed to load the customer for organization ${orgId}: ${error.message}`);
  }
  return (data ?? []) as LinkedCustomerRow[];
}

/**
 * Copy a Pipedrive organization's name and address to its linked ERP customer.
 *
 * - Only organizations already linked to an ERP customer are synced; a new
 *   organization (lead / prospect) never creates an ERP customer.
 * - Only values Pipedrive has are written: a missing address part never clears
 *   the ERP. County has no ERP field and is not copied.
 * - The update goes through the customer service (validation, audit log,
 *   QuickBooks sync) without pushing back to Pipedrive.
 */
export async function applyOrganizationToCustomer(org: unknown): Promise<OrganizationToCustomerResult> {
  const raw = org as Record<string, unknown> | null;
  const orgId = Number(raw?.id);
  if (!raw || !Number.isInteger(orgId) || orgId <= 0) {
    return { status: 'failed', message: 'No organization id in the payload' };
  }

  const customers = await findCustomersByOrg(orgId);
  if (customers.length === 0) {
    return { status: 'not_linked', message: `Organization ${orgId} is not linked to an ERP customer` };
  }
  if (customers.length > 1) {
    return {
      status: 'needs_review',
      message: `Organization ${orgId} is linked to ${customers.length} ERP customers (${customers.map((c) => c.customer_code).join(', ')}); not updated`,
    };
  }
  const customer = customers[0]!;

  const updates: UpdateCustomerInput = {};
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name && name !== customer.name.trim()) {
    updates.name = name;
  }

  const address = parseOrgAddress(raw);
  if (address) {
    const erpStreet = [customer.address_1, customer.address_2].filter(Boolean).join(', ');
    if (address.street && normalizeAddressPart(address.street) !== normalizeAddressPart(erpStreet)) {
      // Pipedrive has one street line; the ERP's second line is folded into it on push
      updates.address1 = address.street;
      updates.address2 = null;
    }
    if (address.city && normalizeAddressPart(address.city) !== normalizeAddressPart(customer.city)) {
      updates.city = address.city;
    }
    if (address.state && normalizeAddressPart(address.state) !== normalizeAddressPart(customer.state)) {
      updates.state = address.state;
    }
    if (address.postalCode && normalizeAddressPart(address.postalCode) !== normalizeAddressPart(customer.zip)) {
      updates.zip = address.postalCode;
    }
    if (address.country && normalizeCountry(address.country) !== normalizeCountry(customer.country)) {
      updates.country = normalizeCountry(address.country) === 'us' ? 'US' : address.country;
    }
  }

  const changed = Object.keys(updates);
  if (changed.length === 0) {
    await saveCustomerSnapshot(customer.id);
    return { status: 'unchanged', message: `Customer ${customer.customer_code} already matches`, customerId: customer.id };
  }

  const result = await customerService.update(customer.id, updates, undefined, { skipPipedriveSync: true });
  if (!result.success) {
    const details = result.errors ? `: ${JSON.stringify(result.errors)}` : '';
    return {
      status: 'failed',
      message: `Customer ${customer.customer_code} not updated (${result.error ?? 'unknown error'}${details})`,
      customerId: customer.id,
    };
  }
  await saveCustomerSnapshot(customer.id);
  return {
    status: 'updated',
    message: `Customer ${customer.customer_code} updated from Pipedrive: ${changed.join(', ')}`,
    customerId: customer.id,
  };
}

/**
 * An organization deleted in Pipedrive: the ERP customer is kept and only its
 * Pipedrive link is removed, so a later "Sync to Pipedrive" can link it again.
 */
export async function unlinkDeletedOrganization(orgId: number): Promise<OrganizationToCustomerResult> {
  const customers = await findCustomersByOrg(orgId);
  if (customers.length === 0) {
    return { status: 'not_linked', message: `Organization ${orgId} is not linked to an ERP customer` };
  }
  const { error } = await db
    .from('customers')
    .update({ pipedrive_org_id: null })
    .eq('pipedrive_org_id', orgId)
    .is('deleted_at', null);
  if (error) {
    throw new Error(`Failed to unlink organization ${orgId}: ${error.message}`);
  }
  return {
    status: 'unlinked',
    message: `Organization ${orgId} deleted in Pipedrive; link removed from ${customers.map((c) => c.customer_code).join(', ')}`,
    customerId: customers.length === 1 ? customers[0]!.id : undefined,
  };
}

// ============================================
// PIPEDRIVE -> ERP (won deal on a new organization)
// ============================================

export interface CustomerFromOrganizationResult {
  status: 'created' | 'linked' | 'already_linked' | 'needs_review' | 'not_found' | 'failed';
  message: string;
  customerId?: string;
  customerCode?: string;
}

/** Customer fields from the organization, within the ERP column limits */
function customerInputFromOrganization(org: OrgRecord, customerCode: string, orgId: number): CreateCustomerInput {
  const address = org.address;
  const country = address?.country
    ? normalizeCountry(address.country) === 'us' ? 'US' : address.country.slice(0, 50)
    : 'US';
  return {
    customerCode,
    name: org.name.trim().slice(0, 255),
    channel: 'dealer',
    address1: address?.street?.slice(0, 200) ?? null,
    city: address?.city?.slice(0, 100) ?? null,
    state: address?.state?.slice(0, 50) ?? null,
    zip: address?.postalCode?.slice(0, 20) ?? null,
    country,
    shippingCountry: 'US',
    useSeparateShipping: false,
    taxExempt: false,
    // New account: the quote approval runs the credit check
    creditStatus: 'pending',
    creditLimit: 0,
    openBalance: 0,
    status: 'active',
    internalNotes: `Created from Pipedrive organization ${orgId} when a deal was marked Won.`,
  };
}

/** Link an ERP customer to the organization, then align both sides and import its people */
async function linkCustomerToOrganization(customerId: string, orgId: number, previousOrgId: number | null): Promise<void> {
  let query = db.from('customers').update({ pipedrive_org_id: orgId }).eq('id', customerId);
  query = previousOrgId ? query.eq('pipedrive_org_id', previousOrgId) : query.is('pipedrive_org_id', null);
  const { error } = await query;
  if (error) {
    throw new Error(`Failed to link the customer to organization ${orgId}: ${error.message}`);
  }
  publishPurchaseHistoryInBackground(customerId);
  // ERP Customer ID + "Current Customer" on the organization, and the snapshot
  await syncCustomerToPipedrive(customerId, { includeContacts: false });
}

/** The organization's people become (or are linked to) ERP contacts */
async function importOrganizationPeople(connectionId: string, orgId: number): Promise<string[]> {
  const warnings: string[] = [];
  const people = await pipedriveProvider.fetchAllV2<unknown>(
    connectionId,
    'persons',
    new URLSearchParams({ org_id: String(orgId) }),
    runPipedriveRequest
  );
  for (const person of people.items) {
    const result = await applyPersonToContact(person);
    if (result.status === 'failed') {warnings.push(result.message);}
  }
  return warnings;
}

/**
 * Candidate ERP customers whose email, or one of whose contacts' emails, is
 * used by a person of the organization.
 */
async function matchCustomersByPeopleEmails(connectionId: string, orgId: number, customerIds: string[]): Promise<string[]> {
  const people = await pipedriveProvider.fetchAllV2<unknown>(
    connectionId,
    'persons',
    new URLSearchParams({ org_id: String(orgId) }),
    runPipedriveRequest
  );
  const orgEmails = new Set<string>();
  for (const raw of people.items) {
    const emails = (raw as { emails?: unknown; email?: unknown }).emails ?? (raw as { email?: unknown }).email;
    for (const entry of Array.isArray(emails) ? emails : []) {
      const value = normalizeEmail(typeof entry === 'string' ? entry : (entry as { value?: string })?.value);
      if (value) {orgEmails.add(value);}
    }
  }
  if (orgEmails.size === 0) {
    return [];
  }

  const [{ data: customers, error }, { data: contacts, error: contactError }] = await Promise.all([
    db.from('customers').select('id, email').in('id', customerIds),
    db.from('customer_contacts').select('customer_id, email').in('customer_id', customerIds).is('deleted_at', null),
  ]);
  if (error || contactError) {
    throw new Error(`Failed to load customer emails: ${(error ?? contactError)!.message}`);
  }
  const matched = new Set<string>();
  for (const row of customers ?? []) {
    if (orgEmails.has(normalizeEmail(row.email as string | null))) {matched.add(row.id as string);}
  }
  for (const row of contacts ?? []) {
    if (orgEmails.has(normalizeEmail(row.email as string | null))) {matched.add(row.customer_id as string);}
  }
  return [...matched];
}

/**
 * A deal was won on an organization with no ERP customer: the organization
 * becomes an ERP customer, so the won deal can reach the ERP as a quote.
 *
 * - An ERP customer with the organization's ERP Customer ID, or else the same
 *   name, is linked instead of creating a duplicate (unless it is linked to
 *   another organization that still exists). Several customers with the same
 *   name: the one sharing an email with the organization's people; if none or
 *   several do, nothing is created (needs review).
 * - Otherwise a new customer is created: next CUST- code, Dealer channel,
 *   Active, credit "pending" (the quote approval runs the credit check).
 * - The organization's people become ERP contacts.
 */
export async function createCustomerFromOrganization(orgId: number): Promise<CustomerFromOrganizationResult> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    return { status: 'failed', message: 'Pipedrive is not connected' };
  }
  const config = await getGdcConfig(connectionId);

  const linked = await findCustomersByOrg(orgId);
  if (linked.length === 1) {
    return { status: 'already_linked', message: `Organization ${orgId} is already linked`, customerId: linked[0]!.id, customerCode: linked[0]!.customer_code };
  }
  if (linked.length > 1) {
    return { status: 'needs_review', message: `Organization ${orgId} is linked to ${linked.length} ERP customers` };
  }

  const org = await getOrg(connectionId, orgId);
  if (!org) {
    return { status: 'not_found', message: `Organization ${orgId} was not found in Pipedrive` };
  }
  const name = org.name.trim();
  if (!name) {
    return { status: 'failed', message: `Organization ${orgId} has no name` };
  }

  // 1. Already in the ERP? By the ERP Customer ID on the organization, then by name
  const erpIdValue = org.customFields[config.fields.org_erp_customer_id.code];
  const erpId = typeof erpIdValue === 'string' ? erpIdValue.trim() : '';
  let matches: Array<{ id: string; customer_code: string; pipedrive_org_id: number | null }> = [];
  if (erpId) {
    const byCode = await customerRepository.findByCode(erpId);
    if (byCode) {
      matches = [{ id: byCode.id, customer_code: byCode.customerCode, pipedrive_org_id: byCode.pipedriveOrgId }];
    }
  }
  if (matches.length === 0) {
    const { data, error } = await db
      .from('customers')
      .select('id, customer_code, pipedrive_org_id')
      // Case-insensitive exact match: escape LIKE wildcards
      .ilike('name', name.replace(/[\\%_]/g, '\\$&'))
      .is('deleted_at', null);
    if (error) {
      throw new Error(`Failed to look up customer "${name}": ${error.message}`);
    }
    matches = (data ?? []) as typeof matches;
  }
  if (matches.length > 1) {
    // Same name: the one whose email (customer or contact) is used by a person of the organization
    const byEmail = await matchCustomersByPeopleEmails(connectionId, orgId, matches.map((m) => m.id));
    const picked = matches.filter((m) => byEmail.includes(m.id));
    if (picked.length !== 1) {
      return {
        status: 'needs_review',
        message: `${matches.length} ERP customers are named "${name}" (${matches.map((m) => m.customer_code).join(', ')}) and ${
          picked.length === 0 ? 'none shares an email' : 'several share emails'
        } with the organization's people; link one to the organization`,
      };
    }
    matches = picked;
  }

  if (matches.length === 1) {
    const match = matches[0]!;
    if (match.pipedrive_org_id && match.pipedrive_org_id !== orgId && (await getOrg(connectionId, match.pipedrive_org_id))) {
      return {
        status: 'needs_review',
        message: `ERP customer ${match.customer_code} matches this organization but is linked to Pipedrive organization ${match.pipedrive_org_id}`,
      };
    }
    await linkCustomerToOrganization(match.id, orgId, match.pipedrive_org_id);
    const warnings = await importOrganizationPeople(connectionId, orgId);
    return {
      status: 'linked',
      message: [`Existing ERP customer ${match.customer_code} linked to the organization`, ...warnings].join('; '),
      customerId: match.id,
      customerCode: match.customer_code,
    };
  }

  // 2. New ERP customer (retry once if another run took the same code)
  let created: Awaited<ReturnType<typeof customerService.create>> | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = await customerRepository.getNextCustomerCode();
    created = await customerService.create(customerInputFromOrganization(org, code, orgId), undefined, { skipPipedriveSync: true });
    if (created.success || !created.errors?.customerCode) {
      break;
    }
  }
  if (!created?.success || !created.data) {
    const errors = created?.errors ? `: ${JSON.stringify(created.errors)}` : '';
    return { status: 'failed', message: `ERP customer not created (${created?.error ?? 'unknown error'}${errors})` };
  }
  const customer = created.data;
  await linkCustomerToOrganization(customer.id, orgId, null);
  const warnings = await importOrganizationPeople(connectionId, orgId);
  return {
    status: 'created',
    message: [`ERP customer ${customer.customerCode} created from the organization`, ...warnings].join('; '),
    customerId: customer.id,
    customerCode: customer.customerCode,
  };
}

// ============================================
// PIPEDRIVE -> ERP (person webhook)
// ============================================

export interface PersonToContactResult {
  status: 'created' | 'updated' | 'linked' | 'unchanged' | 'not_linked' | 'skipped' | 'unlinked' | 'failed';
  message: string;
  contactId?: string;
}

/** Contact types the ERP accepts (contact_type enum) */
const ERP_CONTACT_TYPES = ['purchasing', 'accounts_payable', 'receiving'] as const;
type ErpContactType = (typeof ERP_CONTACT_TYPES)[number];

/** Pipedrive Role -> ERP contact type, by label ("Accounts Payable") or key; null when unknown */
export function contactTypeFromRole(role: string | null): ErpContactType | null {
  const n = role?.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (!n) {
    return null;
  }
  return (
    ERP_CONTACT_TYPES.find(
      (type) => type.replace(/_/g, ' ') === n || CONTACT_TYPE_LABELS[type].toLowerCase() === n
    ) ?? null
  );
}

/** ERP first / last name of a person; a single name gets "-" as last name */
export function splitPersonName(details: PersonDetails): { firstName: string; lastName: string } | null {
  let first = details.firstName;
  let last = details.lastName;
  if (!first && !last) {
    const parts = details.name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]!;
    last = parts.length > 1 ? parts[parts.length - 1]! : null;
  }
  return {
    firstName: (first ?? last ?? '').slice(0, 100),
    lastName: (first ? last ?? NO_LAST_NAME : NO_LAST_NAME).slice(0, 100),
  };
}

/** Fields of the ERP contact that differ from the person; values Pipedrive lacks never clear the ERP */
function contactUpdatesFrom(details: PersonDetails, contact: ContactRow): UpdateCustomerContactInput {
  const updates: UpdateCustomerContactInput = {};
  const names = splitPersonName(details);
  if (names && contactName(contact) !== contactName({ first_name: names.firstName, last_name: names.lastName })) {
    updates.firstName = names.firstName;
    updates.lastName = names.lastName;
  }
  if (details.email && normalizeEmail(details.email) !== normalizeEmail(contact.email)) {
    updates.email = details.email;
  }
  if (details.phone && normalizePhone(details.phone) !== normalizePhone(contact.phone)) {
    updates.phone = details.phone;
  }
  if (details.mobile && normalizePhone(details.mobile) !== normalizePhone(contact.mobile)) {
    updates.mobile = details.mobile;
  }
  const type = contactTypeFromRole(details.role);
  if (type && type !== contact.contact_type) {
    updates.contactType = type;
  }
  return updates;
}

async function updateContactFromPerson(
  contact: ContactRow,
  details: PersonDetails,
  linked: boolean
): Promise<PersonToContactResult> {
  const updates = contactUpdatesFrom(details, contact);
  const changed = Object.keys(updates);
  if (changed.length === 0) {
    await saveContactSnapshot(contact.id);
    return linked
      ? { status: 'linked', message: `Contact ${contactName(contact)} linked to person ${details.id}`, contactId: contact.id }
      : { status: 'unchanged', message: `Contact ${contactName(contact)} already matches`, contactId: contact.id };
  }
  const result = await customerContactService.update(contact.id, updates, undefined, { skipPipedriveSync: true });
  if (!result.success) {
    const errors = result.errors ? `: ${JSON.stringify(result.errors)}` : '';
    return { status: 'failed', message: `Contact ${contactName(contact)} not updated (${result.error ?? 'unknown error'}${errors})`, contactId: contact.id };
  }
  await saveContactSnapshot(contact.id);
  return {
    status: 'updated',
    message: `Contact ${contactName(contact)} ${linked ? 'linked and ' : ''}updated from Pipedrive: ${changed.join(', ')}`,
    contactId: contact.id,
  };
}

/**
 * Copy a Pipedrive person (added or edited) to the ERP contact.
 *
 * 1. Person already linked to a contact: the contact is updated. A contact
 *    deleted in the ERP stays deleted.
 * 2. Not linked, and its organization is linked to one ERP customer: a contact
 *    of that customer with the same email is linked and updated; otherwise a
 *    new contact is created (contact type from the Role, else Purchasing).
 * 3. Person without an ERP-linked organization: ignored.
 * Updates go through the contact service (validation) without pushing back.
 */
export async function applyPersonToContact(person: unknown): Promise<PersonToContactResult> {
  const connectionId = await getActivePipedriveConnectionId();
  const config = connectionId ? await loadGdcConfig(connectionId) : null;
  const details = parsePersonDetails(person, config?.fields.person_role.code ?? null);
  if (!details) {
    return { status: 'failed', message: 'No person id in the payload' };
  }

  const { data: linkedRows, error: linkedError } = await db
    .from('customer_contacts')
    .select(CONTACT_COLUMNS)
    .eq('pipedrive_person_id', details.id);
  if (linkedError) {
    throw new Error(`Failed to load the contact of person ${details.id}: ${linkedError.message}`);
  }
  const linked = (linkedRows ?? []) as ContactRow[];
  const active = linked.filter((row) => !row.deleted_at);
  if (active.length > 1) {
    return { status: 'skipped', message: `Person ${details.id} is linked to ${active.length} ERP contacts; not updated` };
  }
  if (active.length === 1) {
    return updateContactFromPerson(active[0]!, details, false);
  }
  if (linked.length > 0) {
    return { status: 'skipped', message: `Contact of person ${details.id} was deleted in the ERP; not re-created` };
  }

  if (!details.orgId) {
    return { status: 'not_linked', message: `Person ${details.id} has no organization` };
  }
  const customers = await findCustomersByOrg(details.orgId);
  if (customers.length !== 1) {
    return {
      status: 'not_linked',
      message: customers.length === 0
        ? `Organization ${details.orgId} is not linked to an ERP customer`
        : `Organization ${details.orgId} is linked to ${customers.length} ERP customers; contact not created`,
    };
  }
  const customer = customers[0]!;

  // Same email in this customer (e.g. a contact created before links existed)
  if (details.email) {
    const { data: sameEmail, error } = await db
      .from('customer_contacts')
      .select(CONTACT_COLUMNS)
      .eq('customer_id', customer.id)
      // Case-insensitive exact match: escape LIKE wildcards ("_" is common in emails)
      .ilike('email', details.email.trim().replace(/[\\%_]/g, '\\$&'))
      .is('pipedrive_person_id', null)
      .is('deleted_at', null);
    if (error) {
      throw new Error(`Failed to match contact by email: ${error.message}`);
    }
    if (sameEmail && sameEmail.length === 1) {
      const contact = sameEmail[0] as ContactRow;
      const { error: linkError } = await db
        .from('customer_contacts')
        .update({ pipedrive_person_id: details.id })
        .eq('id', contact.id)
        .is('pipedrive_person_id', null);
      if (linkError) {
        throw new Error(`Failed to link contact: ${linkError.message}`);
      }
      return updateContactFromPerson(contact, details, true);
    }
  }

  return createContactFromPerson(customer, details);
}

/**
 * New ERP contact for a Pipedrive person of the customer's organization,
 * linked to the person (contact type from the Role, else Purchasing).
 */
export async function createContactFromPerson(
  customer: { id: string; customer_code: string },
  details: PersonDetails
): Promise<PersonToContactResult> {
  const names = splitPersonName(details);
  if (!names) {
    return { status: 'skipped', message: `Person ${details.id} has no name; contact not created` };
  }
  const created = await customerContactService.create(
    {
      customerId: customer.id,
      firstName: names.firstName,
      lastName: names.lastName,
      contactType: contactTypeFromRole(details.role) ?? 'purchasing',
      email: details.email,
      phone: details.phone,
      mobile: details.mobile,
    },
    undefined,
    { skipPipedriveSync: true }
  );
  if (!created.success || !created.data) {
    const errors = created.errors ? `: ${JSON.stringify(created.errors)}` : '';
    return { status: 'failed', message: `Contact for person ${details.id} not created (${created.error ?? 'unknown error'}${errors})` };
  }
  const { error: linkError } = await db
    .from('customer_contacts')
    .update({ pipedrive_person_id: details.id })
    .eq('id', created.data.id);
  if (linkError) {
    throw new Error(`Failed to link the new contact: ${linkError.message}`);
  }
  await saveContactSnapshot(created.data.id);
  return {
    status: 'created',
    message: `Contact ${contactName({ first_name: names.firstName, last_name: names.lastName })} created for ${customer.customer_code} from Pipedrive`,
    contactId: created.data.id,
  };
}

/**
 * A person deleted in Pipedrive: the ERP contact is kept and only its link is
 * removed (also the customer's main person link).
 */
export async function unlinkDeletedPerson(personId: number): Promise<PersonToContactResult> {
  const { data, error } = await db
    .from('customer_contacts')
    .update({ pipedrive_person_id: null })
    .eq('pipedrive_person_id', personId)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    throw new Error(`Failed to unlink person ${personId}: ${error.message}`);
  }
  const { error: customerError } = await db
    .from('customers')
    .update({ pipedrive_person_id: null })
    .eq('pipedrive_person_id', personId);
  if (customerError) {
    throw new Error(`Failed to unlink person ${personId} from its customer: ${customerError.message}`);
  }
  const count = data?.length ?? 0;
  return count > 0
    ? { status: 'unlinked', message: `Person ${personId} deleted in Pipedrive; link removed from ${count} contact(s)`, contactId: count === 1 ? data![0]!.id : undefined }
    : { status: 'not_linked', message: `Person ${personId} is not linked to an ERP contact` };
}

// ============================================
// CSV IMPORT
// ============================================

/**
 * Import a batch of CSV rows (starting at `startRow`). Call again with the
 * returned `nextRow` until it is null. Re-running the same file is safe.
 */
export async function runCustomerImport(
  rows: CustomerImportRow[],
  options: { dryRun?: boolean; startRow?: number; batchSize?: number } = {}
): Promise<CustomerImportSummary> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    throw new Error('Pipedrive is not connected');
  }
  const config: GdcResolvedConfig = await getGdcConfig(connectionId);
  const usersByEmail = await getPipedriveUsersByEmail(connectionId);

  const start = options.startRow ?? 0;
  const batch = rows.slice(start, start + (options.batchSize ?? CUSTOMER_IMPORT_BATCH_SIZE));
  const results: CustomerImportRowResult[] = [];

  // Rows for the same ERP customer share one organization result
  const orgCache = new Map<string, MatchResult>();

  for (const row of batch) {
    const result: CustomerImportRowResult = {
      rowNumber: row.rowNumber,
      erpCustomerId: row.erpCustomerId,
      errors: [],
      warnings: [],
    };
    results.push(result);

    try {
      const accountType = resolveAccountType(row.accountType);
      if (!accountType) {
        result.errors.push(`account type "${row.accountType}" must be one of ${GDC_ACCOUNT_TYPES.join(', ')}`);
        continue;
      }

      const customer = await customerRepository.findByCode(row.erpCustomerId);
      if (!customer) {
        result.errors.push('ERP customer ID not found in Gesher');
        continue;
      }

      let ownerId: number | null = null;
      if (row.repEmail) {
        ownerId = usersByEmail.get(normalizeEmail(row.repEmail)) ?? null;
        if (!ownerId) {
          result.warnings.push(`rep ${row.repEmail} is not an active Pipedrive user; owner not set`);
        }
      }

      let organization = orgCache.get(customer.customerCode);
      if (!organization) {
        organization = await upsertOrganization(
          connectionId,
          config,
          {
            name: customer.name,
            erpCustomerId: customer.customerCode,
            accountType,
            address: customerAddress(customer, row.county),
            ownerId,
            existingOrgId: customer.pipedriveOrgId,
          },
          { dryRun: options.dryRun }
        );
        orgCache.set(customer.customerCode, organization);
      }
      result.organization = organization;
      result.warnings.push(...(organization.warnings ?? []));

      if (organization.status === 'needs_review') {
        result.warnings.push(`organization needs review: ${organization.reason}`);
        continue;
      }

      if (row.contactName) {
        const person = await upsertPerson(
          connectionId,
          config,
          {
            name: row.contactName,
            email: row.contactEmail,
            phone: row.contactPhone,
            role: row.contactRole,
            orgId: organization.id ?? null,
            ownerId,
          },
          { dryRun: options.dryRun }
        );
        result.person = person;
        if (person.status === 'needs_review') {
          result.warnings.push(`person needs review: ${person.reason}`);
        }
      }

      if (!options.dryRun && organization.id) {
        const personId = result.person?.status !== 'needs_review' ? result.person?.id : undefined;
        // A stored link that upsertOrganization could not open ('linked') is dead
        const orgLinkDead = Boolean(customer.pipedriveOrgId) && organization.status !== 'linked';
        const warning = await linkCustomer(customer, { orgId: organization.id, personId }, { orgLinkDead });
        if (warning) {result.warnings.push(warning);}
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  const next = start + batch.length;
  return {
    dryRun: options.dryRun ?? false,
    processed: batch.length,
    nextRow: next < rows.length ? next : null,
    totalRows: rows.length,
    results,
  };
}
