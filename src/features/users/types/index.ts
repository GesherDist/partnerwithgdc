/**
 * Users Module - TypeScript Types
 *
 * DTOs and types for the Users module
 */

/**
 * User status enum
 */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

// ============================================
// BASE TYPES
// ============================================

/**
 * User entity type (from database)
 */
export interface User {
  id: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  loginCount: number;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * The role summary embedded in a user record.
 * Only the fields the Users module needs - not the full Role entity.
 */
export interface UserRoleSummary {
  id: string;
  name: string;
  scope: 'user' | 'customer';
  isSystemRole: boolean;
  description: string | null;
}

/**
 * User joined with its role (what list and detail views actually render)
 */
export interface UserWithRole extends User {
  role: UserRoleSummary | null;
  fullName: string;
}

/**
 * Simple user list item for dropdown selections
 */
export interface UserListItem {
  id: string;
  fullName: string;
  email: string;
}

// ============================================
// DTO TYPES
// ============================================

/**
 * Create User DTO
 *
 * `password` provisions the Supabase Auth account so the user can log in.
 * When omitted, the user is created without a password and must set one
 * through the invite/reset email.
 */
export interface CreateUserDTO {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  roleId: string;
  status?: UserStatus;
  password?: string;
  sendInvite?: boolean;
}

/**
 * Update User DTO
 *
 * Email is intentionally absent - changing it has to go through Supabase Auth
 * as a separate, verified flow rather than a plain column update.
 */
export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  roleId?: string;
  status?: UserStatus;
}

/**
 * Change a single user's role
 */
export interface ChangeUserRoleDTO {
  roleId: string;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * User list query parameters
 */
export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  roleId?: string;
  sortBy?: UserSortField;
  sortOrder?: 'asc' | 'desc';
  /** Include soft-deleted users in the results */
  includeDeleted?: boolean;
}

/**
 * Columns the list may be sorted by
 */
export type UserSortField =
  'firstName' | 'lastName' | 'email' | 'status' | 'lastLoginAt' | 'createdAt';

/**
 * User list response
 */
export interface UserListResponse {
  data: UserWithRole[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// FORM TYPES
// ============================================

/**
 * User form values (for React Hook Form)
 */
export interface UserFormValues {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  roleId: string;
  status: UserStatus;
  password: string;
  sendInvite: boolean;
}

// ============================================
// TABLE TYPES
// ============================================

/**
 * User table row (for TanStack Table)
 */
export interface UserTableRow {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  roleName: string | null;
  roleScope: 'user' | 'customer' | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  /** Whether this user has been soft-deleted */
  isDeleted: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Single user API response
 */
export interface UserResponse {
  success: boolean;
  data: UserWithRole | null;
  error?: string;
}

/**
 * User list API response
 */
export interface UsersResponse {
  success: boolean;
  data: UserWithRole[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

/**
 * User counts by status (for the stat cards on the list page)
 */
export interface UserStatusCounts {
  active: number;
  inactive: number;
  suspended: number;
  pending: number;
  total: number;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * User status options for select inputs
 */
export const USER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending', label: 'Pending' },
] as const;

/**
 * Default user form values
 */
export const DEFAULT_USER_FORM_VALUES: UserFormValues = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  roleId: '',
  status: 'active',
  password: '',
  sendInvite: true,
};

/**
 * Build a display name from the two name columns
 */
export function buildFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Build avatar initials from the two name columns
 */
export function buildInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}
