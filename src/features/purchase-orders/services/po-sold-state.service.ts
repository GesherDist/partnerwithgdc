/**
 * Purchase order sold state
 *
 * One container (PO) can be sold to several customer orders before it arrives
 * (Ankur, Nov 5 2026: 72 tires → 12 to one order, 13 to another). A PO stays
 * sellable until every tire on it is allocated to customer orders.
 *
 * Tires per product: ordered = PO lines (service lines not counted), sold =
 * active (not cancelled) allocations of that PO for that product.
 */

import { db } from '@/shared/lib/supabase/database';

export interface PurchaseOrderSoldState {
  /** Tires on the PO per product */
  orderedByProduct: Map<string, number>;
  /** Tires allocated to customer orders per product */
  soldByProduct: Map<string, number>;
  /** Tires still free per product (ordered − sold, never below 0) */
  availableByProduct: Map<string, number>;
  orderedQty: number;
  soldQty: number;
  hasAllocations: boolean;
  /** Nothing left to sell on this PO */
  fullySold: boolean;
}

export async function getPurchaseOrderSoldStates(
  purchaseOrderIds: string[]
): Promise<Map<string, PurchaseOrderSoldState>> {
  const states = new Map<string, PurchaseOrderSoldState>();
  const ids = [...new Set(purchaseOrderIds.filter(Boolean))];
  if (ids.length === 0) {
    return states;
  }

  const [{ data: items, error: itemsError }, { data: allocations, error: allocError }] = await Promise.all([
    db
      .from('purchase_order_items')
      .select('purchase_order_id, product_id, quantity_ordered, products (item_type)')
      .in('purchase_order_id', ids),
    db
      .from('fulfillment_allocations')
      .select('purchase_order_id, quantity, fulfillment_source, sales_order_items (product_id)')
      .in('purchase_order_id', ids)
      .neq('status', 'cancelled'),
  ]);
  if (itemsError) {
    throw new Error(`Failed to load purchase order items: ${itemsError.message}`);
  }
  if (allocError) {
    throw new Error(`Failed to load allocations: ${allocError.message}`);
  }

  for (const id of ids) {
    states.set(id, {
      orderedByProduct: new Map(),
      soldByProduct: new Map(),
      availableByProduct: new Map(),
      orderedQty: 0,
      soldQty: 0,
      hasAllocations: false,
      fullySold: false,
    });
  }

  // Service lines (e.g. freight) are not tires: never counted as sold or unsold
  const serviceLines = new Set<string>();
  for (const item of (items || []) as Array<Record<string, unknown>>) {
    const product = (Array.isArray(item.products) ? item.products[0] : item.products) as { item_type: string | null } | null;
    const state = states.get(String(item.purchase_order_id));
    if (!state || !item.product_id) {
      continue;
    }
    if (product?.item_type === 'service') {
      serviceLines.add(`${item.purchase_order_id}|${item.product_id}`);
      continue;
    }
    const productId = String(item.product_id);
    state.orderedByProduct.set(productId, (state.orderedByProduct.get(productId) || 0) + Number(item.quantity_ordered || 0));
  }

  // Older data is treated as sold in full, as before: an allocation for a
  // product the PO does not carry, or a PO linked by a non-manufacturer
  // allocation (historical import links containers as GDC Inventory)
  const soldOtherProduct = new Set<string>();
  for (const a of (allocations || []) as Array<Record<string, unknown>>) {
    const state = states.get(String(a.purchase_order_id));
    if (!state) {
      continue;
    }
    state.hasAllocations = true;
    if (a.fulfillment_source !== 'direct') {
      soldOtherProduct.add(String(a.purchase_order_id));
      continue;
    }
    const soItem = (Array.isArray(a.sales_order_items) ? a.sales_order_items[0] : a.sales_order_items) as
      | { product_id: string | null }
      | null;
    const productId = soItem?.product_id ? String(soItem.product_id) : null;
    if (productId && serviceLines.has(`${a.purchase_order_id}|${productId}`)) {
      continue;
    }
    if (!productId || !state.orderedByProduct.has(productId)) {
      soldOtherProduct.add(String(a.purchase_order_id));
      continue;
    }
    state.soldByProduct.set(productId, (state.soldByProduct.get(productId) || 0) + Number(a.quantity || 0));
  }

  for (const [id, state] of states) {
    for (const [productId, ordered] of state.orderedByProduct) {
      const sold = state.soldByProduct.get(productId) || 0;
      state.orderedQty += ordered;
      state.soldQty += Math.min(sold, ordered);
      state.availableByProduct.set(productId, Math.max(0, ordered - sold));
    }
    state.fullySold =
      soldOtherProduct.has(id) ||
      (state.hasAllocations && [...state.availableByProduct.values()].every((left) => left === 0));
    if (soldOtherProduct.has(id)) {
      for (const productId of state.availableByProduct.keys()) {
        state.availableByProduct.set(productId, 0);
      }
    }
  }

  return states;
}
