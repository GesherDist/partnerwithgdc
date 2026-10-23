/**
 * Customer mapping: link every ERP customer to the right Pipedrive organization
 * once, by hand, before the first "Sync all" on an account (e.g. moving from a
 * sandbox to the live Pipedrive). After it, customers are matched by stored
 * IDs only, so names and guesses no longer matter.
 *
 * Preview (read only, nothing is written anywhere): every ERP customer with a
 * suggested organization and why:
 *   linked     - its stored link points to an organization carrying its ERP Customer ID
 *   erp_id     - an organization carries its ERP Customer ID
 *   exact_name - same company name (case, punctuation and LLC/Inc ignored)
 *   email      - a person of the organization uses the customer's or a contact's email
 *   similar    - a close name; must be confirmed by hand (no action preselected)
 *   none       - nothing found: Create (active customers) or Skip (inactive)
 * An organization suggested for several customers is a conflict: no action
 * is preselected for those rows.
 *
 * Apply (per decision, in small batches):
 *   link   - stores the link, writes the ERP Customer ID and "Current Customer"
 *            on the organization (name and address untouched), and clears
 *            person links and sync snapshots that belonged to the old link, so
 *            "Sync all" then pairs the contacts by email / name (ERP wins)
 *   create - clears the old link and creates (or finds) the organization
 *   skip   - clears the old link; nothing in Pipedrive
 * Undecided rows are left unchanged.
 */

import { db } from '@/shared/lib/supabase/database';
import { fetchAllRows } from '@/shared/lib/supabase/paginate';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest } from '../lib/rate-limiter';
import { getGdcConfig } from './setup.service';
import { getActivePipedriveConnectionId } from './settings';
import { getOrg, markOrganizationAsCustomer, normalizeEmail, parseOrgAddress } from './org-sync.service';
import { publishPurchaseHistoryInBackground, syncCustomerToPipedrive } from './customer-sync.service';

// ============================================
// TYPES
// ============================================

export type MappingReason = 'linked' | 'erp_id' | 'exact_name' | 'email' | 'similar' | 'none';
export type MappingAction = 'link' | 'create' | 'skip';

export interface MappingOrganization {
  id: number;
  name: string;
  city: string | null;
  erpCustomerId: string | null;
}

export interface MappingCandidate {
  orgId: number;
  reason: MappingReason;
  /** 0..1 name similarity (similar matches) */
  score?: number;
}

export interface MappingRow {
  customerId: string;
  customerCode: string;
  name: string;
  email: string | null;
  status: string;
  currentOrgId: number | null;
  suggestion: MappingCandidate | null;
  reason: MappingReason;
  /** Other likely organizations (best first) */
  alternatives: MappingCandidate[];
  /** Preselected action; null = must be decided by hand */
  defaultAction: MappingAction | null;
  note: string | null;
}

export interface CustomerMappingPreview {
  rows: MappingRow[];
  organizations: MappingOrganization[];
  /** False when Pipedrive did not confirm the full organization / people lists */
  complete: boolean;
}

export interface MappingDecision {
  customerId: string;
  action: MappingAction;
  orgId?: number | null;
}

export interface MappingApplyResult {
  customerId: string;
  status: 'linked' | 'unchanged' | 'created' | 'skipped' | 'error';
  message: string;
  orgId?: number;
}

/** Decisions per apply call (each one makes a few Pipedrive calls) */
export const MAPPING_APPLY_BATCH_SIZE = 20;

// ============================================
// NAME MATCHING
// ============================================

const COMPANY_SUFFIXES = new Set(['llc', 'inc', 'incorporated', 'co', 'corp', 'corporation', 'company', 'ltd', 'limited', 'lp', 'llp', 'pllc', 'the']);

