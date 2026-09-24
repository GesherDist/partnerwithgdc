/**
 * Repository Module
 *
 * Provides base service class and types for data access layer.
 */

// Types
export type {
  BaseEntity,
  PaginationOptions,
  PaginatedResult,
  FilterOperators,
  QueryOptions,
  FindManyOptions,
  CreateData,
  UpdateData,
  IRepository,
  TransactionClient,
} from './types';

// Base Service
export {
  BaseService,
  type BaseServiceConfig,
  type ServiceContext,
} from './base-service';
