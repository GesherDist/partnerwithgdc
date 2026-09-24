/**
 * Users Module - Zod Validation Schemas
 */

import { z } from 'zod';

// ============================================
// BASE SCHEMAS
// ============================================

/**
 * User status enum
 */
export const userStatusSchema = z.enum([
  'active',
  'inactive',
  'suspended',
  'pending',
]);

/**
 * Email validation - stored lowercase so the unique index behaves predictably
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .max(255, 'Email must be 255 characters or less')
  .email('Enter a valid email address')
  .transform((val) => val.trim().toLowerCase());

/**
 * Name part validation (first / last name)
 */
export const nameSchema = z
  .string()
  .min(2, 'Must be at least 2 characters')
  .max(100, 'Must be 100 characters or less')
  .transform((val) => val.trim());

/**
 * Phone validation - optional, digits and common separators only
 */
export const phoneSchema = z
  .string()
  .max(20, 'Phone must be 20 characters or less')
  .regex(
    /^[0-9+\-()\s]*$/,
    'Phone may only contain digits, spaces, +, -, and ()'
  );

/**
 * Password validation for the Supabase Auth account.
 * Supabase itself enforces a 6-character floor; the rest is our own policy.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or less')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

/**
 * Role reference validation
 */
export const roleIdSchema = z.string().uuid('Select a valid role');

// ============================================
// CREATE USER SCHEMA
// ============================================

/**
 * A new user needs either a password (account is usable immediately) or
 * sendInvite (they set their own via the reset email). Refusing both would
 * create an account nobody can ever sign in to.
 */
export const createUserSchema = z
  .object({
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    phone: phoneSchema.optional().nullable(),
    roleId: roleIdSchema,
    supplierId: z.string().uuid().optional().nullable(),
    status: userStatusSchema.default('active'),
    password: passwordSchema.optional(),
    sendInvite: z.boolean().default(true),
  })
  .refine((data) => Boolean(data.password) || data.sendInvite, {
    message:
      'Set a password or enable the invite email so the user can sign in',
    path: ['password'],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ============================================
// UPDATE USER SCHEMA
// ============================================

export const updateUserSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema.optional().nullable(),
  avatarUrl: z
    .string()
    .url('Invalid avatar URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  roleId: roleIdSchema.optional(),
  supplierId: z.string().uuid().optional().nullable(),
  status: userStatusSchema.optional(),
  /** Optional new password - if provided, updates the user's auth password */
  password: passwordSchema.optional().or(z.literal('')),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ============================================
// CHANGE ROLE SCHEMA
// ============================================

export const changeUserRoleSchema = z.object({
  roleId: roleIdSchema,
});

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;

// ============================================
// RESET PASSWORD SCHEMA (admin-initiated)
// ============================================

export const adminResetPasswordSchema = z.object({
  password: passwordSchema,
});

export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

// ============================================
// FORM SCHEMA (for client-side forms)
// ============================================

/**
 * Create form - password is only required when the admin opts out of the invite
 */
export const createUserFormSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Enter a valid email address'),
    firstName: z
      .string()
      .min(2, 'First name must be at least 2 characters')
      .max(100, 'First name must be 100 characters or less'),
    lastName: z
      .string()
      .min(2, 'Last name must be at least 2 characters')
      .max(100, 'Last name must be 100 characters or less'),
    phone: z
      .string()
      .max(20, 'Phone must be 20 characters or less')
      .regex(
        /^[0-9+\-()\s]*$/,
        'Phone may only contain digits, spaces, +, -, and ()'
      )
      .optional()
      .or(z.literal('')),
    roleId: z.string().min(1, 'Role is required').uuid('Select a valid role'),
    supplierId: z.string().uuid().optional().or(z.literal('')),
    status: userStatusSchema,
    password: z.string().optional().or(z.literal('')),
    sendInvite: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.sendInvite) {
      return;
    }

    const result = passwordSchema.safeParse(data.password ?? '');
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: result.error.issues[0]?.message ?? 'Password is required',
      });
    }
  });

export type CreateUserFormInput = z.infer<typeof createUserFormSchema>;

/**
 * Edit form - no email (Auth flow), password is optional
 */
export const editUserFormSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must be 100 characters or less'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must be 100 characters or less'),
  phone: z
    .string()
    .max(20, 'Phone must be 20 characters or less')
    .regex(
      /^[0-9+\-()\s]*$/,
      'Phone may only contain digits, spaces, +, -, and ()'
    )
    .optional()
    .or(z.literal('')),
  roleId: z.string().min(1, 'Role is required').uuid('Select a valid role'),
  supplierId: z.string().uuid().optional().or(z.literal('')),
  status: userStatusSchema,
  /** Optional new password - leave empty to keep current password */
  password: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  // Only validate password if it's provided (not empty)
  if (data.password && data.password.length > 0) {
    const result = passwordSchema.safeParse(data.password);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: result.error.issues[0]?.message ?? 'Invalid password',
      });
    }
  }
});

export type EditUserFormInput = z.infer<typeof editUserFormSchema>;

// ============================================
// QUERY PARAMS SCHEMA
// ============================================

export const userListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: userStatusSchema.optional(),
  roleId: z.string().uuid().optional(),
  sortBy: z
    .enum([
      'firstName',
      'lastName',
      'email',
      'status',
      'lastLoginAt',
      'createdAt',
    ])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  /** Include soft-deleted users in the results */
  includeDeleted: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
});

export type UserListParamsInput = z.infer<typeof userListParamsSchema>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert create form values to API DTO
 */
export function createFormToDTO(values: CreateUserFormInput): CreateUserInput {
  return {
    email: values.email.trim().toLowerCase(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone ? values.phone.trim() : null,
    roleId: values.roleId,
    supplierId: values.supplierId && values.supplierId.length > 0 ? values.supplierId : null,
    status: values.status,
    password: values.sendInvite ? undefined : values.password || undefined,
    sendInvite: values.sendInvite,
  };
}

/**
 * Convert edit form values to API DTO
 */
export function editFormToDTO(values: EditUserFormInput): UpdateUserInput {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone ? values.phone.trim() : null,
    roleId: values.roleId,
    supplierId: values.supplierId && values.supplierId.length > 0 ? values.supplierId : null,
    status: values.status,
    // Only include password if provided (non-empty)
    password: values.password && values.password.length > 0 ? values.password : undefined,
  };
}

/**
 * Convert API data to edit form values
 */
export function userToFormValues(user: {
  firstName: string;
  lastName: string;
  phone: string | null;
  roleId: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
}): EditUserFormInput {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
    roleId: user.roleId || '',
    status: user.status,
  };
}
