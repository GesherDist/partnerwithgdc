/**
 * Locations Service
 *
 * Business logic layer for Locations module.
 * Handles validation, business rules, and orchestration.
 */

import { locationRepository } from '../repositories/location.repository';
import { createLocationSchema, updateLocationSchema, formatAddress, type CreateLocationInput, type UpdateLocationInput } from '../lib/schemas';
import { auditService } from '@/shared/lib/audit';
import type { Location, LocationListParams, LocationWithFormattedAddress, LocationTableRow } from '../types';

// Helper to convert location to audit data
function locationToAuditData(location: Location): Record<string, unknown> {
  return {
    id: location.id,
    locationCode: location.locationCode,
    name: location.name,
    locationType: location.locationType,
    address1: location.address1,
    city: location.city,
    state: location.state,
    zip: location.zip,
    country: location.country,
    isActive: location.isActive,
    isDefault: location.isDefault,
  };
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

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Add formatted address to location
 */
function withFormattedAddress(location: Location): LocationWithFormattedAddress {
  const formattedAddress = formatAddress(location);
  const fullAddress = [
    location.address1,
    location.address2,
    location.city,
    location.state,
    location.zip,
    location.country,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    ...location,
    formattedAddress,
    fullAddress,
  };
}

/**
 * Convert location to table row format
 */
function toTableRow(location: Location): LocationTableRow {
  return {
    id: location.id,
    locationCode: location.locationCode,
    name: location.name,
    locationType: location.locationType,
    city: location.city,
    state: location.state,
    contactName: location.contactName,
    contactPhone: location.contactPhone,
    isActive: location.isActive,
    isDefault: location.isDefault,
    createdAt: location.createdAt,
  };
}

// ============================================
// SERVICE
// ============================================

export const locationService = {
  /**
   * Get paginated list of locations
   */
  async list(params: LocationListParams = {}): Promise<ServiceResult<{
    data: LocationTableRow[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>> {
    try {
      const result = await locationRepository.findMany(params);

      return {
        success: true,
        data: {
          data: result.data.map(toTableRow),
          meta: result.meta,
        },
      };
    } catch (error) {
      console.error('LocationService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch locations',
      };
    }
  },

  /**
   * Get a single location by ID
   */
  async getById(id: string): Promise<ServiceResult<LocationWithFormattedAddress>> {
    try {
      const location = await locationRepository.findById(id);

      if (!location) {
        return {
          success: false,
          error: 'Location not found',
        };
      }

      return {
        success: true,
        data: withFormattedAddress(location),
      };
    } catch (error) {
      console.error('LocationService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch location',
      };
    }
  },

  /**
   * Get a single location by code
   */
  async getByCode(locationCode: string): Promise<ServiceResult<LocationWithFormattedAddress>> {
    try {
      const location = await locationRepository.findByCode(locationCode);

      if (!location) {
        return {
          success: false,
          error: 'Location not found',
        };
      }

      return {
        success: true,
        data: withFormattedAddress(location),
      };
    } catch (error) {
      console.error('LocationService.getByCode error:', error);
      return {
        success: false,
        error: 'Failed to fetch location',
      };
    }
  },

  /**
   * Get the default location
   */
  async getDefault(): Promise<ServiceResult<Location | null>> {
    try {
      const location = await locationRepository.getDefault();
      return {
        success: true,
        data: location,
      };
    } catch (error) {
      console.error('LocationService.getDefault error:', error);
      return {
        success: false,
        error: 'Failed to fetch default location',
      };
    }
  },

  /**
   * Get all active locations (for dropdowns)
   */
  async getActiveLocations(): Promise<ServiceResult<Location[]>> {
    try {
      const locations = await locationRepository.getActiveLocations();
      return {
        success: true,
        data: locations,
      };
    } catch (error) {
      console.error('LocationService.getActiveLocations error:', error);
      return {
        success: false,
        error: 'Failed to fetch active locations',
      };
    }
  },

  /**
   * Create a new location
   */
  async create(input: CreateLocationInput, userId?: string): Promise<ServiceResult<Location>> {
    try {
      // Validate input
      const validation = createLocationSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const data = validation.data;

      // Check if location code already exists
      const codeExists = await locationRepository.codeExists(data.locationCode);
      if (codeExists) {
        return {
          success: false,
          error: 'Location code already exists',
          errors: { locationCode: ['A location with this code already exists'] },
        };
      }

      // Create location
      const location = await locationRepository.create(data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'locations',
        'Location',
        location.id,
        locationToAuditData(location),
        { userId },
        `Created location: ${location.name} (${location.locationCode})`
      ).catch((err) => {
        console.error('Failed to log location create audit:', err);
      });

      return {
        success: true,
        data: location,
      };
    } catch (error) {
      console.error('LocationService.create error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create location',
      };
    }
  },

  /**
   * Update an existing location
   */
  async update(id: string, input: UpdateLocationInput, userId?: string): Promise<ServiceResult<Location>> {
    try {
      // Check if location exists
      const existing = await locationRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Location not found',
        };
      }

      // Validate input
      const validation = updateLocationSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const data = validation.data;

      // Check if location code already exists (if changing)
      if (data.locationCode && data.locationCode !== existing.locationCode) {
        const codeExists = await locationRepository.codeExists(data.locationCode, id);
        if (codeExists) {
          return {
            success: false,
            error: 'Location code already exists',
            errors: { locationCode: ['A location with this code already exists'] },
          };
        }
      }

      // Capture old data for audit before update
      const oldAuditData = locationToAuditData(existing);

      // Update location
      const location = await locationRepository.update(id, data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'locations',
        'Location',
        location.id,
        oldAuditData,
        locationToAuditData(location),
        { userId },
        `Updated location: ${location.name} (${location.locationCode})`
      ).catch((err) => {
        console.error('Failed to log location update audit:', err);
      });

      return {
        success: true,
        data: location,
      };
    } catch (error) {
      console.error('LocationService.update error:', error);
      return {
        success: false,
        error: 'Failed to update location',
      };
    }
  },

  /**
   * Soft delete a location
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Location>> {
    try {
      // Check if location exists
      const existing = await locationRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Location not found',
        };
      }

      // Cannot delete default location
      if (existing.isDefault) {
        return {
          success: false,
          error: 'Cannot delete the default location. Set another location as default first.',
        };
      }

      // TODO: Check if location is used by any customers or orders (future phases)

      const location = await locationRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'locations',
        'Location',
        location.id,
        locationToAuditData(existing),
        { userId },
        `Deleted location: ${existing.name} (${existing.locationCode})`
      ).catch((err) => {
        console.error('Failed to log location delete audit:', err);
      });

      return {
        success: true,
        data: location,
      };
    } catch (error) {
      console.error('LocationService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete location',
      };
    }
  },

  /**
   * Restore a soft-deleted location
   */
  async restore(id: string, userId?: string): Promise<ServiceResult<Location>> {
    try {
      const location = await locationRepository.restore(id, userId);

      // Log audit event (fire and forget)
      auditService.logRestore(
        'locations',
        'Location',
        location.id,
        { userId },
        `Restored location: ${location.name} (${location.locationCode})`
      ).catch((err) => {
        console.error('Failed to log location restore audit:', err);
      });

      return {
        success: true,
        data: location,
      };
    } catch (error) {
      console.error('LocationService.restore error:', error);
      return {
        success: false,
        error: 'Failed to restore location',
      };
    }
  },

  /**
   * Get location counts by type
   */
  async getTypeCounts(): Promise<ServiceResult<Record<string, number>>> {
    try {
      const counts = await locationRepository.getCountsByType();
      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      console.error('LocationService.getTypeCounts error:', error);
      return {
        success: false,
        error: 'Failed to fetch type counts',
      };
    }
  },

  /**
   * Validate location code uniqueness
   */
  async validateCode(locationCode: string, excludeId?: string): Promise<ServiceResult<boolean>> {
    try {
      const exists = await locationRepository.codeExists(locationCode, excludeId);
      return {
        success: true,
        data: !exists,
      };
    } catch (error) {
      console.error('LocationService.validateCode error:', error);
      return {
        success: false,
        error: 'Failed to validate location code',
      };
    }
  },

  /**
   * Get next auto-generated location code
   */
  async getNextCode(): Promise<ServiceResult<string>> {
    try {
      const code = await locationRepository.getNextLocationCode();
      return {
        success: true,
        data: code,
      };
    } catch (error) {
      console.error('LocationService.getNextCode error:', error);
      return {
        success: false,
        error: 'Failed to generate location code',
      };
    }
  },

  /**
   * Create a new location with auto-generated code
   */
  async createWithAutoCode(
    input: Omit<CreateLocationInput, 'locationCode'>,
    userId?: string
  ): Promise<ServiceResult<Location>> {
    try {
      // Auto-generate location code
      const locationCode = await locationRepository.getNextLocationCode();

      // Create with auto-generated code
      return this.create({ ...input, locationCode }, userId);
    } catch (error) {
      console.error('LocationService.createWithAutoCode error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create location',
      };
    }
  },
};

export type LocationService = typeof locationService;
