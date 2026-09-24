/**
 * Repository Types
 *
 * Common types for repository operations.
 */

/**
 * Base entity interface - all entities should have these fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Filter operators for queries
 */
export interface FilterOperators<T> {
  equals?: T;
  not?: T;
  in?: T[];
  notIn?: T[];
  lt?: T;
  lte?: T;
  gt?: T;
  gte?: T;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
}

/**
 * Common query options
 */
export interface QueryOptions {
  /** Include soft-deleted records */
  includeSoftDeleted?: boolean;
  /** Select specific fields */
  select?: Record<string, boolean>;
  /** Include relations */
  include?: Record<string, boolean | object>;
}

/**
 * Find many options
 */
export interface FindManyOptions<TFilter = Record<string, unknown>> extends QueryOptions, PaginationOptions {
  where?: TFilter;
}

/**
 * Create data type - omit auto-generated fields
 */
export type CreateData<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/**
 * Update data type - partial fields excluding id
 */
export type UpdateData<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

/**
 * Repository interface
 */
export interface IRepository<T extends BaseEntity, TCreate = CreateData<T>, TUpdate = UpdateData<T>> {
  findById(id: string, options?: QueryOptions): Promise<T | null>;
  findOne(where: Partial<T>, options?: QueryOptions): Promise<T | null>;
  findMany(options?: FindManyOptions): Promise<T[]>;
  findAll(options?: QueryOptions): Promise<T[]>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  delete(id: string): Promise<T>;
  hardDelete(id: string): Promise<T>;
  restore(id: string): Promise<T>;
  count(where?: Partial<T>): Promise<number>;
  exists(where: Partial<T>): Promise<boolean>;
  paginate(options?: FindManyOptions): Promise<PaginatedResult<T>>;
}

/**
 * Transaction client type
 */
export type TransactionClient = {
  $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
};
