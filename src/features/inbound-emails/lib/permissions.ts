/**
 * Inbox permissions
 *
 * One permission per action, shared by the server actions, the inbox API
 * routes and the UI so a button is shown only when its action will be
 * allowed. Which roles hold each permission is managed on the Roles page
 * (database), not in code. The Inbox page itself needs inbox.view_module.
 */

export const INBOX_PERMISSIONS: Record<
  'read' | 'update' | 'delete' | 'createQuote' | 'processShipping',
  string
> = {
  read: 'inbox.view_module',
  /** Change status, reject extracted data, link an attachment to a quote */
  update: 'inbox.view_module',
  delete: 'inbox.delete',
  createQuote: 'quotes.create',
  processShipping: 'shipments.edit',
};
