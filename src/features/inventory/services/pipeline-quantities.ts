/**
 * Inventory pipeline quantities: On Order and In Transit.
 *
 * Shared by the Inventory page and the Master Inventory page so both show the
 * same numbers. Nothing is counted twice: a PO whose container is moving is
 * counted as In Transit, not On Order, and tires already received into a
 * warehouse (purchase_order_items.quantity_received) count as On Hand only.
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

  const inTransitPoIds = new Set(
    (movingShipments || []).map((row) => row.purchase_order_id).filter((id): id is string => !!id)
  );

  // Tires already received into a warehouse are On Hand, not In Transit
  const receivedByPo = new Map<string, number>();
  if (inTransitPoIds.size > 0) {
    const { data: receivedItems, error: receivedError } = await client
      .from('purchase_order_items')
      .select('purchase_order_id, quantity_received')
      .in('purchase_order_id', [...inTransitPoIds])
      .gt('quantity_received', 0);

    if (receivedError) {
      throw receivedError;
    }

    for (const item of receivedItems || []) {
      receivedByPo.set(item.purchase_order_id, (receivedByPo.get(item.purchase_order_id) || 0) + (item.quantity_received || 0));
    }
  }

  let inTransit = 0;
  for (const row of movingShipments || []) {
    const qty = row.total_qty || 0;
    const received = row.purchase_order_id ? receivedByPo.get(row.purchase_order_id) || 0 : 0;
    const deducted = Math.min(qty, received);
    if (row.purchase_order_id && deducted > 0) {
      receivedByPo.set(row.purchase_order_id, received - deducted);
    }
    inTransit += qty - deducted;
  }

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
