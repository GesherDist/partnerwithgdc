/**
 * Inventory pipeline quantities: On Order and In Transit.
 *
 * Shared by the Inventory page and the Master Inventory page so both show the
 * same numbers. Nothing is counted twice: a PO whose container is moving is
 * counted as In Transit, not On Order, and tires already received into a
 * warehouse (purchase_order_items.quantity_received) count as On Hand only.
 *
 * Manufacturer Direct tires never hit our inventory (Oct 27 call), so they are
 * left out: the qty of direct allocations on a PO, or the whole PO when it is
 * linked to a customer order without allocations (same rule as PO receiving).
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
  purchase_orders: { sales_order_id: string | null } | null;
}

interface MovingShipmentRow {
  total_qty: number | null;
  purchase_order_id: string | null;
  purchase_orders: { sales_order_id: string | null } | null;
}

function pendingQty(item: PoItemRow): number {
  return Math.max(0, (item.quantity_ordered || 0) - (item.quantity_received || 0));
}

/** Direct (customer) tires per PO, from non-cancelled Manufacturer Direct allocations. */
async function loadDirectQtyByPo(client: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await client
    .from('fulfillment_allocations')
    .select('purchase_order_id, quantity')
    .eq('fulfillment_source', 'direct')
    .neq('status', 'cancelled')
    .not('purchase_order_id', 'is', null);

  if (error) {
    throw error;
  }

  const byPo = new Map<string, number>();
  for (const row of data || []) {
    if (row.purchase_order_id) {
      byPo.set(row.purchase_order_id, (byPo.get(row.purchase_order_id) || 0) + (row.quantity || 0));
    }
  }
  return byPo;
}

/** Pending qty per PO with the direct tires taken out. */
function stockQtyByPo(items: PoItemRow[], directByPo: Map<string, number>, skip: Set<string>): number {
  const pendingByPo = new Map<string, number>();
  const dropshipPoIds = new Set<string>();
  for (const item of items) {
    if (skip.has(item.purchase_order_id)) {
      continue;
    }
    pendingByPo.set(item.purchase_order_id, (pendingByPo.get(item.purchase_order_id) || 0) + pendingQty(item));
    if (item.purchase_orders?.sales_order_id) {
      dropshipPoIds.add(item.purchase_order_id);
    }
  }

  let total = 0;
  for (const [poId, pending] of pendingByPo) {
    const direct = directByPo.get(poId);
    if (direct !== undefined) {
      total += Math.max(0, pending - direct);
    } else if (!dropshipPoIds.has(poId)) {
      total += pending;
    }
  }
  return total;
}

export async function getPipelineQuantities(client: SupabaseClient): Promise<PipelineQuantities> {
  const directByPo = await loadDirectQtyByPo(client);

  // 1. In Transit: tracked shipments that are moving
  const { data: movingShipments, error: shipmentError } = await client
    .from('shipments')
    .select('total_qty, purchase_order_id, purchase_orders (sales_order_id)')
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

  // Direct tires on a moving container go to the customer, not to us
  const directLeftByPo = new Map(directByPo);

  let inTransit = 0;
  for (const row of (movingShipments || []) as unknown as MovingShipmentRow[]) {
    const qty = row.total_qty || 0;
    const poId = row.purchase_order_id;
    if (poId && !directByPo.has(poId) && row.purchase_orders?.sales_order_id) {
      continue; // Whole PO is a customer drop-ship
    }
    const received = poId ? receivedByPo.get(poId) || 0 : 0;
    const direct = poId ? directLeftByPo.get(poId) || 0 : 0;
    const deducted = Math.min(qty, received + direct);
    if (poId && deducted > 0) {
      const fromReceived = Math.min(received, deducted);
      receivedByPo.set(poId, received - fromReceived);
      directLeftByPo.set(poId, direct - (deducted - fromReceived));
    }
    inTransit += qty - deducted;
  }

  // 2. POs the supplier marked "in transit" that have no moving shipment yet
  const { data: shippedPoItems, error: shippedError } = await client
    .from('purchase_order_items')
    .select('purchase_order_id, quantity_ordered, quantity_received, purchase_orders!inner (status, deleted_at, sales_order_id)')
    .eq('purchase_orders.status', 'in_transit')
    .is('purchase_orders.deleted_at', null);

  if (shippedError) {
    throw shippedError;
  }

  inTransit += stockQtyByPo((shippedPoItems || []) as unknown as PoItemRow[], directByPo, inTransitPoIds);

  // 3. On Order: ordered, not shipped, not already counted as In Transit
  const { data: openPoItems, error: openError } = await client
    .from('purchase_order_items')
    .select('purchase_order_id, quantity_ordered, quantity_received, purchase_orders!inner (status, deleted_at, sales_order_id)')
    .in('purchase_orders.status', ON_ORDER_PO_STATUSES)
    .is('purchase_orders.deleted_at', null);

  if (openError) {
    throw openError;
  }

  const onOrder = stockQtyByPo((openPoItems || []) as unknown as PoItemRow[], directByPo, inTransitPoIds);

  return { onOrder, inTransit };
}
