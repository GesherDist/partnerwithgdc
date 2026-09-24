/**
 * Supplier Contact Service
 *
 * Business logic for supplier contact management.
 */

import { supplierContactRepository } from '../repositories/supplier-contact.repository';
import type {
  SupplierContact,
  SupplierContactListItem,
  CreateSupplierContactDTO,
  UpdateSupplierContactDTO,
} from '../types';

// ============================================
// SERVICE RESULT TYPE
// ============================================

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// SERVICE
// ============================================

export const supplierContactService = {
  /**
   * Get all contacts for a supplier
   */
  async getContactsBySupplierId(supplierId: string): Promise<ServiceResult<SupplierContactListItem[]>> {
    try {
      const contacts = await supplierContactRepository.getBySupplierId(supplierId);
      return {
        success: true,
        data: contacts,
      };
    } catch (error) {
      console.error('SupplierContactService.getContactsBySupplierId error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contacts',
      };
    }
  },

  /**
   * Get a single contact by ID
   */
  async getContactById(id: string): Promise<ServiceResult<SupplierContact>> {
    try {
      const contact = await supplierContactRepository.getById(id);

      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }

      return {
        success: true,
        data: contact,
      };
    } catch (error) {
      console.error('SupplierContactService.getContactById error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contact',
      };
    }
  },

  /**
   * Create a new supplier contact
   */
  async createContact(
    dto: CreateSupplierContactDTO,
    userId?: string
  ): Promise<ServiceResult<SupplierContact>> {
    try {
      // Validation
      if (!dto.firstName || dto.firstName.trim().length === 0) {
        return {
          success: false,
          error: 'First name is required',
        };
      }

      if (!dto.lastName || dto.lastName.trim().length === 0) {
        return {
          success: false,
          error: 'Last name is required',
        };
      }

      if (dto.email && !this.isValidEmail(dto.email)) {
        return {
          success: false,
          error: 'Invalid email format',
        };
      }

      const contact = await supplierContactRepository.create(dto, userId);

      return {
        success: true,
        data: contact,
      };
    } catch (error) {
      console.error('SupplierContactService.createContact error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create contact',
      };
    }
  },

  /**
   * Update a supplier contact
   */
  async updateContact(
    id: string,
    dto: UpdateSupplierContactDTO,
    userId?: string
  ): Promise<ServiceResult<SupplierContact>> {
    try {
      // Check if contact exists
      const existing = await supplierContactRepository.getById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }

      // Validation
      if (dto.firstName !== undefined && dto.firstName.trim().length === 0) {
        return {
          success: false,
          error: 'First name cannot be empty',
        };
      }

      if (dto.lastName !== undefined && dto.lastName.trim().length === 0) {
        return {
          success: false,
          error: 'Last name cannot be empty',
        };
      }

      if (dto.email && !this.isValidEmail(dto.email)) {
        return {
          success: false,
          error: 'Invalid email format',
        };
      }

      const contact = await supplierContactRepository.update(id, dto, userId);

      return {
        success: true,
        data: contact,
      };
    } catch (error) {
      console.error('SupplierContactService.updateContact error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update contact',
      };
    }
  },

  /**
   * Delete a supplier contact
   */
  async deleteContact(id: string, userId?: string): Promise<ServiceResult<void>> {
    try {
      // Check if contact exists
      const existing = await supplierContactRepository.getById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }

      await supplierContactRepository.delete(id, userId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('SupplierContactService.deleteContact error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete contact',
      };
    }
  },

  /**
   * Get primary contact for a supplier
   */
  async getPrimaryContact(supplierId: string): Promise<ServiceResult<SupplierContact | null>> {
    try {
      const contact = await supplierContactRepository.getPrimaryContact(supplierId);
      return {
        success: true,
        data: contact,
      };
    } catch (error) {
      console.error('SupplierContactService.getPrimaryContact error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch primary contact',
      };
    }
  },

  // ----------------------------------------
  // HELPER METHODS
  // ----------------------------------------

  isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  },
};

export type SupplierContactService = typeof supplierContactService;
