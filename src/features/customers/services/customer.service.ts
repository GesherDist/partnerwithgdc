/**
 * Customer Service
 *
 * Business logic layer for Customer module.
 * Handles validation, business rules, and orchestration.
 */

import { customerRepository } from '../repositories/customer.repository';
import {
  createCustomerSchema,
  updateCustomerSchema,
  formToCreateDTO,
  formatCreditLimit,
  formatOpenBalance,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerFormInput,
} from '../lib/schemas';
import type {
  Customer,
  CustomerListItem,
  CustomerTableRow,
  CustomerListParams,
  CustomerStatus,
  CustomerAddresses,
  CustomerDropdownItem,
} from '../types';
import { auditService } from '@/shared/lib/audit';

// Helper to convert customer to audit data (exclude large/sensitive fields)
function customerToAuditData(customer: Customer): Record<string, unknown> {
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    channel: customer.channel,
    status: customer.status,
    creditStatus: customer.creditStatus,
    creditLimit: customer.creditLimit,
  };
}

// QBO Sync Service (lazy import to avoid circular dependencies)
let qboSyncModule: typeof import('@/modules/integrations/quickbooks') | null = null;

async function getQboSyncService() {
  if (!qboSyncModule) {
    qboSyncModule = await import('@/modules/integrations/quickbooks');
  }
  return qboSyncModule.qboCustomerSyncService;
}

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

