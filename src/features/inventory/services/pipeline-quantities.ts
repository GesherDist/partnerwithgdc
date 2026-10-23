/**
 * Inventory pipeline quantities: On Order and In Transit.
 *
 * Shared by the Inventory page and the Master Inventory page so both show the
 * same numbers. Nothing is counted twice: a PO whose container is moving is
 * counted as In Transit, not On Order.
 */

import type { SupabaseClient } from '@/shared/lib/supabase/types';

/** Shipment tracking statuses that mean the goods are physically moving. */
export const IN_TRANSIT_TRACKING_STATUSES = [
  'loaded_on_vessel',
  'departed_origin',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'on_rail',
  'at_ramp',
  'out_for_delivery',
];

/** PO statuses where goods are ordered but not shipped yet. */
const ON_ORDER_PO_STATUSES = ['confirmed', 'in_production', 'ready_to_ship', 'partial'];

export interface PipelineQuantities {
  onOrder: number;
  inTransit: number;
}

interface PoItemRow {
  purchase_order_id: string;
  quantity_ordered: number | null;
  quantity_received: number | null;
}

function pendingQty(item: PoItemRow): number {
  return Math.max(0, (item.quantity_ordered || 0) - (item.quantity_received || 0));
}

export async function getPipelineQuantities(client: SupabaseClient): Promise<PipelineQuantities> {
  // 1. In Transit: tracked shipments that are moving
  const { data: movingShipments, error: shipmentError } = await client
    .from('shipments')
    .select('total_qty, purchase_order_id')
    .in('tracking_status', IN_TRANSIT_TRACKING_STATUSES)
    .is('deleted_at', null);

  if (shipmentError) {
    throw shipmentError;
  }

  let inTransit = (movingShipments || []).reduce((sum, row) => sum + (row.total_qty || 0), 0);
  const inTransitPoIds = new Set(
    (movingShipments || []).map((row) => row.purchase_order_id).filter((id): id is string => !!id)
  );

  // 2. POs the supplier marked "in transit" that have no moving shipment yet
  const { data: shippedPoItems, error: shippedError } = await client
    .from('purchase_order_items')
    .select('purchase_order_id, quantity_ordered, quantity_received, purchase_orders!inner (status, deleted_at)')
    .eq('purchase_orders.status', 'in_transit')
    .is('purchase_orders.deleted_at', null);

  if (shippedError) {
    throw shippedError;
  }

  for (const item of (shippedPoItems || []) as PoItemRow[]) {
    if (!inTransitPoIds.has(item.purchase_order_id)) {
      inTransit += pendingQty(item);
    }
  }

  // 3. On Order: ordered, not shipped, not already counted as In Transit
  const { data: openPoItems, error: openError } = await client
    .from('purchase_order_items')
    .select('purchase_order_id, quantity_ordered, quantity_received, purchase_orders!inner (status, deleted_at)')
    .in('purchase_orders.status', ON_ORDER_PO_STATUSES)
    .is('purchase_orders.deleted_at', null);

  if (openError) {
    throw openError;
  }

  const onOrder = ((openPoItems || []) as PoItemRow[]).reduce(
    (sum, item) => (inTransitPoIds.has(item.purchase_order_id) ? sum : sum + pendingQty(item)),
    0
  );

  return { onOrder, inTransit };
}
