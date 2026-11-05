/**
 * Fulfillment allocation permissions
 *
 * One permission per action, shared by the allocation server actions and the
 * allocation UI. Which roles hold each permission is managed on the Roles page
 * (database).
 */

export const ALLOCATION_PERMISSIONS: Record<'read' | 'write', string> = {
  read: 'orders.view_detail',
  write: 'allocation.decide',
};
