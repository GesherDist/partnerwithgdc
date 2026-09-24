'use client';

/**
 * Change Role Dialog
 *
 * Focused dialog for reassigning a single user's role.
 * Kept separate from the edit form because granting a role is its own action
 * with its own permission - see PUT /api/users/[id]/role.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized callbacks with useCallback
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useRoles } from '@/features/roles/hooks/use-roles';

import { useChangeUserRole } from '../hooks/use-user-mutations';
import type { UserTableRow } from '../types';

// ============================================
// PROPS
// ============================================

interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserTableRow | null;
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

function ChangeRoleDialogComponent({
  open,
  onOpenChange,
  user,
  onSuccess,
}: ChangeRoleDialogProps) {
  // Only fetch roles when the dialog is open to avoid unnecessary API calls
  const { roles, loading: rolesLoading } = useRoles({ enabled: open });
  const { changeUserRole } = useChangeUserRole();
  const [roleId, setRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Preselect the role the user already has, so the dropdown opens on it
  useEffect(() => {
    if (!open || !user) {
      return;
    }

    const current = roles.find((role) => role.name === user.roleName);
    setRoleId(current?.id ?? '');
  }, [open, user, roles]);

  const handleSubmit = useCallback(async () => {
    if (!user || !roleId) {
      return;
    }

    try {
      setSubmitting(true);
      await changeUserRole(user.id, roleId);
      toast.success(`Role updated for ${user.fullName}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change role');
    } finally {
      setSubmitting(false);
    }
  }, [user, roleId, changeUserRole, onOpenChange, onSuccess]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            {user
              ? `Choose a new role for ${user.fullName}.`
              : 'Choose a new role for this user.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="change-role-select">Role</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id="change-role-select">
              <SelectValue placeholder={rolesLoading ? 'Loading roles…' : 'Select a role'} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || !roleId}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export memoized component
export const ChangeRoleDialog = memo(ChangeRoleDialogComponent);
