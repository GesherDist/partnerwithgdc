/**
 * Master Inventory permissions
 *
 * One permission per action; which roles hold it is managed on the Roles page
 * (database). The Master Inventory page itself needs inventory.view_module
 * (sidebar + page.tsx); adding or updating stock keeps its own
 * inventory.adjust check in the actions.
 */

export const MASTER_INVENTORY_PERMISSIONS: Record<'read', string> = {
  read: 'inventory.view_module',
};