/** "Lindsay Irrigation Solutions, LLC" -> "lindsay irrigation solutions" */
export function normalizeCompanyName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !COMPANY_SUFFIXES.has(word))
    .join(' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) {return 0;}
  if (!a.length) {return b.length;}
  if (!b.length) {return a.length;}
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** 0..1: the better of edit similarity and word overlap of normalized names */
export function companyNameSimilarity(a: string, b: string): number {
  const x = normalizeCompanyName(a);
  const y = normalizeCompanyName(b);
  if (!x || !y) {return 0;}
  if (x === y) {return 1;}
  const edit = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const wordsX = new Set(x.split(' '));
  const wordsY = new Set(y.split(' '));
  const shared = [...wordsX].filter((w) => wordsY.has(w)).length;
  const overlap = shared / Math.max(wordsX.size, wordsY.size);
  // One name containing the other ("Lindsay" in "Lindsay Irrigation")
  const contains = x.includes(y) || y.includes(x) ? 0.85 : 0;
  return Math.max(edit, overlap, contains);
}

const SIMILAR_THRESHOLD = 0.75;
const ALTERNATIVE_THRESHOLD = 0.5;

// ============================================
// PREVIEW
// ============================================

interface CustomerRowDb {
  id: string;
  customer_code: string;
  name: string;
  email: string | null;
  status: string;
  pipedrive_org_id: number | null;
}

export async function buildCustomerMappingPreview(): Promise<CustomerMappingPreview> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    throw new Error('Pipedrive is not connected');
  }
  const config = await getGdcConfig(connectionId);
  const erpField = config.fields.org_erp_customer_id.code;

  // ---- Pipedrive (read only) ----
  const [orgList, personList] = await Promise.all([
    pipedriveProvider.fetchAllV2<Record<string, unknown>>(connectionId, 'organizations', undefined, runPipedriveRequest),
    pipedriveProvider.fetchAllV2<Record<string, unknown>>(connectionId, 'persons', undefined, runPipedriveRequest),
  ]);
  const organizations: MappingOrganization[] = orgList.items
    .filter((raw) => raw.is_deleted !== true && Number(raw.id) > 0)
    .map((raw) => {
      const erp = (raw.custom_fields as Record<string, unknown> | undefined)?.[erpField];
      return {
        id: Number(raw.id),
        name: String(raw.name ?? '').trim(),
        city: parseOrgAddress(raw)?.city ?? null,
        erpCustomerId: typeof erp === 'string' && erp.trim() ? erp.trim() : null,
      };
    });
  const orgById = new Map(organizations.map((org) => [org.id, org]));

  // email -> organizations of the people using it
  const orgsByEmail = new Map<string, Set<number>>();
  for (const raw of personList.items) {
    const orgValue = raw.org_id as number | { value?: number } | null | undefined;
    const orgId = typeof orgValue === 'object' && orgValue ? Number(orgValue.value) : Number(orgValue);
    if (!orgById.has(orgId)) {continue;}
    const emails = (raw.emails ?? raw.email) as Array<{ value?: string } | string> | undefined;
    for (const entry of Array.isArray(emails) ? emails : []) {
      const email = normalizeEmail(typeof entry === 'string' ? entry : entry?.value);
      if (!email) {continue;}
      const set = orgsByEmail.get(email) ?? new Set<number>();
      set.add(orgId);
      orgsByEmail.set(email, set);
    }
  }

  // ---- ERP ----
  const customers = await fetchAllRows<CustomerRowDb>((from, to) =>
    db
      .from('customers')
      .select('id, customer_code, name, email, status, pipedrive_org_id')
      .is('deleted_at', null)
      .order('customer_code', { ascending: true })
      .range(from, to)
  );
  const contacts = await fetchAllRows<{ customer_id: string; email: string | null }>((from, to) =>
    db
      .from('customer_contacts')
      .select('customer_id, email')
      .is('deleted_at', null)
      .not('email', 'is', null)
      .order('id', { ascending: true })
      .range(from, to)
  );
  const emailsByCustomer = new Map<string, Set<string>>();
  for (const customer of customers) {
    const email = normalizeEmail(customer.email);
    if (email) {emailsByCustomer.set(customer.id, new Set([email]));}
  }
  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);
    if (!email) {continue;}
    const set = emailsByCustomer.get(contact.customer_id) ?? new Set<string>();
    set.add(email);
    emailsByCustomer.set(contact.customer_id, set);
  }

  const orgNames = organizations.map((org) => ({ org, normalized: normalizeCompanyName(org.name) }));

  const rows: MappingRow[] = customers.map((customer) => {
    const code = customer.customer_code.trim();
    const candidates: MappingCandidate[] = [];
    const add = (candidate: MappingCandidate) => {
      if (!candidates.some((c) => c.orgId === candidate.orgId)) {candidates.push(candidate);}
    };

    // Stored link, trusted only when the organization carries this customer's ERP ID
    const current = customer.pipedrive_org_id ? orgById.get(customer.pipedrive_org_id) : undefined;
    if (current && current.erpCustomerId?.toLowerCase() === code.toLowerCase()) {
      add({ orgId: current.id, reason: 'linked' });
    }
    const byErpId = organizations.filter((org) => org.erpCustomerId?.toLowerCase() === code.toLowerCase());
    if (byErpId.length === 1) {add({ orgId: byErpId[0]!.id, reason: 'erp_id' });}

    const normalized = normalizeCompanyName(customer.name);
    const byName = normalized ? orgNames.filter((o) => o.normalized === normalized).map((o) => o.org) : [];
    if (byName.length === 1) {add({ orgId: byName[0]!.id, reason: 'exact_name' });}

    const emailOrgs = new Set<number>();
    for (const email of emailsByCustomer.get(customer.id) ?? []) {
      for (const orgId of orgsByEmail.get(email) ?? []) {emailOrgs.add(orgId);}
    }
    if (emailOrgs.size === 1) {add({ orgId: [...emailOrgs][0]!, reason: 'email' });}

    const similar = orgNames
      .map((o) => ({ orgId: o.org.id, score: companyNameSimilarity(customer.name, o.org.name) }))
      .filter((s) => s.score >= ALTERNATIVE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    for (const s of similar) {
      add({ orgId: s.orgId, reason: s.score >= SIMILAR_THRESHOLD ? 'similar' : 'none', score: Math.round(s.score * 100) / 100 });
    }
    // Ambiguous exact names / emails are offered as alternatives, never chosen
    for (const org of byName.length > 1 ? byName : []) {add({ orgId: org.id, reason: 'similar', score: 1 });}
    for (const orgId of emailOrgs.size > 1 ? emailOrgs : []) {add({ orgId, reason: 'similar' });}

    // An organization already carrying another customer's ERP ID is never a confident match
    for (const c of candidates) {
      const carried = orgById.get(c.orgId)?.erpCustomerId;
      if (carried && carried.toLowerCase() !== code.toLowerCase() && (c.reason === 'exact_name' || c.reason === 'email')) {
        c.reason = 'similar';
      }
    }

    const best = candidates.find((c) => c.reason !== 'none') ?? null;
    const confident = best && best.reason !== 'similar' ? best : null;
    const notes: string[] = [];
    if (customer.pipedrive_org_id && !current) {
      notes.push(`Stored link ${customer.pipedrive_org_id} does not exist in this Pipedrive account`);
    } else if (customer.pipedrive_org_id && current && !candidates.some((c) => c.reason === 'linked')) {
      notes.push(`Stored link ${customer.pipedrive_org_id} ("${current.name}") does not carry this customer's ERP ID`);
    }
    if (byName.length > 1) {notes.push(`${byName.length} organizations have this name`);}
    if (emailOrgs.size > 1) {notes.push(`Emails found in ${emailOrgs.size} organizations`);}

    return {
      customerId: customer.id,
      customerCode: code,
      name: customer.name,
      email: customer.email,
      status: customer.status,
      currentOrgId: customer.pipedrive_org_id,
      suggestion: best,
      reason: best?.reason ?? 'none',
      alternatives: candidates.filter((c) => c.orgId !== best?.orgId).slice(0, 5),
      defaultAction: confident ? 'link' : best ? null : customer.status === 'active' ? 'create' : 'skip',
      note: notes.length > 0 ? notes.join('; ') : null,
    };
  });

  // One organization suggested for several customers: decide those by hand
  const suggestedCount = new Map<number, number>();
  for (const row of rows) {
    if (row.defaultAction === 'link' && row.suggestion) {
      suggestedCount.set(row.suggestion.orgId, (suggestedCount.get(row.suggestion.orgId) ?? 0) + 1);
    }
  }
  for (const row of rows) {
    if (row.defaultAction === 'link' && row.suggestion && (suggestedCount.get(row.suggestion.orgId) ?? 0) > 1) {
      row.defaultAction = null;
      row.note = [row.note, 'Same organization suggested for another customer'].filter(Boolean).join('; ');
    }
  }

  return { rows, organizations, complete: orgList.complete && personList.complete };
}

