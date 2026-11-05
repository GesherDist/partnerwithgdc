/**
 * Location permissions
 *
 * One permission per action, shared by the location server actions, the
 * /api/locations routes, the Locations pages and their buttons. Which roles
 * hold each permission is managed on the Roles page (database), not in code.
 *
 * Reading locations and their contacts needs no permission, only a signed-in
 * user: they are reference data used by purchase orders, sales order
 * allocations, pick tickets and inventory.
 */

export const LOCATION_PERMISSIONS: Record<
  'viewModule' | 'viewDetail' | 'create' | 'edit' | 'validate' | 'delete' | 'manageContacts',
  string
> = {
  viewModule: 'locations.view_module',
  viewDetail: 'locations.view_detail',
  create: 'locations.create',
  edit: 'locations.edit',
  /** Code uniqueness check (read only) */
  validate: 'locations.view_module',
  delete: 'locations.delete',
  /** Add, edit or remove a location's contacts */
  manageContacts: 'locations.edit',
};
