'use client';

/**
 * Roles Page Content
 *
 * Client component for roles management with dynamic data.
 * Grid-based card layout for roles with inline permissions editor.
 *
 * Performance Optimizations:
 * - Uses React.memo for sub-components
 * - Memoized callbacks with useCallback
 * - Memoized computed values with useMemo
 */

import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/shared/components/layout';
import { refreshProfileCache } from '@/shared/lib/auth/actions';
import {
  Card,
  CardContent,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Switch } from '@/shared/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Key, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useRoles,
  useRole,
  useHierarchicalPermissions,
  useDeleteRole,
} from '@/features/roles/hooks';
import { useUpdateRole } from '@/features/roles/hooks/use-role-mutations';
import { RoleFormDialog } from '@/features/roles/components';
import type { RoleListItem, HierarchicalPermission, HierarchicalPermissionGroup } from '@/features/roles/types';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/stores';

// ============================================
// ROLE CARD COMPONENT (Memoized)
// ============================================

interface RoleCardProps {
  role: RoleListItem;
  isSelected: boolean;
  onCardClick: (role: RoleListItem) => void;
  onEditClick?: (role: RoleListItem) => void;
  onDeleteClick?: (role: RoleListItem, e: React.MouseEvent) => void;
}

const RoleCard = memo(function RoleCard({
  role,
  isSelected,
  onCardClick,
  onEditClick,
  onDeleteClick,
}: RoleCardProps) {
  const handleCardClick = useCallback(() => {
    onCardClick(role);
  }, [onCardClick, role]);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick?.(role);
  }, [onEditClick, role]);

  const handleDeleteClickInternal = useCallback((e: React.MouseEvent) => {
    onDeleteClick?.(role, e);
  }, [onDeleteClick, role]);

  // Don't show actions for system roles
  const hasActions = !role.isSystemRole && (onEditClick || onDeleteClick);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        {/* Header Row - Name, Scope & Actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">
              {role.name}
            </h3>
            <Badge
              variant="outline"
              className={cn(
                'text-xs capitalize',
                role.scope === 'user' && 'bg-blue-50 text-blue-700 border-blue-200',
                role.scope === 'customer' && 'bg-purple-50 text-purple-700 border-purple-200',
                role.scope === 'supplier' && 'bg-emerald-50 text-emerald-700 border-emerald-200'
              )}
            >
              {role.scope}
            </Badge>
            {role.isSystemRole && (
              <Badge
                variant="outline"
                className="text-xs bg-amber-50 text-amber-700 border-amber-200"
              >
                System
              </Badge>
            )}
          </div>
          {hasActions && (
            <div className="flex items-center gap-1">
              {onEditClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={handleEditClick}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDeleteClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={handleDeleteClickInternal}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {role.description || 'No description'}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{role.userCount}</span>
            {' '}Users
          </span>
          <span>
            <span className="font-medium text-foreground">{role.permissionCount}</span>
            {' '}Permissions
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================
// HIERARCHICAL PERMISSION ROW COMPONENT (Memoized)
// ============================================

interface HierarchicalPermissionRowProps {
  permission: HierarchicalPermission;
  depth: number;
  selectedRolePermissionIds: Set<string>;
  isUpdating: boolean;
  onToggle: (permission: HierarchicalPermission, isEnabled: boolean) => void;
}

const HierarchicalPermissionRow = memo(function HierarchicalPermissionRow({
  permission,
  depth,
  selectedRolePermissionIds,
  isUpdating,
  onToggle,
}: HierarchicalPermissionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default
  const isEnabled = selectedRolePermissionIds.has(permission.id);
  const hasChildren = permission.children.length > 0;

  const handleToggle = useCallback((checked: boolean) => {
    onToggle(permission, checked);
  }, [onToggle, permission]);

  // Calculate enabled count for children
  const childStats = useMemo(() => {
    const countAll = (perms: HierarchicalPermission[]): { enabled: number; total: number } => {
      let enabled = 0;
      let total = 0;
      for (const p of perms) {
        total++;
        if (selectedRolePermissionIds.has(p.id)) { enabled++; }
        if (p.children.length > 0) {
          const childCounts = countAll(p.children);
          enabled += childCounts.enabled;
          total += childCounts.total;
        }
      }
      return { enabled, total };
    };
    return countAll(permission.children);
  }, [permission.children, selectedRolePermissionIds]);

  const paddingLeft = 16 + (depth * 24); // Base padding + depth indentation

  const handleRowClick = useCallback(() => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  }, [hasChildren, isExpanded]);

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors border-b last:border-b-0",
          depth === 0 && "bg-muted/20",
          hasChildren && "cursor-pointer"
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleRowClick}
      >
        <div className="flex items-center gap-3">
          {hasChildren && (
            <div className="p-1">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )}
          {!hasChildren && <div className="w-5" />}
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={isUpdating}
              className="data-[state=checked]:bg-green-500"
            />
          </div>
          <div>
            <p className={cn("text-sm", depth === 0 ? "font-semibold" : "font-medium")}>
              {permission.description || permission.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChildren && (
            <Badge
              variant="secondary"
              className={cn(
                'text-xs',
                childStats.enabled === childStats.total && childStats.total > 0
                  ? 'bg-green-100 text-green-700'
                  : childStats.enabled > 0
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {childStats.enabled}/{childStats.total}
            </Badge>
          )}
        </div>
      </div>
      {/* Render children recursively */}
      {hasChildren && isExpanded && (
        <>
          {permission.children.map((child) => (
            <HierarchicalPermissionRow
              key={child.id}
              permission={child}
              depth={depth + 1}
              selectedRolePermissionIds={selectedRolePermissionIds}
              isUpdating={isUpdating}
              onToggle={onToggle}
            />
          ))}
        </>
      )}
    </>
  );
});

