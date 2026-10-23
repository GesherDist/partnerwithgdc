/**
 * Shipping email helpers
 *
 * SEAIR emails that reached the Inbox before routing used the inbound address
 * (auto-forwarded emails kept the original "To") can be re-run through the
 * shipping processor. Only SEAIR senders qualify, so customer POs are never
 * processed as shipping updates.
 */

const SEAIR_DOMAIN = '@seaironline.com';

export function isSeairEmail(fromEmail: string | null | undefined): boolean {
  return (fromEmail || '').trim().toLowerCase().endsWith(SEAIR_DOMAIN);
}

/** Toast text for a processed shipping email */
export function describeShippingResult(result: {
  matched: boolean;
  containerNumber?: string | null;
  soNumber?: string | null;
  detectedStatus?: string | null;
  skippedReason?: string;
}): { ok: boolean; message: string } {
  const ref = [result.soNumber, result.containerNumber].filter(Boolean).join(' / ');
  if (result.skippedReason) {
    return { ok: false, message: `Processed${ref ? ` (${ref})` : ''}, but shipment not updated: ${result.skippedReason}` };
  }
  if (!result.matched) {
    return {
      ok: false,
      message: `Processed, but no matching shipment found${ref ? ` for ${ref}` : ''}`,
    };
  }
  const status = result.detectedStatus ? `, status: ${result.detectedStatus.replace(/_/g, ' ')}` : '';
  return { ok: true, message: `Shipment updated${ref ? ` (${ref})` : ''}${status}` };
}
