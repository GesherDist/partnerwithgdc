/**
 * "In transit / next 7 days" (Jenny's master sheet, Shipment Overview).
 *
 * The loads of the sheet's two lists, each load once:
 * - "In transit / in transit to port": every IN TRANSIT load, whatever its ETA
 * - "Immediate action: delayed / LFD / delivery within 7 days": a load still on
 *   its way to the customer (outstanding qty > 0, not yet sold / invoiced /
 *   available / delivered) whose customer due date is within 7 days or has passed
 *
 * Shared by the KPI card (getOperationsStats) and the Shipment Overview tab so
 * both always show the same number. Client-safe (no server imports).
 */

import type { GDCInventoryData } from '../types';

/** Statuses of loads that are not on their way to a customer */
export const SETTLED_LOAD_STATUSES = [
  'INVOICED', 'NOT_INVOICED', 'SOLD', 'AVAILABLE', 'DELIVERED', 'PAID', 'PARTIALLY_PAID', 'CLOSED',
];

export const normalizeLoadStatus = (status: unknown) => String(status ?? '').trim().toUpperCase().replace(/\s+/g, '_');

/** Unique load numbers counted as "in transit / next 7 days" */
export function inTransitNext7DaysLoads(gdcInventories: GDCInventoryData[], now: Date = new Date()): Set<string> {
  const next7Days = new Date(now);
  next7Days.setHours(23, 59, 59, 999);
  next7Days.setDate(next7Days.getDate() + 7);

  const loads = new Set<string>();
  for (const gdcData of gdcInventories) {
    for (const item of gdcData.items) {
      // Loads only: rows of sales from stock (no load / shipment) are not loads on the sheet
      const key = item.shipmentNumber;
      if (!key) {
        continue;
      }
      const status = normalizeLoadStatus(item.status);

      if (status === 'IN_TRANSIT') {
        loads.add(key);
        continue;
      }
      if (SETTLED_LOAD_STATUSES.includes(status) || (Number(item.outstandingQty) || 0) <= 0) {
        continue;
      }
      const due = item.expectedDelivery ? new Date(item.expectedDelivery) : null;
      if (due && due <= next7Days) {
        loads.add(key);
      }
    }
  }
  return loads;
}
