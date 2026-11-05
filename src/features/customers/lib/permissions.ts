/**
 * Customer permissions
 *
 * One permission per action, shared by the customer server actions, the
 * customer contacts API and the UI. Which roles hold each permission is
 * managed on the Roles page (database), not in code.
 */

export const CUSTOMER_PERMISSIONS: Record<
  'read' | 'create' | 'edit' | 'validate' | 'delete' | 'viewContacts' | 'createContact' | 'editContact' | 'deleteContact',
  string
> = {
  /** Every customer read, including the dropdowns and addresses other screens use */
  read: 'customers.view_module',
  create: 'customers.create',
  edit: 'customers.edit',
  /** Code / email uniqueness checks (read only) */
  validate: 'customers.view_module',
  delete: 'customers.delete',
  viewContacts: 'customers.view_contacts',
  createContact: 'customers.create_contact',
  editContact: 'customers.edit_contact',
  deleteContact: 'customers.delete_contact',
};
