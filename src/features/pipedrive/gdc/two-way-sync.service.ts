/**
 * "Sync with Pipedrive" button: two-way sync of one customer and its contacts.
 *
 * Each shared field is compared with the snapshot stored at the last sync
 * (migration 166) to see which side changed it:
 * - only Pipedrive changed it        -> Pipedrive value goes to the ERP
 * - only the ERP changed it, or both -> ERP value goes to Pipedrive (ERP wins)
 * - never synced (no snapshot)       -> ERP wins
 * - empty in the ERP                 -> filled from Pipedrive
 * - empty in Pipedrive               -> filled from the ERP (Pipedrive never clears the ERP)
 *
 * Contacts only in the ERP get a Pipedrive person; people only in Pipedrive
 * (in the customer's organization) get an ERP contact. A linked person that
 * was deleted in Pipedrive is unlinked, not re-created; a contact deleted in
 * the ERP is not re-created from Pipedrive.
 *
 * The automatic sync (customer / contact saves and the Pipedrive webhook)
 * keeps working as before; this button reconciles one customer on demand.
 */

import { db } from '@/shared/lib/supabase/database';
import { pipedriveProvider, isPipedriveNotFound } from '@/modules/integrations/providers/crm/pipedrive';
import { customerService } from '@/features/customers/services/customer.service';
import { customerContactService } from '@/features/customers/services/customer-contact.service';
import type { UpdateCustomerContactInput, UpdateCustomerInput } from '@/features/customers/lib/schemas';
import { runPipedriveRequest } from '../lib/rate-limiter';
import { getGdcConfig } from './setup.service';
import { getActivePipedriveConnectionId } from './settings';
import {
  getOrg,
  normalizeAddressPart,
  normalizeCountry,
  normalizeEmail,
  normalizePhone,
  parsePersonDetails,
  type OrgRecord,
  type PersonDetails,
} from './org-sync.service';
import {
  CONTACT_COLUMNS,
  CUSTOMER_SYNC_COLUMNS,
  contactName,
  contactSyncValues,
  contactTypeFromRole,
  createContactFromPerson,
  customerSyncValues,
  pushContact,
  saveContactSnapshot,
  saveCustomerSnapshot,
  splitPersonName,
  syncCustomerToPipedrive,
  type ContactRow,
  type CustomerSyncRow,
  type SyncSnapshot,
} from './customer-sync.service';

// ============================================
// TYPES
// ============================================

export interface TwoWaySyncResult {
  organization: { status: string; id?: number; reason?: string };
  /** Customer fields copied in each direction */
  customer: { toErp: string[]; toPipedrive: string[] };
  contacts: {
    updatedInErp: number;
    updatedInPipedrive: number;
    createdInErp: number;
    createdInPipedrive: number;
    unchanged: number;
    /** Linked people deleted in Pipedrive: link removed, ERP contact kept */
    unlinked: number;
  };
  warnings: string[];
}

type Direction = 'toErp' | 'toPipedrive' | null;

// ============================================
// FIELD RULE
// ============================================

/** Which side wins for one field; all values are normalized */
export function resolveField(erp: string, pipedrive: string, snapshot: string | undefined): Direction {
  if (erp === pipedrive) {
    return null;
  }
  if (!pipedrive) {
    return 'toPipedrive';
  }
  if (!erp) {
    return 'toErp';
  }
  if (snapshot === undefined) {
    return 'toPipedrive';
  }
  if (erp === snapshot && pipedrive !== snapshot) {
    return 'toErp';
  }
  return 'toPipedrive';
}

function splitFields(erp: SyncSnapshot, pipedrive: SyncSnapshot, snapshot: SyncSnapshot | null) {
  const toErp: string[] = [];
  const toPipedrive: string[] = [];
  for (const field of Object.keys(erp)) {
    const direction = resolveField(erp[field] ?? '', pipedrive[field] ?? '', snapshot?.[field]);
    if (direction === 'toErp') {toErp.push(field);}
    if (direction === 'toPipedrive') {toPipedrive.push(field);}
  }
  return { toErp, toPipedrive };
}

