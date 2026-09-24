/**
 * Products Module - Barrel Export
 *
 * Public API for the Products module.
 */

// Types
export * from './types';

// Schemas
export * from './lib/schemas';

// Repository
export { productRepository } from './repositories/product.repository';

// Service
export { productService } from './services/product.service';

// Server Actions
export * from './actions';

// Hooks
export { useProducts, useProductCategories } from './hooks/use-products';