// ============================================
// PERMISSION MODULE COMPONENT (Memoized)
// ============================================

interface PermissionModuleProps {
  group: HierarchicalPermissionGroup;
  counts: { enabled: number; total: number };
  isExpanded: boolean;
  selectedRolePermissionIds: Set<string>;
  isUpdating: boolean;
  onToggleModule: (module: string) => void;
  onPermissionToggle: (permission: HierarchicalPermission, isEnabled: boolean) => void;
}

const PermissionModule = memo(function PermissionModule({
  group,
  counts,
  isExpanded,
  selectedRolePermissionIds,
  isUpdating,
  onToggleModule,
  onPermissionToggle,
}: PermissionModuleProps) {
  const handleToggle = useCallback(() => {
    onToggleModule(group.groupName);
  }, [onToggleModule, group.groupName]);

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={handleToggle}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-amber-500" />
                <span className="font-medium capitalize">{group.groupName}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    counts.enabled === counts.total && counts.total > 0
                      ? 'bg-green-100 text-green-700'
                      : counts.enabled > 0
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {counts.enabled}/{counts.total}
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {group.permissions.map((permission) => (
              <HierarchicalPermissionRow
                key={permission.id}
                permission={permission}
                depth={0}
                selectedRolePermissionIds={selectedRolePermissionIds}
                isUpdating={isUpdating}
                onToggle={onPermissionToggle}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

function RolesPageContentComponent() {
  const router = useRouter();
  const { hasPermission } = useAuthStore();

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canCreate = hasMounted && hasPermission('roles.create');
  const canEdit = hasMounted && hasPermission('roles.edit');
  const canDelete = hasMounted && hasPermission('roles.delete');
  const canUpdatePermission = hasMounted && hasPermission('roles.update_permission');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null); // Separate state for dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleListItem | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Track original permissions when role is selected
  const [originalPermissionIds, setOriginalPermissionIds] = useState<Set<string>>(new Set());
  // Track current (modified) permissions locally
  const [pendingPermissionIds, setPendingPermissionIds] = useState<Set<string>>(new Set());

  const { roles, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = useRoles();

  // Auto-select first role (super_admin) on initial load
  useEffect(() => {
    const firstRole = roles[0];
    if (!hasAutoSelected && !rolesLoading && roles.length > 0 && firstRole && !selectedRoleId) {
      setSelectedRoleId(firstRole.id);
      setHasAutoSelected(true);
    }
  }, [roles, rolesLoading, hasAutoSelected, selectedRoleId]);

  const { role: selectedRole, loading: roleLoading, refetch: refetchRole } = useRole(selectedRoleId);
  const { role: editingRole } = useRole(editingRoleId); // For dialog

  // Find selected role from list to get scope
  const selectedRoleFromList = roles.find(r => r.id === selectedRoleId);

  // Fetch permissions filtered by role's scope
  const { permissions: permissionGroups, loading: permissionsLoading } = useHierarchicalPermissions({
    permissionType: selectedRoleFromList?.scope,
    enabled: !!selectedRoleFromList,
  });
  const { deleteRole, loading: deletingRole } = useDeleteRole();
  const { updateRole, loading: updatingRole } = useUpdateRole();

  // Sync original and pending state when role changes or loads
  useEffect(() => {
    if (selectedRole?.permissions) {
      const permIds = new Set(selectedRole.permissions.map(p => p.id));
      setOriginalPermissionIds(permIds);
      setPendingPermissionIds(new Set(permIds));
    } else {
      setOriginalPermissionIds(new Set());
      setPendingPermissionIds(new Set());
    }
  }, [selectedRole]);

  // Calculate unsaved changes count
  const unsavedChangesCount = useMemo(() => {
    const added = [...pendingPermissionIds].filter(id => !originalPermissionIds.has(id));
    const removed = [...originalPermissionIds].filter(id => !pendingPermissionIds.has(id));
    return added.length + removed.length;
  }, [originalPermissionIds, pendingPermissionIds]);

  const hasUnsavedChanges = unsavedChangesCount > 0;

  const handleCreateRole = useCallback(() => {
    setEditingRoleId(null); // null means create mode
    setDialogOpen(true);
  }, []);

  const handleEditRole = useCallback((role: RoleListItem) => {
    setEditingRoleId(role.id); // Set the role to edit
    setDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback((role: RoleListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  }, []);

  const handleCardClick = useCallback((role: RoleListItem) => {
    // Always keep a role selected - only change selection, don't toggle off
    setSelectedRoleId(role.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!roleToDelete) {
      return;
    }

    try {
      await deleteRole(roleToDelete.id);
      toast.success('Role deleted successfully');
      if (selectedRoleId === roleToDelete.id) {
        setSelectedRoleId(null);
      }
      refetchRoles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete role');
    } finally {
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  }, [roleToDelete, deleteRole, selectedRoleId, refetchRoles]);

  const handleDialogSuccess = useCallback(() => {
    refetchRoles();
    if (selectedRoleId) {
      refetchRole();
    }
    toast.success(editingRoleId ? 'Role updated successfully' : 'Role created successfully');
  }, [refetchRoles, selectedRoleId, refetchRole, editingRoleId]);

  const toggleModule = useCallback((module: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }, []);

  // Build a map of permission ID -> parent ID for ancestor lookup
  const parentIdMap = useMemo(() => {
    const map = new Map<string, string | null>();

    const buildMap = (permissions: HierarchicalPermission[], parentId: string | null = null) => {
      for (const perm of permissions) {
        map.set(perm.id, parentId);
        if (perm.children.length > 0) {
          buildMap(perm.children, perm.id);
        }
      }
    };

    for (const group of permissionGroups) {
      buildMap(group.permissions, null);
    }

    return map;
  }, [permissionGroups]);

  // Helper to collect all descendant IDs from a hierarchical permission
  const collectAllDescendantIds = useCallback((permission: HierarchicalPermission): string[] => {
    const ids: string[] = [permission.id];
    for (const child of permission.children) {
      ids.push(...collectAllDescendantIds(child));
    }
    return ids;
  }, []);

  // Helper to collect all ancestor IDs for a permission
  const collectAllAncestorIds = useCallback((permissionId: string): string[] => {
    const ids: string[] = [];
    let currentId: string | null | undefined = parentIdMap.get(permissionId);

    while (currentId) {
      ids.push(currentId);
      currentId = parentIdMap.get(currentId);
    }

    return ids;
  }, [parentIdMap]);

  const handlePermissionToggle = useCallback((permission: HierarchicalPermission, isEnabled: boolean) => {
    setPendingPermissionIds(prev => {
      const next = new Set(prev);

      if (isEnabled) {
        // When enabling: add this permission + all descendants + all ancestors
        const descendantIds = collectAllDescendantIds(permission);
        const ancestorIds = collectAllAncestorIds(permission.id);

        for (const id of descendantIds) {
          next.add(id);
        }
        for (const id of ancestorIds) {
          next.add(id);
        }
      } else {
        // When disabling: remove this permission + all descendants only
        const descendantIds = collectAllDescendantIds(permission);
        for (const id of descendantIds) {
          next.delete(id);
        }
      }

      return next;
    });
  }, [collectAllDescendantIds, collectAllAncestorIds]);

  const handleDiscard = useCallback(() => {
    setPendingPermissionIds(new Set(originalPermissionIds));
  }, [originalPermissionIds]);

  const handleSaveChanges = useCallback(async () => {
    if (!selectedRoleId) { return; }

    try {
      await updateRole(selectedRoleId, {
        permissionIds: Array.from(pendingPermissionIds)
      });

      // Update original to match saved state
      setOriginalPermissionIds(new Set(pendingPermissionIds));
      await refetchRole();
      refetchRoles();

      // Refresh the profile cache with fresh permissions from DB
      // This is a Server Action so it can modify cookies
      await refreshProfileCache();

      // Refresh the page to get fresh auth data
      router.refresh();

      toast.success('Permissions saved successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save permissions');
    }
  }, [selectedRoleId, pendingPermissionIds, updateRole, refetchRole, refetchRoles, router]);

  // Helper to count all permissions recursively in hierarchy
  const countHierarchicalPermissions = useCallback((permissions: HierarchicalPermission[]): { enabled: number; total: number } => {
    let enabled = 0;
    let total = 0;
    for (const p of permissions) {
      total++;
      if (pendingPermissionIds.has(p.id)) { enabled++; }
      if (p.children.length > 0) {
        const childCounts = countHierarchicalPermissions(p.children);
        enabled += childCounts.enabled;
        total += childCounts.total;
      }
    }
    return { enabled, total };
  }, [pendingPermissionIds]);

  // Calculate permission counts per module for the selected role (using pending state)
  const modulePermissionCounts = useMemo(() => {
    const counts: Record<string, { enabled: number; total: number }> = {};

    for (const group of permissionGroups) {
      counts[group.groupName] = countHierarchicalPermissions(group.permissions);
    }

    return counts;
  }, [permissionGroups, countHierarchicalPermissions]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Roles & Permissions"
        description="Define roles and configure access permissions"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Roles' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetchRoles()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {canCreate && (
              <Button onClick={handleCreateRole}>
                <Plus className="mr-2 h-4 w-4" />
                Create Role
              </Button>
            )}
          </div>
        }
      />

      {/* Error State */}
      {rolesError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{rolesError}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetchRoles()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State - Grid Skeleton */}
      {rolesLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
              <Skeleton className="h-4 w-32 mb-4" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Roles Grid */}
      {!rolesLoading && !rolesError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No roles found</p>
                {canCreate && (
                  <Button onClick={handleCreateRole}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Role
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                isSelected={selectedRoleId === role.id}
                onCardClick={handleCardClick}
                onEditClick={canEdit ? handleEditRole : undefined}
                onDeleteClick={canDelete ? handleDeleteClick : undefined}
              />
            ))
          )}
        </div>
      )}

      {/* Permissions Section - Shows when a role is selected */}
      {selectedRoleId && selectedRoleFromList && (
        <div className="space-y-4">
          {/* Section Header */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold">
              Permissions for:{' '}
              <span className="text-primary">{selectedRoleFromList.name}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Toggle permissions on or off for this role. Changes affect all users holding this role.
            </p>
          </div>

          {/* Loading State for Permissions */}
          {(roleLoading || permissionsLoading) && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-48" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Permission Groups */}
          {!roleLoading && !permissionsLoading && permissionGroups.length > 0 && (
            <div className="space-y-3">
              {permissionGroups.map((group) => (
                <PermissionModule
                  key={group.groupName}
                  group={group}
                  counts={modulePermissionCounts[group.groupName] || { enabled: 0, total: 0 }}
                  isExpanded={expandedModules.has(group.groupName)}
                  selectedRolePermissionIds={pendingPermissionIds}
                  isUpdating={updatingRole || !canUpdatePermission}
                  onToggleModule={toggleModule}
                  onPermissionToggle={canUpdatePermission ? handlePermissionToggle : () => {}}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!roleLoading && !permissionsLoading && permissionGroups.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No permissions available.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Role Form Dialog */}
      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
        onSuccess={handleDialogSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role &ldquo;{roleToDelete?.name}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingRole}
            >
              {deletingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Footer */}
      {hasUnsavedChanges && selectedRoleFromList && canUpdatePermission && (
        <div className="fixed bottom-0 left-0 right-0 bg-muted border-t px-6 py-4 flex items-center justify-between z-50">
          <p className="text-sm">
            You have <span className="font-semibold">{unsavedChangesCount}</span> unsaved changes to the{' '}
            <span className="font-semibold">{selectedRoleFromList.name}</span> role.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleDiscard}>
              Discard
            </Button>
            <Button onClick={handleSaveChanges} disabled={updatingRole}>
              {updatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export memoized component
export const RolesPageContent = memo(RolesPageContentComponent);
