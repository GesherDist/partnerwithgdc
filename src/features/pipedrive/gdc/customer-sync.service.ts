/**
 * Gesher customers -> Pipedrive organizations and people.
 *
 * - syncCustomerToPipedrive: one ERP customer (organization + its contacts)
 * - parseCustomerImportCsv / runCustomerImport: CSV import keyed by ERP Customer ID
 *
 * Both are safe to retry: matching follows org-sync.service, and the Gesher
 * customer stores the linked Pipedrive IDs. An existing link is never replaced.
 */

import { parse } from 'csv-parse/sync';
import { db } from '@/shared/lib/supabase/database';
import { customerRepository } from '@/features/customers/repositories/customer.repository';
import { CONTACT_TYPE_LABELS, type ContactType, type Customer } from '@/features/customers/types';
import { GDC_ACCOUNT_TYPES, type GdcAccountType } from './config';
import { getGdcConfig } from './setup.service';
import { getActivePipedriveConnectionId, type GdcResolvedConfig } from './settings';
import {
  getPipedriveUsersByEmail,
  normalizeEmail,
  upsertOrganization,
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
 */
async function linkCustomer(
  customer: Customer,
  ids: { orgId?: number; personId?: number }
): Promise<string | null> {
  const updates: Record<string, number> = {};
  const warnings: string[] = [];

  if (ids.orgId) {
    if (!customer.pipedriveOrgId) {
      updates.pipedrive_org_id = ids.orgId;
    } else if (customer.pipedriveOrgId !== ids.orgId) {
      warnings.push(`customer is linked to Pipedrive organization ${customer.pipedriveOrgId}, kept`);
    }
  }
  if (ids.personId && !customer.pipedrivePersonId) {
    updates.pipedrive_person_id = ids.personId;
  }

  if (Object.keys(updates).length > 0) {
    // Conditional update: only fill columns that are still empty (safe under concurrency)
    let query = db.from('customers').update(updates).eq('id', customer.id);
    if (updates.pipedrive_org_id) {query = query.is('pipedrive_org_id', null);}
    const { error } = await query;
    if (error) {
      throw new Error(`Failed to link customer ${customer.customerCode}: ${error.message}`);
    }
  }
  return warnings.length > 0 ? warnings.join('; ') : null;
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
  options: { dryRun?: boolean; accountType?: GdcAccountType } = {}
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

  warnings.push(...(organization.warnings ?? []));
  if (!customer.pipedriveOrgId && organization.status !== 'needs_review') {
    // The ERP has no county or customer-level sales rep; they come from the CSV import or Pipedrive
    warnings.push('County and assigned rep are not stored in the ERP: set them in Pipedrive or with the CSV import');
  }
  const people: CustomerSyncResult['people'] = [];
  if (organization.id && organization.status !== 'needs_review') {
    // Save the organization link right away, so a later failure (contacts)
    // cannot leave an organization in Pipedrive that Gesher does not know about
    if (!options.dryRun) {
      const warning = await linkCustomer(customer, { orgId: organization.id });
      if (warning) {warnings.push(warning);}
    }

    const { data: contacts, error } = await db
      .from('customer_contacts')
      .select('first_name, last_name, contact_type, email, phone, mobile')
      .eq('customer_id', customer.id)
      .is('deleted_at', null);
    if (error) {
      throw new Error(`Failed to load contacts: ${error.message}`);
    }

    let firstPersonId: number | undefined;
    for (const contact of contacts ?? []) {
      const name = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
      if (!name) {continue;}
      const result = await upsertPerson(
        connectionId,
        config,
        {
          name,
          email: contact.email,
          phone: contact.phone || contact.mobile,
          // Pipedrive "Role" = the contact type label shown in Gesher (e.g. "Sales Contact")
          role: CONTACT_TYPE_LABELS[contact.contact_type as ContactType] ?? null,
          orgId: organization.id,
        },
        { dryRun: options.dryRun }
      );
      people.push({ contact: name, result });
      firstPersonId ??= result.status !== 'needs_review' ? result.id : undefined;
    }

    if (!options.dryRun && firstPersonId) {
      await linkCustomer(customer, { personId: firstPersonId });
    }
  }

  return { organization, people, warnings };
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
        const warning = await linkCustomer(customer, { orgId: organization.id, personId });
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
