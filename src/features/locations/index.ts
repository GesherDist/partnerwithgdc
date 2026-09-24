/**
 * Locations Module - Barrel Export
 *
 * Public API for the Locations module.
 */

// Types
export * from './types';

// Schemas
export * from './lib/schemas';

// Repository
export { locationRepository } from './repositories/location.repository';

// Service
export { locationService } from './services/location.service';

// Server Actions
export * from './actions';
