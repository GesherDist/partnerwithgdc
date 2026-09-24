'use client';

/**
 * User Form Dialog
 *
 * Dialog for creating and editing users.
 *
 * Create and edit are deliberately different forms: creating also provisions a
 * Supabase Auth account (email + password/invite), while editing must not touch
 * either - both are separate, verified Auth flows.
 *
 * Performance Optimizations:
 * - Uses React.memo for sub-components
 * - Memoized callbacks with useCallback
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Label } from '@/shared/components/ui/label';
import { useRoles } from '@/features/roles/hooks/use-roles';

import { useCreateUser, useUpdateUser } from '../hooks/use-user-mutations';
import {
  createUserFormSchema,
  editUserFormSchema,
  createFormToDTO,
  editFormToDTO,
  type CreateUserFormInput,
  type EditUserFormInput,
} from '../lib/schemas';
import { USER_STATUS_OPTIONS, type UserTableRow, type UserWithRole } from '../types';

// ============================================
// PROPS
// ============================================

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when creating */
  user?: UserTableRow | UserWithRole | null;
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

function UserFormDialogComponent({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserFormDialogProps) {
  const isEditing = Boolean(user);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit User' : 'Create User'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update this user’s details and access.'
              : 'Create a user and their login account.'}
          </DialogDescription>
        </DialogHeader>

        {/* Remounting on open resets the form cleanly between rows */}
        {open &&
          (isEditing && user ? (
            <EditUserForm
              user={user}
              onDone={() => onOpenChange(false)}
              onSuccess={onSuccess}
            />
          ) : (
            <CreateUserForm onDone={() => onOpenChange(false)} onSuccess={onSuccess} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

// Export memoized component
export const UserFormDialog = memo(UserFormDialogComponent);

// ============================================
// CREATE FORM
// ============================================

interface FormProps {
  onDone: () => void;
  onSuccess?: () => void;
}

const CreateUserForm = memo(function CreateUserForm({ onDone, onSuccess }: FormProps) {
  const { roles, loading: rolesLoading } = useRoles();
  const { createUser } = useCreateUser();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateUserFormInput>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      roleId: '',
      status: 'active',
      password: '',
      sendInvite: true,
    },
  });

  const sendInvite = form.watch('sendInvite');

  const onSubmit = useCallback(async (values: CreateUserFormInput) => {
    try {
      setSubmitting(true);
      await createUser(createFormToDTO(values));
      toast.success(
        values.sendInvite
          ? `Invite sent to ${values.email}`
          : `User ${values.email} created`
      );
      onDone();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }, [createUser, onDone, onSuccess]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Jane" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Doe" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input {...field} type="email" placeholder="jane@company.com" />
              </FormControl>
              <FormDescription>
                This is the address they will sign in with. It cannot be changed here later.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input {...field} placeholder="+1 555 000 1234" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <RoleField control={form.control} roles={roles} loading={rolesLoading} />
          <StatusField control={form.control} />
        </div>

        <FormField
          control={form.control}
          name="sendInvite"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5 pr-4">
                <FormLabel>Send invite email</FormLabel>
                <FormDescription>
                  The user sets their own password. Turn this off to set one yourself.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {!sendInvite && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password *</FormLabel>
                <FormControl>
                  <Input {...field} type="password" autoComplete="new-password" />
                </FormControl>
                <FormDescription>
                  At least 8 characters, with an uppercase letter, a lowercase letter and a number.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormActions submitting={submitting} onCancel={onDone} submitLabel="Create User" />
      </form>
    </Form>
  );
});

// ============================================
// EDIT FORM
// ============================================

const EditUserForm = memo(function EditUserForm({
  user,
  onDone,
  onSuccess,
}: FormProps & { user: UserTableRow | UserWithRole }) {
  const { roles, loading: rolesLoading } = useRoles();
  const { updateUser } = useUpdateUser();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<EditUserFormInput>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      roleId: '',
      status: 'active',
      password: '',
    },
  });

  // The table row carries a display name and role name, not the raw columns the
  // form needs, so fetch the full record once the dialog is open.
  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const response = await fetch(`/api/users/${user.id}`);
      const data = await response.json();

      if (cancelled || !response.ok) {
        return;
      }

      const detail: UserWithRole = data.data;
      form.reset({
        firstName: detail.firstName,
        lastName: detail.lastName,
        phone: detail.phone || '',
        roleId: detail.roleId || '',
        status: detail.status,
        password: '', // Always empty - user enters new password only if changing
      });
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [user.id, form]);

  const onSubmit = useCallback(async (values: EditUserFormInput) => {
    try {
      setSubmitting(true);
      await updateUser(user.id, editFormToDTO(values));
      toast.success('User updated');
      onDone();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }, [updateUser, user.id, onDone, onSuccess]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user.email} disabled readOnly className="bg-muted" />
          <p className="text-sm text-muted-foreground">
            Changing an email has to go through a verified Auth flow, so it is not editable here.
          </p>
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <RoleField control={form.control} roles={roles} loading={rolesLoading} />
          <StatusField control={form.control} />
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input {...field} type="password" autoComplete="new-password" placeholder="Leave empty to keep current" />
              </FormControl>
              <FormDescription>
                Leave empty to keep the current password. Must be at least 8 characters with uppercase, lowercase, and number.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormActions submitting={submitting} onCancel={onDone} submitLabel="Save Changes" />
      </form>
    </Form>
  );
});

// ============================================
// SHARED FIELDS (Memoized)
// ============================================

interface RoleOption {
  id: string;
  name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const RoleField = memo(function RoleField({
  control,
  roles,
  loading,
}: {
  control: any;
  roles: RoleOption[];
  loading: boolean;
}) {
  return (
    <FormField
      control={control}
      name="roleId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Role *</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Loading roles…' : 'Select a role'} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

const StatusField = memo(function StatusField({ control }: { control: any }) {
  return (
    <FormField
      control={control}
      name="status"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Status *</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {USER_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

/* eslint-enable @typescript-eslint/no-explicit-any */

const FormActions = memo(function FormActions({
  submitting,
  onCancel,
  submitLabel,
}: {
  submitting: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 border-t pt-4">
      <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
});
