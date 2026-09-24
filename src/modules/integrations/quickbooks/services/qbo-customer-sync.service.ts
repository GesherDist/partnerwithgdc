/**
 * QBO Customer Sync Service
 *
 * Handles syncing customers between our system and QuickBooks Online.
 * Creates/updates customers in QBO when customers are created/updated in our system.
 * Uses direct fields on customer table for sync tracking.
 */

import { getConnectionByProvider } from '@/modules/integrations/core';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';
import type { Customer } from '@/features/customers/types';
import type { AccountingCustomer } from '@/modules/integrations/core';
import { auditService } from '@/shared/lib/audit/audit-service';

// ============================================
// TYPES
// ============================================

interface SyncCustomerResult {
  success: boolean;
  qboCustomerId?: string;
  error?: string;
}

interface CustomerSyncData {
  customer: Customer;
  userId?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map our Customer to QBO AccountingCustomer format
 */
function mapCustomerToQboFormat(customer: Customer): AccountingCustomer {
  return {
    displayName: customer.name,
    companyName: customer.legalName || customer.name,
    email: customer.email || undefined,
    phone: customer.phone || undefined,
    billingAddress: customer.address1
      ? {
          line1: customer.address1,
          line2: customer.address2 || undefined,
          city: customer.city || undefined,
          state: customer.state || undefined,
          postalCode: customer.zip || undefined,
          country: customer.country || undefined,
        }
      : undefined,
    shippingAddress: customer.useSeparateShipping && customer.shippingAddress1
      ? {
          line1: customer.shippingAddress1,
          line2: customer.shippingAddress2 || undefined,
          city: customer.shippingCity || undefined,
          state: customer.shippingState || undefined,
          postalCode: customer.shippingZip || undefined,
          country: customer.shippingCountry || undefined,
        }
      : undefined,
    taxExempt: customer.taxExempt,
    metadata: {
      gesherCustomerCode: customer.customerCode,
      gesherCustomerId: customer.id,
    },
  };
}

/**
 * Get the active QBO connection and realm ID
 */
async function getQboConnection(): Promise<{
  connectionId: string;
  realmId: string;
} | null> {
  const connection = await getConnectionByProvider('quickbooks');

  if (!connection || connection.status !== 'connected') {
    return null;
  }

  if (!connection.external_account_id) {
    return null;
  }

  return {
    connectionId: connection.id,
    realmId: connection.external_account_id,
  };
}

// ============================================
// SYNC SERVICE
// ============================================

export const qboCustomerSyncService = {
  /**
   * Sync a single customer to QuickBooks
   * Called when a customer is created or updated
   */
  async syncCustomer(data: CustomerSyncData): Promise<SyncCustomerResult> {
    const { customer } = data;

    try {
      // Get QBO connection
      const qboConnection = await getQboConnection();

      if (!qboConnection) {
        console.log('No QBO connection available, skipping customer sync');

        // Log that sync was skipped (fire and forget)
        auditService.log({
          action: 'export',
          module: 'integrations',
          entityType: 'Customer',
          entityId: customer.id,
          description: `QuickBooks sync skipped: Not connected (Customer: ${customer.name})`,
          metadata: {
            integration: 'quickbooks',
            reason: 'not_connected',
            customerName: customer.name,
          },
        }).catch((err) => {
          console.error('Failed to log QBO skip audit:', err);
        });

        return {
          success: false,
          error: 'QuickBooks not connected',
        };
      }

      const { connectionId, realmId } = qboConnection;

      // Get customer repository
      const { customerRepository } = await import('@/features/customers/repositories/customer.repository');

      // Check if customer already has a QBO ID for this realm
      if (customer.qboCustomerId && customer.qboRealmId === realmId) {
        // Customer already synced - update in QBO
        return await this.updateCustomerInQbo(
          customer,
          connectionId,
          customerRepository
        );
      }

      // Create customer in QBO
      return await this.createCustomerInQbo(
        customer,
        connectionId,
        realmId,
        customerRepository
      );
    } catch (error) {
      console.error('QboCustomerSyncService.syncCustomer error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Create a new customer in QuickBooks
   */
  async createCustomerInQbo(
    customer: Customer,
    connectionId: string,
    realmId: string,
    customerRepository: { updateQboSync: (id: string, qboId: string, realmId: string) => Promise<void>; updateQboSyncError: (id: string, error: string) => Promise<void> }
  ): Promise<SyncCustomerResult> {
    try {
      // Map customer to QBO format
      const qboCustomer = mapCustomerToQboFormat(customer);

      // Create in QBO
      const result = await quickBooksProvider.createCustomer(
        connectionId,
        qboCustomer
      );

      if (!result.externalId) {
        throw new Error('QBO did not return a customer ID');
      }

      // Update customer with QBO sync info
      await customerRepository.updateQboSync(
        customer.id,
        result.externalId,
        realmId
      );

      console.log(
        `Customer ${customer.customerCode} synced to QBO with ID ${result.externalId}`
      );

      // Log audit event for QBO sync (fire and forget)
      auditService.log({
        action: 'export',
        module: 'integrations',
        entityType: 'Customer',
        entityId: customer.id,
        description: `Customer synced to QuickBooks: ${customer.customerCode} (QBO ID: ${result.externalId})`,
        metadata: {
          syncType: 'create',
          qboCustomerId: result.externalId,
          qboRealmId: realmId,
          integration: 'quickbooks',
        },
      }).catch((err) => {
        console.error('Failed to log QBO sync audit:', err);
      });

      return {
        success: true,
        qboCustomerId: result.externalId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create customer in QBO:', errorMessage);

      // Update customer with error
      await customerRepository.updateQboSyncError(customer.id, errorMessage);

      // Log audit event for sync failure (fire and forget)
      auditService.log({
        action: 'export',
        module: 'integrations',
        entityType: 'Customer',
        entityId: customer.id,
        description: `Failed to sync customer to QuickBooks: ${customer.customerCode}`,
        metadata: {
          syncType: 'create',
          error: errorMessage,
          integration: 'quickbooks',
        },
      }).catch((err) => {
        console.error('Failed to log QBO sync error audit:', err);
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Update an existing customer in QuickBooks
   */
  async updateCustomerInQbo(
    customer: Customer,
    connectionId: string,
    customerRepository: { updateQboSync: (id: string, qboId: string, realmId: string) => Promise<void>; updateQboSyncError: (id: string, error: string) => Promise<void> }
  ): Promise<SyncCustomerResult> {
    try {
      if (!customer.qboCustomerId || !customer.qboRealmId) {
        throw new Error('No QBO customer ID found');
      }

      // Map customer to QBO format
      const qboCustomer = mapCustomerToQboFormat(customer);

      // Update in QBO
      const result = await quickBooksProvider.updateCustomer(
        connectionId,
        customer.qboCustomerId,
        qboCustomer
      );

      // Update sync timestamp
      await customerRepository.updateQboSync(
        customer.id,
        customer.qboCustomerId,
        customer.qboRealmId
      );

      console.log(
        `Customer ${customer.customerCode} updated in QBO (ID: ${customer.qboCustomerId})`
      );

      // Log audit event for QBO sync (fire and forget)
      auditService.log({
        action: 'export',
        module: 'integrations',
        entityType: 'Customer',
        entityId: customer.id,
        description: `Customer updated in QuickBooks: ${customer.customerCode} (QBO ID: ${customer.qboCustomerId})`,
        metadata: {
          syncType: 'update',
          qboCustomerId: customer.qboCustomerId,
          qboRealmId: customer.qboRealmId,
          integration: 'quickbooks',
        },
      }).catch((err) => {
        console.error('Failed to log QBO sync audit:', err);
      });

      return {
        success: true,
        qboCustomerId: result.externalId || customer.qboCustomerId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to update customer in QBO:', errorMessage);

      // Update customer with error
      await customerRepository.updateQboSyncError(customer.id, errorMessage);

      // Log audit event for sync failure (fire and forget)
      auditService.log({
        action: 'export',
        module: 'integrations',
        entityType: 'Customer',
        entityId: customer.id,
        description: `Failed to update customer in QuickBooks: ${customer.customerCode}`,
        metadata: {
          syncType: 'update',
          qboCustomerId: customer.qboCustomerId,
          error: errorMessage,
          integration: 'quickbooks',
        },
      }).catch((err) => {
        console.error('Failed to log QBO sync error audit:', err);
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Get sync status for a customer
   */
  async getSyncStatus(customerId: string): Promise<{
    synced: boolean;
    qboCustomerId: string | null;
    qboRealmId: string | null;
    qboSyncedAt: Date | null;
    qboSyncError: string | null;
  } | null> {
    try {
      const { customerRepository } = await import('@/features/customers/repositories/customer.repository');
      const customer = await customerRepository.findById(customerId);

      if (!customer) {
        return null;
      }

      return {
        synced: !!customer.qboCustomerId,
        qboCustomerId: customer.qboCustomerId,
        qboRealmId: customer.qboRealmId,
        qboSyncedAt: customer.qboSyncedAt,
        qboSyncError: customer.qboSyncError,
      };
    } catch (error) {
      console.error('Failed to get customer sync status:', error);
      return null;
    }
  },

  /**
   * Get QBO customer ID for a synced customer
   */
  async getQboCustomerId(customerId: string): Promise<string | null> {
    try {
      const { customerRepository } = await import('@/features/customers/repositories/customer.repository');
      const customer = await customerRepository.findById(customerId);
      return customer?.qboCustomerId || null;
    } catch (error) {
      console.error('Failed to get QBO customer ID:', error);
      return null;
    }
  },

  /**
   * Check if customer is synced to QBO
   */
  async isCustomerSynced(customerId: string): Promise<boolean> {
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      return false;
    }

    try {
      const { customerRepository } = await import('@/features/customers/repositories/customer.repository');
      const customer = await customerRepository.findById(customerId);
      return !!(customer?.qboCustomerId && customer?.qboRealmId === qboConnection.realmId);
    } catch (error) {
      console.error('Failed to check customer sync status:', error);
      return false;
    }
  },
};

export type QboCustomerSyncService = typeof qboCustomerSyncService;
