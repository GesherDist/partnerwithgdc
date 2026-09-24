/**
 * Customer Repository
 *
 * Data access layer for Customer module.
 * Handles all database operations for customers using Supabase Client.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Customer,
  CustomerListItem,
  CustomerListParams,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerStatus,
  PaginatedResult,
  Address,
  CustomerAddresses,
  CustomerDropdownItem,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbCustomer {
  id: string;
  customer_code: string;
  name: string;
  legal_name: string | null;
  channel: string;

  // Billing Address
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;

  // Shipping Address
  shipping_address_1: string | null;
  shipping_address_2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  use_separate_shipping: boolean;

  // Contact
  phone: string | null;
  email: string | null;
  website: string | null;

  // Tax
  tax_id: string | null;
  tax_exempt: boolean;
  tax_exempt_number: string | null;
  tax_exempt_expiry_at: string | null;

  // Credit
  credit_status: string;
  credit_limit: number;
  open_balance: number;
  credit_terms: string | null;

  // Settings
  preferred_location_id: string | null;
  default_payment_method: string | null;
  status: string;
  internal_notes: string | null;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;

  // QuickBooks Sync
  qbo_customer_id: string | null;
  qbo_realm_id: string | null;
  qbo_synced_at: string | null;
  qbo_sync_error: string | null;

  // Pipedrive Sync
  pipedrive_person_id: number | null;
  pipedrive_deal_id: number | null;
  pipedrive_org_id: number | null;
}

// ============================================
// REPOSITORY
// ============================================

class CustomerRepositoryImpl {
  // ==========================================
  // LIST & SEARCH
  // ==========================================

  /**
   * Find all customers with pagination and filtering
   */
  async findMany(params: CustomerListParams = {}): Promise<PaginatedResult<CustomerListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      channel,
      creditStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .from('customers')
      .select(
        `
        id,
        customer_code,
        name,
        email,
        phone,
        city,
        state,
        channel,
        status,
        credit_status,
        credit_limit,
        open_balance,
        created_at
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      query = query.or(
        `customer_code.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply channel filter
    if (channel) {
      query = query.eq('channel', channel);
    }

    // Apply credit status filter
    if (creditStatus) {
      query = query.eq('credit_status', creditStatus);
    }

    // Map camelCase sort fields to snake_case
    const sortFieldMap: Record<string, string> = {
      customerCode: 'customer_code',
      name: 'name',
      email: 'email',
      phone: 'phone',
      city: 'city',
      state: 'state',
      channel: 'channel',
      status: 'status',
      creditStatus: 'credit_status',
      creditLimit: 'credit_limit',
      openBalance: 'open_balance',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((row) => this.mapToListItem(row)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find a single customer by ID
   */
  async findById(id: string): Promise<Customer | null> {
    const { data, error } = await db
      .from('customers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch customer: ${error.message}`);
    }

    if (!data) {return null;}

    return this.mapToCustomer(data as DbCustomer);
  }

  /**
   * Find a single customer by customer code
   */
  async findByCode(code: string): Promise<Customer | null> {
    const { data, error } = await db
      .from('customers')
      .select('*')
      .eq('customer_code', code)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch customer: ${error.message}`);
    }

    if (!data) {return null;}

    return this.mapToCustomer(data as DbCustomer);
  }

  /**
   * Find a single customer by email
   */
  async findByEmail(email: string): Promise<Customer | null> {
    const { data, error } = await db
      .from('customers')
      .select('*')
      .eq('email', email)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch customer: ${error.message}`);
    }

    if (!data) {return null;}

    return this.mapToCustomer(data as DbCustomer);
  }

  // ==========================================
  // VALIDATION HELPERS
  // ==========================================

  /**
   * Check if a customer code already exists
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    let query = db
      .from('customers')
      .select('id')
      .eq('customer_code', code)
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to check customer code: ${error.message}`);
    }

    return data !== null;
  }

  /**
   * Check if an email already exists
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    if (!email) {return false;}

    let query = db
      .from('customers')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to check customer email: ${error.message}`);
    }

    return data !== null;
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get counts by status
   */
  async getCountsByStatus(): Promise<Record<CustomerStatus, number>> {
    const { data, error } = await db
      .from('customers')
      .select('status')
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get customer counts: ${error.message}`);
    }

    const counts: Record<CustomerStatus, number> = {
      active: 0,
      inactive: 0,
    };

    (data || []).forEach((r) => {
      const customerStatus = r.status as CustomerStatus;
      counts[customerStatus] = (counts[customerStatus] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get all unique channels
   */
  async getChannels(): Promise<string[]> {
    const { data, error } = await db
      .from('customers')
      .select('channel')
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get channels: ${error.message}`);
    }

    const channels = new Set<string>();
    (data || []).forEach((r) => channels.add(r.channel));
    return Array.from(channels);
  }

  // ==========================================
  // ADDRESS HELPERS
  // ==========================================

  /**
   * Get billing and shipping addresses for a customer
   */
  async getAddresses(id: string): Promise<CustomerAddresses | null> {
    const { data, error } = await db
      .from('customers')
      .select(`
        address_1, address_2, city, state, zip, country,
        shipping_address_1, shipping_address_2, shipping_city,
        shipping_state, shipping_zip, shipping_country,
        use_separate_shipping
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch customer addresses: ${error.message}`);
    }

    if (!data) {return null;}

    const billing: Address = {
      street: data.address_1 ? `${data.address_1}${data.address_2 ? ', ' + data.address_2 : ''}` : null,
      city: data.city,
      state: data.state,
      postalCode: data.zip,
      country: data.country,
    };

    const shipping: Address = data.use_separate_shipping
      ? {
          street: data.shipping_address_1
            ? `${data.shipping_address_1}${data.shipping_address_2 ? ', ' + data.shipping_address_2 : ''}`
            : null,
          city: data.shipping_city,
          state: data.shipping_state,
          postalCode: data.shipping_zip,
          country: data.shipping_country,
        }
      : billing;

    return { billing, shipping };
  }

  // ==========================================
  // DROPDOWN DATA
  // ==========================================

  /**
   * Get customers for dropdown/select
   */
  async findForDropdown(): Promise<CustomerDropdownItem[]> {
    const { data, error } = await db
      .from('customers')
      .select('id, customer_code, name, email, phone')
      .eq('status', 'active')
      .is('deleted_at', null)
      .neq('name', 'Company Legal Name') // Exclude placeholder record
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch customers for dropdown: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      code: row.customer_code,
      name: row.name,
      email: row.email,
      phone: row.phone,
    }));
  }

  // ==========================================
  // CODE GENERATION
  // ==========================================

  /**
   * Generate next customer code in format CUST-0001, CUST-0002, etc.
   */
  async getNextCustomerCode(): Promise<string> {
    // Get the highest existing customer code with CUST- prefix
    const { data, error } = await db
      .from('customers')
      .select('customer_code')
      .like('customer_code', 'CUST-%')
      .order('customer_code', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to get next customer code: ${error.message}`);
    }

    let nextNumber = 1;

    if (data && data.length > 0 && data[0]) {
      const lastCode = data[0].customer_code;
      // Extract number from CUST-XXXX format
      const match = lastCode.match(/^CUST-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Format with leading zeros (4 digits)
    return `CUST-${nextNumber.toString().padStart(4, '0')}`;
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new customer
   */
  async create(data: CreateCustomerDTO, userId?: string): Promise<Customer> {
    // Build insert data
    const insertData: Record<string, unknown> = {
      customer_code: data.customerCode,
      name: data.name,
      legal_name: data.legalName || null,
      channel: data.channel || 'dealer',

      // Billing Address
      address_1: data.address1 || null,
      address_2: data.address2 || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      country: data.country || 'US',

      // Shipping Address
      shipping_address_1: data.shippingAddress1 || null,
      shipping_address_2: data.shippingAddress2 || null,
      shipping_city: data.shippingCity || null,
      shipping_state: data.shippingState || null,
      shipping_zip: data.shippingZip || null,
      shipping_country: data.shippingCountry || 'US',
      use_separate_shipping: data.useSeparateShipping || false,

      // Contact
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,

      // Tax
      tax_id: data.taxId || null,
      tax_exempt: data.taxExempt || false,
      tax_exempt_number: data.taxExemptNumber || null,
      tax_exempt_expiry_at: data.taxExemptExpiryAt || null,

      // Credit
      credit_status: data.creditStatus || 'pending',
      credit_limit: data.creditLimit || 0,
      open_balance: data.openBalance || 0,
      credit_terms: data.creditTerms || null,

      // Settings
      preferred_location_id: data.preferredLocationId || null,
      default_payment_method: data.defaultPaymentMethod || null,
      status: data.status || 'active',
      internal_notes: data.internalNotes || null,

      // Audit
      created_by: userId || null,
      updated_by: userId || null,
    };

    const { data: customer, error } = await db
      .from('customers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create customer: ${error.message}`);
    }

    return this.mapToCustomer(customer as DbCustomer);
  }

  /**
   * Update an existing customer
   */
  async update(id: string, data: UpdateCustomerDTO, userId?: string): Promise<Customer> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    // Map all optional fields
    if (data.customerCode !== undefined) {updateData.customer_code = data.customerCode;}
    if (data.name !== undefined) {updateData.name = data.name;}
    if (data.legalName !== undefined) {updateData.legal_name = data.legalName;}
    if (data.channel !== undefined) {updateData.channel = data.channel;}

    // Billing Address
    if (data.address1 !== undefined) {updateData.address_1 = data.address1;}
    if (data.address2 !== undefined) {updateData.address_2 = data.address2;}
    if (data.city !== undefined) {updateData.city = data.city;}
    if (data.state !== undefined) {updateData.state = data.state;}
    if (data.zip !== undefined) {updateData.zip = data.zip;}
    if (data.country !== undefined) {updateData.country = data.country;}

    // Shipping Address
    if (data.shippingAddress1 !== undefined) {updateData.shipping_address_1 = data.shippingAddress1;}
    if (data.shippingAddress2 !== undefined) {updateData.shipping_address_2 = data.shippingAddress2;}
    if (data.shippingCity !== undefined) {updateData.shipping_city = data.shippingCity;}
    if (data.shippingState !== undefined) {updateData.shipping_state = data.shippingState;}
    if (data.shippingZip !== undefined) {updateData.shipping_zip = data.shippingZip;}
    if (data.shippingCountry !== undefined) {updateData.shipping_country = data.shippingCountry;}
    if (data.useSeparateShipping !== undefined) {updateData.use_separate_shipping = data.useSeparateShipping;}

    // Contact
    if (data.phone !== undefined) {updateData.phone = data.phone;}
    if (data.email !== undefined) {updateData.email = data.email;}
    if (data.website !== undefined) {updateData.website = data.website;}

    // Tax
    if (data.taxId !== undefined) {updateData.tax_id = data.taxId;}
    if (data.taxExempt !== undefined) {updateData.tax_exempt = data.taxExempt;}
    if (data.taxExemptNumber !== undefined) {updateData.tax_exempt_number = data.taxExemptNumber;}
    if (data.taxExemptExpiryAt !== undefined) {updateData.tax_exempt_expiry_at = data.taxExemptExpiryAt || null;}

    // Credit
    if (data.creditStatus !== undefined) {updateData.credit_status = data.creditStatus;}
    if (data.creditLimit !== undefined) {updateData.credit_limit = data.creditLimit;}
    if (data.openBalance !== undefined) {updateData.open_balance = data.openBalance;}
    if (data.creditTerms !== undefined) {updateData.credit_terms = data.creditTerms;}

    // Settings
    if (data.preferredLocationId !== undefined) {updateData.preferred_location_id = data.preferredLocationId;}
    if (data.defaultPaymentMethod !== undefined) {updateData.default_payment_method = data.defaultPaymentMethod;}
    if (data.status !== undefined) {updateData.status = data.status;}
    if (data.internalNotes !== undefined) {updateData.internal_notes = data.internalNotes;}

    const { data: result, error } = await db
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`);
    }

    return this.mapToCustomer(result as DbCustomer);
  }

  /**
   * Soft delete a customer
   */
  async softDelete(id: string, userId?: string): Promise<Customer> {
    const { data, error } = await db
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete customer: ${error.message}`);
    }

    return this.mapToCustomer(data as DbCustomer);
  }

  /**
   * Restore a soft-deleted customer
   */
  async restore(id: string, userId?: string): Promise<Customer> {
    const { data, error } = await db
      .from('customers')
      .update({
        deleted_at: null,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to restore customer: ${error.message}`);
    }

    return this.mapToCustomer(data as DbCustomer);
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToCustomer(data: DbCustomer): Customer {
    return {
      id: data.id,
      customerCode: data.customer_code,
      name: data.name,
      legalName: data.legal_name,
      channel: data.channel as Customer['channel'],

      // Billing Address
      address1: data.address_1,
      address2: data.address_2,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,

      // Shipping Address
      shippingAddress1: data.shipping_address_1,
      shippingAddress2: data.shipping_address_2,
      shippingCity: data.shipping_city,
      shippingState: data.shipping_state,
      shippingZip: data.shipping_zip,
      shippingCountry: data.shipping_country,
      useSeparateShipping: data.use_separate_shipping,

      // Contact
      phone: data.phone,
      email: data.email,
      website: data.website,

      // Tax
      taxId: data.tax_id,
      taxExempt: data.tax_exempt,
      taxExemptNumber: data.tax_exempt_number,
      taxExemptExpiryAt: data.tax_exempt_expiry_at,

      // Credit
      creditStatus: data.credit_status as Customer['creditStatus'],
      creditLimit: data.credit_limit,
      openBalance: data.open_balance,
      creditTerms: data.credit_terms,

      // Settings
      preferredLocationId: data.preferred_location_id,
      defaultPaymentMethod: data.default_payment_method,
      status: data.status as Customer['status'],
      internalNotes: data.internal_notes,

      // Audit
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,

      // QuickBooks Sync (handle missing columns for backwards compatibility)
      qboCustomerId: data.qbo_customer_id ?? null,
      qboRealmId: data.qbo_realm_id ?? null,
      qboSyncedAt: data.qbo_synced_at ? new Date(data.qbo_synced_at) : null,
      qboSyncError: data.qbo_sync_error ?? null,

      // Pipedrive Sync
      pipedrivePersonId: data.pipedrive_person_id ?? null,
      pipedriveDealId: data.pipedrive_deal_id ?? null,
      pipedriveOrgId: data.pipedrive_org_id ?? null,
    };
  }

  // ==========================================
  // QBO SYNC METHODS
  // ==========================================

  /**
   * Update QBO sync fields for a customer
   */
  async updateQboSync(
    id: string,
    qboCustomerId: string,
    qboRealmId: string
  ): Promise<void> {
    const { error } = await db
      .from('customers')
      .update({
        qbo_customer_id: qboCustomerId,
        qbo_realm_id: qboRealmId,
        qbo_synced_at: new Date().toISOString(),
        qbo_sync_error: null,
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update QBO sync: ${error.message}`);
    }
  }

  /**
   * Update QBO sync error for a customer
   */
  async updateQboSyncError(id: string, errorMessage: string): Promise<void> {
    const { error } = await db
      .from('customers')
      .update({
        qbo_sync_error: errorMessage,
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update QBO sync error: ${error.message}`);
    }
  }

  /**
   * Find customer by QBO Customer ID
   */
  async findByQboCustomerId(qboCustomerId: string, qboRealmId: string): Promise<Customer | null> {
    const { data, error } = await db
      .from('customers')
      .select('*')
      .eq('qbo_customer_id', qboCustomerId)
      .eq('qbo_realm_id', qboRealmId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch customer by QBO ID: ${error.message}`);
    }

    if (!data) {return null;}

    return this.mapToCustomer(data as DbCustomer);
  }

  private mapToListItem(data: {
    id: string;
    customer_code: string;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    channel: string;
    status: string;
    credit_status: string;
    credit_limit: number;
    open_balance: number;
    created_at: string;
  }): CustomerListItem {
    return {
      id: data.id,
      customerCode: data.customer_code,
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      channel: data.channel as CustomerListItem['channel'],
      status: data.status as CustomerListItem['status'],
      creditStatus: data.credit_status as CustomerListItem['creditStatus'],
      creditLimit: data.credit_limit,
      openBalance: data.open_balance,
      createdAt: new Date(data.created_at),
    };
  }
}

export const customerRepository = new CustomerRepositoryImpl();
export type CustomerRepository = typeof customerRepository;
