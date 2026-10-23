/**
 * Toast text for the "Sync with Pipedrive" result (client-safe: types only).
 */

import type { TwoWaySyncResult } from './two-way-sync.service';

const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  street: 'street',
  city: 'city',
  state: 'state',
  zip: 'zip',
  country: 'country',
};

export function describeTwoWaySync(result: TwoWaySyncResult): { title: string; description: string; needsReview: boolean } {
  if (result.organization.status === 'needs_review') {
    return {
      title: 'Pipedrive needs review',
      description: [result.organization.reason, ...result.warnings].filter(Boolean).join('. '),
      needsReview: true,
    };
  }

  const lines: string[] = [];
  const fields = (list: string[]) => list.map((field) => FIELD_LABELS[field] ?? field).join(', ');
  if (result.customer.toErp.length > 0) {lines.push(`Customer updated from Pipedrive: ${fields(result.customer.toErp)}`);}
  if (result.customer.toPipedrive.length > 0) {lines.push(`Pipedrive organization updated: ${fields(result.customer.toPipedrive)}`);}

  const c = result.contacts;
  const counts = [
    c.updatedInErp && `${c.updatedInErp} updated in Gesher`,
    c.updatedInPipedrive && `${c.updatedInPipedrive} updated in Pipedrive`,
    c.createdInErp && `${c.createdInErp} added to Gesher`,
    c.createdInPipedrive && `${c.createdInPipedrive} added to Pipedrive`,
    c.unlinked && `${c.unlinked} unlinked (deleted in Pipedrive)`,
  ].filter(Boolean);
  if (counts.length > 0) {lines.push(`Contacts: ${counts.join(', ')}`);}
  if (lines.length === 0) {lines.push('Gesher and Pipedrive already match');}

  return {
    title: result.organization.status === 'created' ? 'Organization created in Pipedrive' : 'Synced with Pipedrive',
    description: [...lines, ...result.warnings].join('. '),
    needsReview: result.warnings.length > 0,
  };
}