// ============================================
// CUSTOMER <-> ORGANIZATION
// ============================================

function orgSyncValues(org: OrgRecord): SyncSnapshot {
  const address = org.address;
  return {
    name: normalizeAddressPart(org.name),
    street: normalizeAddressPart(address?.street),
    city: normalizeAddressPart(address?.city),
    state: normalizeAddressPart(address?.state),
    zip: normalizeAddressPart(address?.postalCode),
    country: address?.country ? normalizeCountry(address.country) : '',
  };
}

function customerInputFromOrg(org: OrgRecord, fields: string[]): UpdateCustomerInput {
  const address = org.address;
  const input: UpdateCustomerInput = {};
  for (const field of fields) {
    if (field === 'name') {input.name = org.name.trim();}
    if (field === 'street' && address?.street) {
      // Pipedrive has one street line
      input.address1 = address.street;
      input.address2 = null;
    }
    if (field === 'city' && address?.city) {input.city = address.city;}
    if (field === 'state' && address?.state) {input.state = address.state;}
    if (field === 'zip' && address?.postalCode) {input.zip = address.postalCode;}
    if (field === 'country' && address?.country) {
      input.country = normalizeCountry(address.country) === 'us' ? 'US' : address.country;
    }
  }
  return input;
}

interface CustomerSyncState extends CustomerSyncRow {
  pipedrive_org_id: number | null;
  pipedrive_sync_snapshot: SyncSnapshot | null;
}

