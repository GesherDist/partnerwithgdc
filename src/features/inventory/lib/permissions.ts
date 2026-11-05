/**
 * Inventory permissions
 *
 * One permission per action, shared by the server actions and the UI so a
 * button is shown only when its action will be allowed. Which roles hold each
 * permission is managed on the Roles page (database), not in code.
 */

export const INVENTORY_PERMISSIONS: Record<'read' | 'adjust' | 'updateStock' | 'allocate' | 'delete', string> = {
  /** Stock reads, also used by the Quote drawer and Sales Order allocation dialogs */
  read: 'inventory.view_module',
  /** Create, update or adjust a stock record */
  adjust: 'inventory.adjust',
  /** "Update Stock" dialog (master-inventory actions check inventory.adjust) */
  updateStock: 'inventory.adjust',
  allocate: 'inventory.allocate',
  delete: 'inventory.manage',
};
