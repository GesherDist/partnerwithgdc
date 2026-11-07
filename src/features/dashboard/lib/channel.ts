/**
 * Channel of a QuickBooks customer (Channel Performance chart, Nov 7 2026).
 *
 * 1. QuickBooks Customer Type, when its name says OEM or Dealer
 * 2. else the ERP customer's channel, matched by name (case, spaces and
 *    punctuation ignored, e.g. "MWI, LLC" = "MWI LLC")
 * 3. else "unassigned" (shown on its own, never guessed)
 */

export type ResolvedChannel = 'oem' | 'dealer' | 'unassigned';

export const normalizeCustomerName = (name: string | null | undefined) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function channelFromQboType(customerType: string | null | undefined): 'oem' | 'dealer' | null {
  const type = String(customerType ?? '').toLowerCase();
  if (/\boem\b/.test(type)) {
    return 'oem';
  }
  if (/dealer/.test(type)) {
    return 'dealer';
  }
  return null;
}

/** ERP channel by normalized customer name; a name with two different channels is left out (ambiguous) */
export function erpChannelIndex(customers: Array<{ name: string | null; channel: string | null }>): Map<string, 'oem' | 'dealer'> {
  const index = new Map<string, 'oem' | 'dealer'>();
  const ambiguous = new Set<string>();
  for (const c of customers) {
    const key = normalizeCustomerName(c.name);
    const channel = c.channel === 'oem' || c.channel === 'dealer' ? c.channel : null;
    if (!key || !channel) {
      continue;
    }
    const existing = index.get(key);
    if (existing && existing !== channel) {
      ambiguous.add(key);
    }
    index.set(key, channel);
  }
  for (const key of ambiguous) {
    index.delete(key);
  }
  return index;
}

export function resolveChannel(
  customer: string,
  customerType: string | null | undefined,
  erpIndex: Map<string, 'oem' | 'dealer'>
): { channel: ResolvedChannel; source: 'QuickBooks customer type' | 'ERP customer' | 'none' } {
  const fromType = channelFromQboType(customerType);
  if (fromType) {
    return { channel: fromType, source: 'QuickBooks customer type' };
  }
  const fromErp = erpIndex.get(normalizeCustomerName(customer));
  if (fromErp) {
    return { channel: fromErp, source: 'ERP customer' };
  }
  return { channel: 'unassigned', source: 'none' };
}
