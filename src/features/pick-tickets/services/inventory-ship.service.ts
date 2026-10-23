/**
 * Inventory ship helper for pick tickets
 *
 * Reduces on_hand and allocated at the pick ticket's warehouse for every
 * picked item. Shared by both fulfillment paths:
 * 1. Quick ship: Complete Picking / Edit status → shipped (pick-tickets actions)
 * 2. Full packing: Packing List → shipped (packing-list actions)
 *
 * Kept out of the 'use server' actions file so it is not exposed as a
 * client-callable server action.
 */

import { db } from '@/shared/lib/supabase/database';
import type { PickTicketWithItems } from '../types';

/**
 * Ship inventory for a shipped pick ticket
 * Skips service and non-inventory items (they don't have physical inventory)
 */
export async function shipInventoryForPickTicket(
  pickTicket: PickTicketWithItems,
  userId?: string
): Promise<void> {
  const { inventoryService } = await import('@/features/inventory/services/inventory.service');

  const reference = {
    type: 'pick_ticket',
    id: pickTicket.id,
    number: pickTicket.pickTicketNumber,
  };

  // Fetch product item_type for all products in the pick ticket
  const productIds = (pickTicket.items || [])
    .map((item) => item.productId)
    .filter((id): id is string => !!id);

  let productItemTypes: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await db
      .from('products')
      .select('id, item_type')
      .in('id', productIds);

    productItemTypes = (products || []).reduce((acc, p) => {
      acc[p.id] = p.item_type || 'inventory';
      return acc;
    }, {} as Record<string, string>);
  }

  for (const item of pickTicket.items || []) {
    if (!item.productId || !pickTicket.warehouseId) {
      continue;
    }

    // Skip service and non-inventory items - they don't have physical inventory
    const itemType = productItemTypes[item.productId] || 'inventory';
    if (itemType === 'service' || itemType === 'non_inventory') {
      console.log(`[shipInventoryForPickTicket] Skipping inventory ship for ${item.sku} (${itemType})`);
      continue;
    }

    // Ship the quantity that was picked
    const quantityToShip = item.quantityPicked || item.quantityToPick;

    if (quantityToShip <= 0) {
      continue;
    }

    try {
      await inventoryService.shipByProductLocation(
        item.productId,
        pickTicket.warehouseId,
        quantityToShip,
        userId,
        reference
      );
    } catch (error) {
      // Log but don't fail - items might not have been allocated
      console.error(`Failed to ship inventory for ${item.sku}:`, error);
    }
  }
}