interface PaginatedServiceResult<T> {
  success: boolean;
  data?: {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
  error?: string;
}

// ============================================
// SERVICE
// ============================================

export const customerService = {
  /**
   * Get paginated list of customers
   */
  async list(params: CustomerListParams = {}): Promise<PaginatedServiceResult<CustomerListItem>> {
    try {
      const result = await customerRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('CustomerService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch customers',
      };
    }
  },

  /**
   * Get paginated list of customers formatted for table display
   */
  async listForTable(params: CustomerListParams = {}): Promise<PaginatedServiceResult<CustomerTableRow>> {
    try {
      const result = await customerRepository.findMany(params);

      // Transform to table rows with formatted credit limit and open balance
      const tableRows: CustomerTableRow[] = result.data.map((customer) => ({
        id: customer.id,
        customerCode: customer.customerCode,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
        state: customer.state,
        channel: customer.channel,
        status: customer.status,
        creditStatus: customer.creditStatus,
        formattedCreditLimit: formatCreditLimit(customer.creditLimit),
        formattedOpenBalance: formatOpenBalance(customer.openBalance),
      }));

      return {
        success: true,
        data: {
          data: tableRows,
          meta: result.meta,
        },
      };
    } catch (error) {
      console.error('CustomerService.listForTable error:', error);
      return {
        success: false,
        error: 'Failed to fetch customers',
      };
    }
  },

  /**
   * Get a single customer by ID
   */
  async getById(id: string): Promise<ServiceResult<Customer>> {
    try {
      const customer = await customerRepository.findById(id);

      if (!customer) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      console.error('CustomerService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch customer',
      };
    }
  },

  /**
   * Get a single customer by code
   */
  async getByCode(code: string): Promise<ServiceResult<Customer>> {
    try {
      const customer = await customerRepository.findByCode(code);

      if (!customer) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      console.error('CustomerService.getByCode error:', error);
      return {
        success: false,
        error: 'Failed to fetch customer',
      };
    }
  },

  /**
   * Get next auto-generated customer code
   */
  async getNextCode(): Promise<ServiceResult<string>> {
    try {
      const code = await customerRepository.getNextCustomerCode();
      return {
        success: true,
        data: code,
      };
    } catch (error) {
      console.error('CustomerService.getNextCode error:', error);
      return {
        success: false,
        error: 'Failed to generate customer code',
      };
    }
  },

  /**
   * Create a new customer from form data
   * Customer code is auto-generated
   */
  async createFromForm(
    input: CustomerFormInput,
    userId?: string
  ): Promise<ServiceResult<Customer>> {
    try {
      // Auto-generate customer code
      const customerCode = await customerRepository.getNextCustomerCode();

      // Convert form data to DTO with auto-generated code
      const dto = formToCreateDTO({
        ...input,
        customerCode,
      });

      // Validate with schema
      const validation = createCustomerSchema.safeParse(dto);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check for duplicate email if provided
      if (dto.email) {
        const emailExists = await customerRepository.emailExists(dto.email);
        if (emailExists) {
          return {
            success: false,
            error: 'Email already exists',
            errors: { email: ['Email already exists'] },
          };
        }
      }

      // Create customer
      const customer = await customerRepository.create(validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'customers',
        'Customer',
        customer.id,
        customerToAuditData(customer),
        { userId },
        `Created customer: ${customer.customerCode} - ${customer.name}`
      ).catch((err) => {
        console.error('Failed to log customer create audit:', err);
      });

      // Sync to QuickBooks (fire and forget - don't block customer creation)
      this.syncCustomerToQbo(customer, userId).catch((err) => {
        console.error('Background QBO sync failed:', err);
      });

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      console.error('CustomerService.createFromForm error:', error);
      return {
        success: false,
        error: 'Failed to create customer',
      };
    }
  },

  /**
   * Create a new customer from DTO
   */
  async create(
    input: CreateCustomerInput,
    userId?: string
  ): Promise<ServiceResult<Customer>> {
    try {
      // Validate input
      const validation = createCustomerSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check for duplicate customer code
      const codeExists = await customerRepository.codeExists(input.customerCode);
      if (codeExists) {
        return {
          success: false,
          error: 'Customer code already exists',
          errors: { customerCode: ['Customer code already exists'] },
        };
      }

      // Check for duplicate email if provided
      if (input.email) {
        const emailExists = await customerRepository.emailExists(input.email);
        if (emailExists) {
          return {
            success: false,
            error: 'Email already exists',
            errors: { email: ['Email already exists'] },
          };
        }
      }

      // Create customer
      const customer = await customerRepository.create(validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'customers',
        'Customer',
        customer.id,
        customerToAuditData(customer),
        { userId },
        `Created customer: ${customer.customerCode} - ${customer.name}`
      ).catch((err) => {
        console.error('Failed to log customer create audit:', err);
      });

      // Sync to QuickBooks (fire and forget - don't block customer creation)
      this.syncCustomerToQbo(customer, userId).catch((err) => {
        console.error('Background QBO sync failed:', err);
      });

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      console.error('CustomerService.create error:', error);
      return {
        success: false,
        error: 'Failed to create customer',
      };
    }
  },

  /**
   * Update an existing customer
   */
  async update(
    id: string,
    input: UpdateCustomerInput,
    userId?: string
  ): Promise<ServiceResult<Customer>> {
    try {
      // Check if customer exists
      const existing = await customerRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      // Validate input
      const validation = updateCustomerSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check for duplicate customer code if changed
      if (input.customerCode && input.customerCode !== existing.customerCode) {
        const codeExists = await customerRepository.codeExists(input.customerCode, id);
        if (codeExists) {
          return {
            success: false,
            error: 'Customer code already exists',
            errors: { customerCode: ['Customer code already exists'] },
          };
        }
      }

      // Check for duplicate email if changed
      if (input.email && input.email !== existing.email) {
        const emailExists = await customerRepository.emailExists(input.email, id);
        if (emailExists) {
          return {
            success: false,
            error: 'Email already exists',
            errors: { email: ['Email already exists'] },
          };
        }
      }

      // Capture old data for audit before update
      const oldAuditData = customerToAuditData(existing);

      // Update customer
      const customer = await customerRepository.update(id, validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'customers',
        'Customer',
        customer.id,
        oldAuditData,
        customerToAuditData(customer),
        { userId },
        `Updated customer: ${customer.customerCode} - ${customer.name}`
      ).catch((err) => {
        console.error('Failed to log customer update audit:', err);
      });

      // Sync to QuickBooks (fire and forget - don't block customer update)
      this.syncCustomerToQbo(customer, userId).catch((err) => {
        console.error('Background QBO sync failed:', err);
      });

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      console.error('CustomerService.update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update customer';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Soft delete a customer
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Customer>> {
    try {
      // Check if customer exists
      const existing = await customerRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      // TODO: Check if customer has any active orders before allowing deletion
      // For now, we allow deletion regardless

      const customer = await customerRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'customers',
        'Customer',
        customer.id,
        customerToAuditData(existing),
        { userId },
        `Deleted customer: ${customer.customerCode} - ${customer.name}`
      ).catch((err) => {
        console.error('Failed to log customer delete audit:', err);
      });

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      console.error('CustomerService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete customer',
      };
    }
  },

  /**
   * Restore a soft-deleted customer
   */
  async restore(id: string, userId?: string): Promise<ServiceResult<Customer>> {
    try {
      const customer = await customerRepository.restore(id, userId);

      // Log audit event (fire and forget)
      auditService.logRestore(
        'customers',
        'Customer',
        customer.id,
        { userId },
        `Restored customer: ${customer.customerCode} - ${customer.name}`
      ).catch((err) => {
        console.error('Failed to log customer restore audit:', err);
      });

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      console.error('CustomerService.restore error:', error);
      return {
        success: false,
        error: 'Failed to restore customer',
      };
    }
  },

  // ==========================================
  // VALIDATION
  // ==========================================

  /**
   * Validate customer code uniqueness
   */
  async validateCode(
    code: string,
    excludeId?: string
  ): Promise<ServiceResult<boolean>> {
    try {
      const exists = await customerRepository.codeExists(code, excludeId);
      return {
        success: true,
        data: !exists, // true = valid (doesn't exist), false = invalid (exists)
      };
    } catch (error) {
      console.error('CustomerService.validateCode error:', error);
      return {
        success: false,
        error: 'Failed to validate customer code',
      };
    }
  },

  /**
   * Validate email uniqueness
   */
  async validateEmail(
    email: string,
    excludeId?: string
  ): Promise<ServiceResult<boolean>> {
    try {
      const exists = await customerRepository.emailExists(email, excludeId);
      return {
        success: true,
        data: !exists, // true = valid (doesn't exist), false = invalid (exists)
      };
    } catch (error) {
      console.error('CustomerService.validateEmail error:', error);
      return {
        success: false,
        error: 'Failed to validate email',
      };
    }
  },

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get customer counts by status
   */
  async getStatusCounts(): Promise<ServiceResult<Record<CustomerStatus, number>>> {
    try {
      const counts = await customerRepository.getCountsByStatus();
      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      console.error('CustomerService.getStatusCounts error:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
      };
    }
  },

  // ==========================================
  // ADDRESS HELPERS (for Sales Order integration)
  // ==========================================

  /**
   * Get customer addresses for auto-fill
   */
  async getAddresses(id: string): Promise<ServiceResult<CustomerAddresses>> {
    try {
      const addresses = await customerRepository.getAddresses(id);

      if (!addresses) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      return {
        success: true,
        data: addresses,
      };
    } catch (error) {
      console.error('CustomerService.getAddresses error:', error);
      return {
        success: false,
        error: 'Failed to fetch customer addresses',
      };
    }
  },

  // ==========================================
  // DROPDOWN DATA
  // ==========================================

  /**
   * Get customers for dropdown/select
   */
  async getForDropdown(): Promise<ServiceResult<CustomerDropdownItem[]>> {
    try {
      const customers = await customerRepository.findForDropdown();
      return {
        success: true,
        data: customers,
      };
    } catch (error) {
      console.error('CustomerService.getForDropdown error:', error);
      return {
        success: false,
        error: 'Failed to fetch customers for dropdown',
      };
    }
  },

  // ==========================================
  // QUICKBOOKS SYNC
  // ==========================================

  /**
   * Sync customer to QuickBooks
   * Called automatically after create/update
   */
  async syncCustomerToQbo(
    customer: Customer,
    userId?: string
  ): Promise<ServiceResult<{ qboCustomerId?: string }>> {
    try {
      const qboSyncService = await getQboSyncService();
      const result = await qboSyncService.syncCustomer({ customer, userId });

      if (result.success) {
        return {
          success: true,
          data: { qboCustomerId: result.qboCustomerId },
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to sync customer to QuickBooks',
      };
    } catch (error) {
      console.error('CustomerService.syncCustomerToQbo error:', error);
      return {
        success: false,
        error: 'Failed to sync customer to QuickBooks',
      };
    }
  },

  /**
   * Get QBO sync status for a customer
   */
  async getQboSyncStatus(customerId: string): Promise<ServiceResult<{
    synced: boolean;
    qboCustomerId?: string;
    lastSyncedAt?: Date;
    syncStatus?: string;
    lastError?: string;
  }>> {
    try {
      const qboSyncService = await getQboSyncService();
      const syncStatus = await qboSyncService.getSyncStatus(customerId);

      if (!syncStatus) {
        return {
          success: true,
          data: { synced: false },
        };
      }

      return {
        success: true,
        data: {
          synced: syncStatus.synced,
          qboCustomerId: syncStatus.qboCustomerId || undefined,
          lastSyncedAt: syncStatus.qboSyncedAt || undefined,
          syncStatus: syncStatus.synced ? 'synced' : (syncStatus.qboSyncError ? 'error' : 'pending'),
          lastError: syncStatus.qboSyncError || undefined,
        },
      };
    } catch (error) {
      console.error('CustomerService.getQboSyncStatus error:', error);
      return {
        success: false,
        error: 'Failed to get QBO sync status',
      };
    }
  },

  /**
   * Manually trigger QBO sync for a customer
   */
  async resyncCustomerToQbo(
    customerId: string,
    userId?: string
  ): Promise<ServiceResult<{ qboCustomerId?: string }>> {
    try {
      // Get customer data
      const customer = await customerRepository.findById(customerId);
      if (!customer) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      // Trigger sync
      return await this.syncCustomerToQbo(customer, userId);
    } catch (error) {
      console.error('CustomerService.resyncCustomerToQbo error:', error);
      return {
        success: false,
        error: 'Failed to resync customer to QuickBooks',
      };
    }
  },
};

export type CustomerService = typeof customerService;
