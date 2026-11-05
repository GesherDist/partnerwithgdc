/**
 * Platinum dealer permissions
 *
 * One permission per action, shared by the server actions and the UI. Which
 * roles hold each permission is managed on the Roles page (database).
 */

export const DEALER_PERMISSIONS: Record<
  'viewModule' | 'read' | 'create' | 'update' | 'delete' | 'allocationWrite',
  string
> = {
  /** Platinum Dealers page and sidebar link */
  viewModule: 'platinum_dealers.view_module',
  /** Dealers, their locations, inventory and allocations (also read from the sales order allocation dialogs) */
  read: 'platinum_dealers.view',
  create: 'platinum_dealers.create',
  update: 'platinum_dealers.edit',
  delete: 'platinum_dealers.delete',
  /** Dealer allocation e-mail and allocation status changes */
  allocationWrite: 'allocation.decide',
};