// ============================================
// APPLY
// ============================================

/** Remove a customer's Pipedrive links that belong to its old organization */
async function clearCustomerLinks(customerId: string): Promise<void> {
  const { error } = await db
    .from('customers')
    .update({ pipedrive_org_id: null, pipedrive_person_id: null, pipedrive_sync_snapshot: null })
    .eq('id', customerId);
  if (error) {throw new Error(`Failed to clear the customer's links: ${error.message}`);}
  // Deleted contacts too: their person IDs belonged to the old organization
  const { error: contactError } = await db
    .from('customer_contacts')
    .update({ pipedrive_person_id: null, pipedrive_sync_snapshot: null })
    .eq('customer_id', customerId);
  if (contactError) {throw new Error(`Failed to clear the contacts' links: ${contactError.message}`);}
}

export async function applyCustomerMapping(decisions: MappingDecision[]): Promise<MappingApplyResult[]> {
  if (decisions.length > MAPPING_APPLY_BATCH_SIZE) {
    throw new Error(`At most ${MAPPING_APPLY_BATCH_SIZE} decisions per call`);
  }
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    throw new Error('Pipedrive is not connected');
  }
  const config = await getGdcConfig(connectionId);
  const erpField = config.fields.org_erp_customer_id.code;

  // An organization may be chosen for one customer only
  const chosen = new Map<number, number>();
  for (const d of decisions) {
    if (d.action === 'link' && d.orgId) {chosen.set(d.orgId, (chosen.get(d.orgId) ?? 0) + 1);}
  }

  const results: MappingApplyResult[] = [];
  for (const decision of decisions) {
    const { customerId } = decision;
    try {
      const { data: customer, error } = await db
        .from('customers')
        .select('id, customer_code, pipedrive_org_id')
        .eq('id', customerId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) {throw new Error(error.message);}
      if (!customer) {
        results.push({ customerId, status: 'error', message: 'Customer not found' });
        continue;
      }
      const code = String(customer.customer_code);

      if (decision.action === 'skip') {
        if (customer.pipedrive_org_id) {await clearCustomerLinks(customerId);}
        results.push({ customerId, status: 'skipped', message: customer.pipedrive_org_id ? 'Pipedrive link removed' : 'Not linked' });
        continue;
      }

      if (decision.action === 'create') {
        await clearCustomerLinks(customerId);
        const synced = await syncCustomerToPipedrive(customerId, { includeContacts: false });
        if (!synced.organization.id || synced.organization.status === 'needs_review') {
          results.push({ customerId, status: 'error', message: synced.organization.reason ?? 'Organization not created' });
        } else {
          results.push({
            customerId,
            status: 'created',
            orgId: synced.organization.id,
            message: synced.organization.status === 'created' ? 'Organization created in Pipedrive' : `Organization ${synced.organization.status} by ERP ID / name`,
          });
        }
        continue;
      }

      // ---- link ----
      const orgId = Number(decision.orgId);
      if (!Number.isInteger(orgId) || orgId <= 0) {
        results.push({ customerId, status: 'error', message: 'No organization chosen' });
        continue;
      }
      if ((chosen.get(orgId) ?? 0) > 1) {
        results.push({ customerId, status: 'error', message: `Organization ${orgId} was chosen for more than one customer` });
        continue;
      }
      const org = await getOrg(connectionId, orgId);
      if (!org) {
        results.push({ customerId, status: 'error', message: `Organization ${orgId} not found in Pipedrive` });
        continue;
      }
      const otherErpId = typeof org.customFields[erpField] === 'string' ? String(org.customFields[erpField]).trim() : '';
      if (otherErpId && otherErpId.toLowerCase() !== code.toLowerCase()) {
        results.push({ customerId, status: 'error', message: `"${org.name}" carries ERP Customer ID ${otherErpId}` });
        continue;
      }
      const { data: others, error: othersError } = await db
        .from('customers')
        .select('customer_code')
        .eq('pipedrive_org_id', orgId)
        .neq('id', customerId)
        .is('deleted_at', null);
      if (othersError) {throw new Error(othersError.message);}
      if (others && others.length > 0) {
        results.push({ customerId, status: 'error', message: `"${org.name}" is already linked to ${others.map((o) => o.customer_code).join(', ')}` });
        continue;
      }

      const changed = customer.pipedrive_org_id !== orgId;
      if (changed) {
        await clearCustomerLinks(customerId);
        const { error: linkError } = await db.from('customers').update({ pipedrive_org_id: orgId }).eq('id', customerId);
        if (linkError) {throw new Error(linkError.message);}
      }
      await markOrganizationAsCustomer(connectionId, config, orgId, code);
      if (changed) {publishPurchaseHistoryInBackground(customerId);}
      results.push({
        customerId,
        status: changed ? 'linked' : 'unchanged',
        orgId,
        message: changed ? `Linked to "${org.name}"` : `Already linked to "${org.name}"`,
      });
    } catch (error) {
      results.push({ customerId, status: 'error', message: error instanceof Error ? error.message : 'Failed' });
    }
  }
  return results;
}
