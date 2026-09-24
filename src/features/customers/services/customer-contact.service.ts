/**
 * Customer Contact Service
 *
 * Business logic layer for Customer Contact module.
 * Handles validation, business rules, and orchestration.
 */

import { customerContactRepository } from '../repositories/customer-contact.repository';
import { customerRepository } from '../repositories/customer.repository';
import {
  createCustomerContactSchema,
  updateCustomerContactSchema,
  type CreateCustomerContactInput,
  type UpdateCustomerContactInput,
} from '../lib/schemas';
import type {
  CustomerContact,
  CustomerContactListItem,
  CreateCustomerContactDTO,
  UpdateCustomerContactDTO,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// SERVICE
// ============================================

export const customerContactService = {
  /**
   * Get all contacts for a customer
   */
  async listByCustomer(customerId: string): Promise<ServiceResult<CustomerContactListItem[]>> {
    try {
      // Verify customer exists
      const customer = await customerRepository.findById(customerId);
      if (!customer) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      const contacts = await customerContactRepository.getByCustomerId(customerId);
      return {
        success: true,
        data: contacts,
      };
    } catch (error) {
      console.error('CustomerContactService.listByCustomer error:', error);
      return {
        success: false,
        error: 'Failed to fetch contacts',
      };
    }
  },

  /**
   * Get a single contact by ID
   */
  async getById(id: string): Promise<ServiceResult<CustomerContact>> {
    try {
      const contact = await customerContactRepository.getById(id);
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
      console.error('CustomerContactService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch contact',
      };
    }
  },

  /**
   * Get primary contact for a customer
   */
  async getPrimaryContact(customerId: string): Promise<ServiceResult<CustomerContact | null>> {
    try {
      const contact = await customerContactRepository.getPrimaryContact(customerId);
      return {
        success: true,
        data: contact,
      };
    } catch (error) {
      console.error('CustomerContactService.getPrimaryContact error:', error);
      return {
        success: false,
        error: 'Failed to fetch primary contact',
      };
    }
  },

  /**
   * Create a new contact
   */
  async create(
    input: CreateCustomerContactInput,
    userId?: string
  ): Promise<ServiceResult<CustomerContact>> {
    try {
      // Validate input
      const validation = createCustomerContactSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Verify customer exists
      const customer = await customerRepository.findById(input.customerId);
      if (!customer) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      // Convert to DTO
      const dto: CreateCustomerContactDTO = {
        customerId: validation.data.customerId,
        firstName: validation.data.firstName,
        lastName: validation.data.lastName,
        contactType: validation.data.contactType,
        email: validation.data.email || null,
        phone: validation.data.phone || null,
        mobile: validation.data.mobile || null,
      };

      const contact = await customerContactRepository.create(dto, userId);

      return {
        success: true,
        data: contact,
      };
    } catch (error) {
      console.error('CustomerContactService.create error:', error);
      return {
        success: false,
        error: 'Failed to create contact',
      };
    }
  },

  /**
   * Update an existing contact
   */
  async update(
    id: string,
    input: UpdateCustomerContactInput,
    userId?: string
  ): Promise<ServiceResult<CustomerContact>> {
    try {
      // Check if contact exists
      const existing = await customerContactRepository.getById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }

      // Validate input
      const validation = updateCustomerContactSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Convert to DTO
      const dto: UpdateCustomerContactDTO = {};
      if (validation.data.firstName !== undefined) {dto.firstName = validation.data.firstName;}
      if (validation.data.lastName !== undefined) {dto.lastName = validation.data.lastName;}
      if (validation.data.contactType !== undefined) {dto.contactType = validation.data.contactType;}
      if (validation.data.email !== undefined) {dto.email = validation.data.email;}
      if (validation.data.phone !== undefined) {dto.phone = validation.data.phone;}
      if (validation.data.mobile !== undefined) {dto.mobile = validation.data.mobile;}

      const contact = await customerContactRepository.update(id, dto, userId);

      return {
        success: true,
        data: contact,
      };
    } catch (error) {
      console.error('CustomerContactService.update error:', error);
      return {
        success: false,
        error: 'Failed to update contact',
      };
    }
  },

  /**
   * Soft delete a contact
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<void>> {
    try {
      // Check if contact exists
      const existing = await customerContactRepository.getById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }

      await customerContactRepository.delete(id, userId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('CustomerContactService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete contact',
      };
    }
  },
};

export type CustomerContactService = typeof customerContactService;