async function loadCustomer(customerId: string): Promise<CustomerSyncState | null> {
  const { data, error } = await db
    .from('customers')
    .select(`${CUSTOMER_SYNC_COLUMNS}, pipedrive_org_id, pipedrive_sync_snapshot`)
    .eq('id', customerId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load customer ${customerId}: ${error.message}`);
  }
  return data as CustomerSyncState | null;
}

// ============================================
// CONTACT <-> PERSON
// ============================================

interface ContactSyncState extends ContactRow {
  pipedrive_sync_snapshot: SyncSnapshot | null;
}

function personSyncValues(person: PersonDetails): SyncSnapshot {
  const names = splitPersonName(person);
  return {
    name: names ? normalizeAddressPart(contactName({ first_name: names.firstName, last_name: names.lastName })) : '',
    email: normalizeEmail(person.email),
    phone: normalizePhone(person.phone),
    mobile: normalizePhone(person.mobile),
    type: contactTypeFromRole(person.role) ?? '',
  };
}

function contactInputFromPerson(person: PersonDetails, fields: string[]): UpdateCustomerContactInput {
  const input: UpdateCustomerContactInput = {};
  for (const field of fields) {
    if (field === 'name') {
      const names = splitPersonName(person);
      if (names) {
        input.firstName = names.firstName;
        input.lastName = names.lastName;
      }
    }
    if (field === 'email' && person.email) {input.email = person.email;}
    if (field === 'phone' && person.phone) {input.phone = person.phone;}
    if (field === 'mobile' && person.mobile) {input.mobile = person.mobile;}
    if (field === 'type') {
      const type = contactTypeFromRole(person.role);
      if (type) {input.contactType = type;}
    }
  }
  return input;
}

async function loadContacts(customerId: string): Promise<ContactSyncState[]> {
  const { data, error } = await db
    .from('customer_contacts')
    .select(`${CONTACT_COLUMNS}, pipedrive_sync_snapshot`)
    .eq('customer_id', customerId);
  if (error) {
    throw new Error(`Failed to load contacts: ${error.message}`);
  }
  return (data ?? []) as ContactSyncState[];
}

async function reloadContact(contactId: string): Promise<ContactRow | null> {
  const { data, error } = await db.from('customer_contacts').select(CONTACT_COLUMNS).eq('id', contactId).maybeSingle();
  if (error) {
    throw new Error(`Failed to load contact ${contactId}: ${error.message}`);
  }
  return data as ContactRow | null;
}

/** Unique match among candidates, or null when none or several */
function only<T>(candidates: T[]): T | null {
  return candidates.length === 1 ? candidates[0]! : null;
}

// ============================================
// MAIN
// ============================================

export async function syncCustomerWithPipedrive(customerId: string): Promise<TwoWaySyncResult> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    throw new Error('Pipedrive is not connected');
  }
  const config = await getGdcConfig(connectionId);
  const result: TwoWaySyncResult = {
    organization: { status: 'linked' },
    customer: { toErp: [], toPipedrive: [] },
    contacts: { updatedInErp: 0, updatedInPipedrive: 0, createdInErp: 0, createdInPipedrive: 0, unchanged: 0, unlinked: 0 },
    warnings: [],
  };

  // ---- 1. Customer <-> organization ----
  let customer = await loadCustomer(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  let org = customer.pipedrive_org_id ? await getOrg(connectionId, customer.pipedrive_org_id) : null;
  if (org) {
    result.organization = { status: 'linked', id: org.id };
  } else {
    // Not linked yet (or the organization is gone): find or create it, ERP wins
    const first = await syncCustomerToPipedrive(customerId, { includeContacts: false });
    result.organization = { status: first.organization.status, id: first.organization.id, reason: first.organization.reason };
    result.warnings.push(...first.warnings);
    if (!first.organization.id || first.organization.status === 'needs_review') {
      return result;
    }
    org = await getOrg(connectionId, first.organization.id);
    customer = await loadCustomer(customerId);
    if (!org || !customer) {
      throw new Error('Organization not found right after the sync');
    }
  }

  const fields = splitFields(customerSyncValues(customer), orgSyncValues(org), customer.pipedrive_sync_snapshot);
  if (fields.toErp.length > 0) {
    const updated = await customerService.update(customerId, customerInputFromOrg(org, fields.toErp), undefined, {
      skipPipedriveSync: true,
    });
    if (updated.success) {
      result.customer.toErp = fields.toErp;
    } else {
      result.warnings.push(`Customer not updated from Pipedrive: ${updated.error ?? 'unknown error'}`);
    }
  }
  if (fields.toPipedrive.length > 0) {
    const pushed = await syncCustomerToPipedrive(customerId, { includeContacts: false });
    if (pushed.organization.status === 'needs_review') {
      result.warnings.push(`Organization not updated: ${pushed.organization.reason}`);
    } else {
      result.customer.toPipedrive = fields.toPipedrive;
    }
  } else {
    await saveCustomerSnapshot(customerId);
  }

  // ---- 2. Contacts <-> people of the organization ----
  const allContacts = await loadContacts(customerId);
  const contacts = allContacts.filter((contact) => !contact.deleted_at);
  // People whose ERP contact was deleted are never re-created
  const deletedPersonIds = new Set(
    allContacts.filter((contact) => contact.deleted_at && contact.pipedrive_person_id).map((contact) => contact.pipedrive_person_id!)
  );

  const people = await pipedriveProvider.fetchAllV2<unknown>(
    connectionId,
    'persons',
    new URLSearchParams({ org_id: String(org.id) }),
    runPipedriveRequest
  );
  if (!people.complete) {
    result.warnings.push('Pipedrive people list incomplete; people only in Pipedrive were not added to the ERP');
  }
  const persons = people.items
    .map((raw) => parsePersonDetails(raw, config.fields.person_role.code))
    .filter((person): person is PersonDetails => person !== null);
  const personById = new Map(persons.map((person) => [person.id, person]));
  const usedPersons = new Set<number>();
  const pairs: Array<{ contact: ContactSyncState; person: PersonDetails | null }> = [];

  // Linked contacts
  for (const contact of contacts.filter((c) => c.pipedrive_person_id)) {
    const person = personById.get(contact.pipedrive_person_id!);
    if (person) {
      pairs.push({ contact, person });
      usedPersons.add(person.id);
      continue;
    }
    // Not in this organization: deleted in Pipedrive, or moved elsewhere
    let exists = true;
    try {
      const response = await runPipedriveRequest(() =>
        pipedriveProvider.request<unknown>(connectionId, 'GET', `persons/${contact.pipedrive_person_id}`)
      );
      const raw = response.data as { is_deleted?: boolean; active_flag?: boolean } | null;
      exists = Boolean(raw) && raw?.is_deleted !== true && raw?.active_flag !== false;
    } catch (error) {
      if (!isPipedriveNotFound(error)) {throw error;}
      exists = false;
    }
    if (exists) {
      result.warnings.push(`${contactName(contact)}: the linked Pipedrive person belongs to another organization; not synced`);
    } else {
      const { error } = await db.from('customer_contacts').update({ pipedrive_person_id: null }).eq('id', contact.id);
      if (error) {throw new Error(`Failed to unlink ${contactName(contact)}: ${error.message}`);}
      result.contacts.unlinked++;
    }
  }

  // Unlinked contacts: match a free person by email, then by name
  for (const contact of contacts.filter((c) => !c.pipedrive_person_id)) {
    const free = persons.filter((person) => !usedPersons.has(person.id));
    const email = normalizeEmail(contact.email);
    const name = normalizeAddressPart(contactName(contact));
    const person =
      (email ? only(free.filter((p) => normalizeEmail(p.email) === email)) : null) ??
      only(free.filter((p) => personSyncValues(p).name === name));
    if (person) {
      usedPersons.add(person.id);
      const { error } = await db.from('customer_contacts').update({ pipedrive_person_id: person.id }).eq('id', contact.id);
      if (error) {throw new Error(`Failed to link ${contactName(contact)}: ${error.message}`);}
      contact.pipedrive_person_id = person.id;
    }
    pairs.push({ contact, person });
  }

  for (const { contact, person } of pairs) {
    if (!person) {
      const pushed = await pushContact(connectionId, config, contact, org.id);
      if (pushed?.result.status === 'needs_review') {
        result.warnings.push(`${pushed.name}: ${pushed.result.reason}`);
      } else if (pushed) {
        result.contacts.createdInPipedrive++;
      }
      continue;
    }

    const contactFields = splitFields(contactSyncValues(contact), personSyncValues(person), contact.pipedrive_sync_snapshot);
    if (contactFields.toErp.length > 0) {
      const updated = await customerContactService.update(contact.id, contactInputFromPerson(person, contactFields.toErp), undefined, {
        skipPipedriveSync: true,
      });
      if (updated.success) {
        result.contacts.updatedInErp++;
      } else {
        result.warnings.push(`${contactName(contact)} not updated from Pipedrive: ${updated.error ?? 'unknown error'}`);
      }
    }
    if (contactFields.toPipedrive.length > 0) {
      const current = await reloadContact(contact.id);
      const pushed = current ? await pushContact(connectionId, config, current, org.id) : null;
      if (pushed?.result.status === 'needs_review') {
        result.warnings.push(`${pushed.name}: ${pushed.result.reason}`);
      } else if (pushed) {
        result.contacts.updatedInPipedrive++;
      }
    } else {
      await saveContactSnapshot(contact.id);
    }
    if (contactFields.toErp.length === 0 && contactFields.toPipedrive.length === 0) {
      result.contacts.unchanged++;
    }
  }

  // People only in Pipedrive
  for (const person of persons) {
    if (usedPersons.has(person.id) || deletedPersonIds.has(person.id)) {
      continue;
    }
    const created = await createContactFromPerson(customer, person);
    if (created.status === 'created') {
      result.contacts.createdInErp++;
    } else {
      result.warnings.push(created.message);
    }
  }

  return result;
}
