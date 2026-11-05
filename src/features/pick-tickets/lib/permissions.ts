/**
 * Pick ticket / packing list permissions
 *
 * One permission per action, shared by the server actions and the UI so a
 * button is shown only when its action will be allowed. Which roles hold each
 * permission is managed on the Roles page (database), not in code.
 */

export const PICK_TICKET_PERMISSIONS: Record<'view' | 'create' | 'edit' | 'assign' | 'pick' | 'pack' | 'delete', string> = {
  view: 'pick_tickets.view_module',
  create: 'pick_tickets.create',
  edit: 'pick_tickets.edit',
  assign: 'pick_tickets.assign',
  pick: 'pick_tickets.pick',
  /** Create, pack, ship and deliver a packing list */
  pack: 'packing_lists.manage',
  delete: 'pick_tickets.delete',
};
