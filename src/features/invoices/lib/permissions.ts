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

/**
 * Invoices are created in QuickBooks (Ankur, Nov 7 2026 email: "Yes please" to hiding
 * Create Invoice and Push to QuickBooks and keeping the Invoices page read-only).
 * true = the ERP hides Create / Edit / Delete / Record Payment / Push to QuickBooks
 * on the Invoices page and Create Invoice on the sales order. View and View PDF stay.
 * Set to false to show them again. Server actions are not changed.
 */
export const INVOICES_READ_ONLY = true;
