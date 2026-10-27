/**
 * Product Cost Helpers
 *
 * Functions for retrieving and calculating product costs for sales order items.
 * These support the cost snapshot feature where unit_cost is saved at order creation.
 *
 * Cost Lookup Priority (for margin/COGS calculations):
 * 1. sales_order_items.unit_cost (if saved)
 * 2. product_cycle_costs for the order's order_series (future - table not yet created)
 * 3. products.base_cost (fallback)
 */

import { db } from '@/shared/lib/supabase/database';

/**
 * Get current unit costs (base_cost) for multiple products.
 * Used when creating/updating sales order items to snapshot the cost.
 *
 * @param productIds - Array of product UUIDs
 * @returns Map of productId → base_cost (in cents)
 */
export async function getCurrentUnitCosts(
  productIds: string[]
): Promise<Map<string, number>> {
  const costMap = new Map<string, number>();

  if (productIds.length === 0) {
    return costMap;
  }

  // Remove duplicates
  const uniqueProductIds = [...new Set(productIds)];

  const { data, error } = await db
    .from('products')
    .select('id, base_cost')
    .in('id', uniqueProductIds);

  if (error) {
    console.error('[getCurrentUnitCosts] Error fetching product costs:', error.message);
    // Return empty map - items will have unit_cost = null
    return costMap;
  }

  for (const product of data || []) {
    costMap.set(product.id, product.base_cost ?? 0);
  }

  return costMap;
}

/**
 * Get the effective cost for a sales order item.
 * This is used for margin/COGS calculations on dashboards.
 *
 * Priority:
 * 1. Saved unit_cost on the item (if not null)
 * 2. Order series cost (future - product_cycle_costs table)
 * 3. Product's base_cost
 *
 * @param params - The item and related data
 * @returns The effective cost in cents
 */
export async function getEffectiveItemCost(params: {
  unitCost: number | null;
  productId: string;
  orderSeries?: string | null;
}): Promise<number> {
  const { unitCost, productId } = params;

  // Priority 1: Use saved unit_cost if available
  if (unitCost !== null && unitCost !== undefined) {
    return unitCost;
  }

  // Priority 2: TODO - Check product_cycle_costs table for order series cost
  // Currently skipped as the table doesn't exist yet.
  // When implemented:
  // if (orderSeries) {
  //   const cycleCost = await getProductCycleCost(productId, orderSeries);
  //   if (cycleCost !== null) return cycleCost;
  // }

  // Priority 3: Fall back to product's base_cost
  const { data, error } = await db
    .from('products')
    .select('base_cost')
    .eq('id', productId)
    .single();

  if (error || !data) {
    console.error('[getEffectiveItemCost] Error fetching product base_cost:', error?.message);
    return 0;
  }

  return data.base_cost ?? 0;
}

/**
 * Get effective costs for multiple items in batch.
 * More efficient than calling getEffectiveItemCost for each item.
 *
 * @param items - Array of items with unitCost and productId
 * @returns Map of itemId → effective cost in cents
 */
export async function getEffectiveItemCostsBatch(
  items: Array<{
    id: string;
    unitCost: number | null;
    productId: string;
    orderSeries?: string | null;
  }>
): Promise<Map<string, number>> {
  const costMap = new Map<string, number>();

  // Separate items with saved cost from those needing lookup
  const itemsNeedingLookup: typeof items = [];

  for (const item of items) {
    if (item.unitCost !== null && item.unitCost !== undefined) {
      // Use saved cost
      costMap.set(item.id, item.unitCost);
    } else {
      itemsNeedingLookup.push(item);
    }
  }

  // For items without saved cost, fetch base_cost from products
  if (itemsNeedingLookup.length > 0) {
    const productIds = [...new Set(itemsNeedingLookup.map((i) => i.productId))];

    const { data: products, error } = await db
      .from('products')
      .select('id, base_cost')
      .in('id', productIds);

    if (error) {
      console.error('[getEffectiveItemCostsBatch] Error fetching base costs:', error.message);
    }

    const productCostMap = new Map<string, number>();
    for (const product of products || []) {
      productCostMap.set(product.id, product.base_cost ?? 0);
    }

    // Assign costs to items
    for (const item of itemsNeedingLookup) {
      const cost = productCostMap.get(item.productId) ?? 0;
      costMap.set(item.id, cost);
    }
  }

  return costMap;
}
