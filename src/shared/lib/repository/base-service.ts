/**
 * Base Service
 *
 * Abstract service class providing common business logic operations.
 * Works with any repository that implements the IRepository interface.
 */

import { AppError, ValidationError, ErrorCodes } from '@/shared/lib/errors';
import { logger, type LogContext } from '@/shared/lib/logger';
import type {
  BaseEntity,
  QueryOptions,
  FindManyOptions,
  PaginatedResult,
  IRepository,
} from './types';

/**
 * Service context for operations
 */
export interface ServiceContext {
  /** Current user ID performing the action */
  userId?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Base Service Configuration
 */
export interface BaseServiceConfig {
  /** Service name for logging */
  serviceName: string;
}

/**
 * Base Service Class
 *
 * Provides common business logic operations.
 *
 * @template T - Entity type
 * @template TCreate - Create data type
 * @template TUpdate - Update data type
 * @template TRepo - Repository type (must implement IRepository)
 */
export abstract class BaseService<
  T extends BaseEntity,
  TCreate = Partial<T>,
  TUpdate = Partial<T>,
  TRepo extends IRepository<T, TCreate, TUpdate> = IRepository<T, TCreate, TUpdate>
> {
  protected readonly serviceName: string;
  protected readonly repository: TRepo;

  constructor(repository: TRepo, config: BaseServiceConfig) {
    this.repository = repository;
    this.serviceName = config.serviceName;
  }

  /**
   * Get log context with service info
   */
  protected getLogContext(ctx?: ServiceContext, extra?: LogContext): LogContext {
    return {
      service: this.serviceName,
      userId: ctx?.userId,
      requestId: ctx?.requestId,
      ...ctx?.metadata,
      ...extra,
    };
  }

  /**
   * Validate create data - override in subclasses
   */
  protected async validateCreate(data: TCreate, _ctx?: ServiceContext): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw ValidationError.field('data', 'Data is required');
    }
  }

  /**
   * Validate update data - override in subclasses
   */
  protected async validateUpdate(
    _id: string,
    data: TUpdate,
    _ctx?: ServiceContext
  ): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw ValidationError.field('data', 'Data is required');
    }
  }

  /**
   * Transform data before create - override in subclasses
   */
  protected async beforeCreate(
    data: TCreate,
    ctx?: ServiceContext
  ): Promise<TCreate> {
    // Add createdBy if context has userId
    if (ctx?.userId && typeof data === 'object' && data !== null) {
      return { ...data, createdBy: ctx.userId } as TCreate;
    }
    return data;
  }

  /**
   * Transform data before update - override in subclasses
   */
  protected async beforeUpdate(
    _id: string,
    data: TUpdate,
    ctx?: ServiceContext
  ): Promise<TUpdate> {
    // Add updatedBy if context has userId
    if (ctx?.userId && typeof data === 'object' && data !== null) {
      return { ...data, updatedBy: ctx.userId } as TUpdate;
    }
    return data;
  }

  /**
   * Hook after create - override in subclasses
   */
  protected async afterCreate(_entity: T, _ctx?: ServiceContext): Promise<void> {
    // Override in subclasses for audit logging, notifications, etc.
  }

  /**
   * Hook after update - override in subclasses
   */
  protected async afterUpdate(
    _entity: T,
    _previousData: T,
    _ctx?: ServiceContext
  ): Promise<void> {
    // Override in subclasses for audit logging, notifications, etc.
  }

  /**
   * Hook after delete - override in subclasses
   */
  protected async afterDelete(_entity: T, _ctx?: ServiceContext): Promise<void> {
    // Override in subclasses for audit logging, notifications, etc.
  }

  /**
   * Check if user can perform action - override in subclasses
   */
  protected async checkPermission(
    _action: 'create' | 'read' | 'update' | 'delete',
    _ctx?: ServiceContext,
    _resourceId?: string
  ): Promise<void> {
    // Override in subclasses for permission checks
  }

  /**
   * Find by ID
   */
  async findById(id: string, options?: QueryOptions, ctx?: ServiceContext): Promise<T | null> {
    await this.checkPermission('read', ctx, id);

    logger.debug(`${this.serviceName}.findById`, this.getLogContext(ctx, { id }));

    return this.repository.findById(id, options);
  }

  /**
   * Find by ID or throw error
   */
  async findByIdOrThrow(id: string, options?: QueryOptions, ctx?: ServiceContext): Promise<T> {
    await this.checkPermission('read', ctx, id);

    logger.debug(`${this.serviceName}.findByIdOrThrow`, this.getLogContext(ctx, { id }));

    const result = await this.repository.findById(id, options);
    if (!result) {
      throw new AppError(`${this.serviceName} not found`, ErrorCodes.NOT_FOUND);
    }
    return result;
  }

  /**
   * Find one by criteria
   */
  async findOne(
    where: Partial<T>,
    options?: QueryOptions,
    ctx?: ServiceContext
  ): Promise<T | null> {
    await this.checkPermission('read', ctx);

    logger.debug(`${this.serviceName}.findOne`, this.getLogContext(ctx, { where }));

    return this.repository.findOne(where, options);
  }

  /**
   * Find many
   */
  async findMany(options?: FindManyOptions, ctx?: ServiceContext): Promise<T[]> {
    await this.checkPermission('read', ctx);

    logger.debug(`${this.serviceName}.findMany`, this.getLogContext(ctx));

    return this.repository.findMany(options);
  }

  /**
   * Find all
   */
  async findAll(options?: QueryOptions, ctx?: ServiceContext): Promise<T[]> {
    await this.checkPermission('read', ctx);

    logger.debug(`${this.serviceName}.findAll`, this.getLogContext(ctx));

    return this.repository.findAll(options);
  }

  /**
   * Get paginated results
   */
  async paginate(
    options?: FindManyOptions,
    ctx?: ServiceContext
  ): Promise<PaginatedResult<T>> {
    await this.checkPermission('read', ctx);

    logger.debug(`${this.serviceName}.paginate`, this.getLogContext(ctx, { options }));

    return this.repository.paginate(options);
  }

  /**
   * Create a new entity
   */
  async create(data: TCreate, ctx?: ServiceContext): Promise<T> {
    await this.checkPermission('create', ctx);

    logger.info(`${this.serviceName}.create`, this.getLogContext(ctx));

    try {
      // Validate
      await this.validateCreate(data, ctx);

      // Transform
      const transformedData = await this.beforeCreate(data, ctx);

      // Create
      const entity = await this.repository.create(transformedData);

      // After hook
      await this.afterCreate(entity, ctx);

      logger.info(`${this.serviceName} created successfully`, this.getLogContext(ctx, { id: entity.id }));

      return entity;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`${this.serviceName}.create failed`, error as Error, this.getLogContext(ctx));
      throw error;
    }
  }

  /**
   * Update an entity
   */
  async update(id: string, data: TUpdate, ctx?: ServiceContext): Promise<T> {
    await this.checkPermission('update', ctx, id);

    logger.info(`${this.serviceName}.update`, this.getLogContext(ctx, { id }));

    try {
      // Get existing entity
      const existing = await this.findByIdOrThrow(id, undefined, ctx);

      // Validate
      await this.validateUpdate(id, data, ctx);

      // Transform
      const transformedData = await this.beforeUpdate(id, data, ctx);

      // Update
      const entity = await this.repository.update(id, transformedData);

      // After hook
      await this.afterUpdate(entity, existing, ctx);

      logger.info(`${this.serviceName} updated successfully`, this.getLogContext(ctx, { id }));

      return entity;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`${this.serviceName}.update failed`, error as Error, this.getLogContext(ctx, { id }));
      throw error;
    }
  }

  /**
   * Delete an entity (soft delete)
   */
  async delete(id: string, ctx?: ServiceContext): Promise<T> {
    await this.checkPermission('delete', ctx, id);

    logger.info(`${this.serviceName}.delete`, this.getLogContext(ctx, { id }));

    try {
      // Delete
      const entity = await this.repository.delete(id);

      // After hook
      await this.afterDelete(entity, ctx);

      logger.info(`${this.serviceName} deleted successfully`, this.getLogContext(ctx, { id }));

      return entity;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`${this.serviceName}.delete failed`, error as Error, this.getLogContext(ctx, { id }));
      throw error;
    }
  }

  /**
   * Hard delete an entity
   */
  async hardDelete(id: string, ctx?: ServiceContext): Promise<T> {
    await this.checkPermission('delete', ctx, id);

    logger.warn(`${this.serviceName}.hardDelete`, this.getLogContext(ctx, { id }));

    try {
      const entity = await this.repository.hardDelete(id);

      logger.warn(`${this.serviceName} hard deleted`, this.getLogContext(ctx, { id }));

      return entity;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`${this.serviceName}.hardDelete failed`, error as Error, this.getLogContext(ctx, { id }));
      throw error;
    }
  }

  /**
   * Restore a soft-deleted entity
   */
  async restore(id: string, ctx?: ServiceContext): Promise<T> {
    await this.checkPermission('update', ctx, id);

    logger.info(`${this.serviceName}.restore`, this.getLogContext(ctx, { id }));

    try {
      const entity = await this.repository.restore(id);

      logger.info(`${this.serviceName} restored successfully`, this.getLogContext(ctx, { id }));

      return entity;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`${this.serviceName}.restore failed`, error as Error, this.getLogContext(ctx, { id }));
      throw error;
    }
  }

  /**
   * Count entities
   */
  async count(where?: Partial<T>, ctx?: ServiceContext): Promise<number> {
    await this.checkPermission('read', ctx);

    return this.repository.count(where);
  }

  /**
   * Check if entity exists
   */
  async exists(where: Partial<T>, ctx?: ServiceContext): Promise<boolean> {
    await this.checkPermission('read', ctx);

    return this.repository.exists(where);
  }
}
