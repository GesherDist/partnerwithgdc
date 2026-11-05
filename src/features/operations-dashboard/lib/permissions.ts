/**
 * Operations dashboard permissions
 *
 * One permission per action, shared by the server actions and the UI so a
 * button is shown only when its action will be allowed. Which roles hold each
 * permission is managed on the Roles page (database).
 */

export const OPERATIONS_PERMISSIONS: Record<'read' | 'edit', string> = {
  /** Operations page, its data and exports */
  read: 'operations_dashboard.view_module',
  /** Every edit: shipment fields, load status, notes, the edit dialog row */
  edit: 'operations_dashboard.edit_shipments',
};
