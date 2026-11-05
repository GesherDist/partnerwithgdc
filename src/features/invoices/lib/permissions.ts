/**
 * Invoice permissions
 *
 * One permission per action, shared by the server actions and the UI so a
 * button is shown only when its action will be allowed. Which roles hold each
 * permission is managed on the Roles page (database), not in code.
 */

export const INVOICE_PERMISSIONS: Record<
  'read' | 'create' | 'edit' | 'delete' | 'recordPayment' | 'send' | 'cancel' | 'pushQbo',
  string
> = {
  read: 'invoices.view_module',
  create: 'invoices.create',
  edit: 'invoices.edit',
  delete: 'invoices.void',
  recordPayment: 'invoices.record_payment',
  send: 'invoices.send',
  cancel: 'invoices.cancel',
  pushQbo: 'invoices.push_qbo',
};
