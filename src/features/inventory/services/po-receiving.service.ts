/**
 * Purchase Order Receiving
 *
 * Puts supplier containers into warehouse stock (inventory.on_hand) and records
 * the received quantity on purchase_order_items.quantity_received.
 *
 * Two entry points:
 * - receivePurchaseOrder(): manual "Receive into Warehouse" (Jenny picks qty + warehouse)
 * - autoReceiveForShipment() / autoReceiveForPurchaseOrder(): called when a supplier
 *   shipment becomes delivered (CMA, SeaAir email, manual status). Only clear stock POs
 *   are received automatically: not linked to a customer, no fulfillment allocation,
 *   and the PO warehouse is a physical warehouse (not GDC-INV).
 *
 * Never receives twice: only the pending qty (ordered − received) can be received, and
 * quantity_received is updated with a compare-and-set before stock is added, so CMA,
 * email and manual deliveries for the same container add the stock once.
 */

import { db } from '@/shared/lib/supabase/database';
import { auditService } from '@/shared/lib/audit';
import { PO_STATUS_TRANSITIONS, type POStatus } from '@/features/purchase-orders/types';
import { inventoryService } from './inventory.service';

/** Virtual location used to track GDC inventory POs; never holds physical stock. */
const GDC_INV_LOCATION_CODE = 'GDC-INV';

/** PO statuses from which goods can be received. */
const RECEIVABLE_PO_STATUSES = ['confirmed', 'in_production', 'ready_to_ship', 'in_transit', 'partial', 'received'];

export type ReceivingMode = 'stock' | 'allocated' | 'dropship';

export interface ReceivingLocation {
  id: string;
  name: string;
  code: string;
}

export interface ReceivingItem {
  poItemId: string;
  productId: string | null;
  sku: string | null;
  description: string | null;
  ordered: number;
  received: number;
  pending: number;
  /** Pre-filled qty for the dialog */
  suggested: number;
  /** false for service / non-inventory lines (no physical stock) */
  isStockItem: boolean;
}

export interface ReceivingInfo {
  purchaseOrderId: string;
  poNumber: string;
  status: string;
  mode: ReceivingMode;
  defaultLocationId: string | null;
  locations: ReceivingLocation[];
  items: ReceivingItem[];
  canReceive: boolean;
  /** Why receiving is not possible (when canReceive is false) */
  blockedReason?: string;
}

export interface ReceiveLineInput {
  poItemId: string;
  quantity: number;
}

export interface ReceiveInput {
  purchaseOrderId: string;
  locationId: string;
  lines: ReceiveLineInput[];
  userId?: string;
  notes?: string;
  source: 'manual' | 'auto';
}

export interface ReceiveResult {
  totalReceived: number;
  lines: { sku: string | null; quantity: number }[];
  poStatus: string;
  errors: string[];
}

type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

interface PoRow {
  id: string;
  po_number: string;
  status: string;
  warehouse_id: string | null;
  sales_order_id: string | null;
  deleted_at: string | null;
}

interface PoItemRow {
  id: string;
  product_id: string | null;
  sku: string | null;
  description: string | null;
  quantity_ordered: number | null;
  quantity_received: number | null;
  products: { item_type: string | null } | null;
}

interface AllocationRow {
  location_id: string | null;
  container_remaining: number | null;
  sales_order_items: { product_id: string | null } | null;
}

// ============================================
// HELPERS
// ============================================

async function loadPurchaseOrder(id: string): Promise<PoRow | null> {
  const { data, error } = await db
    .from('purchase_orders')
    .select('id, po_number, status, warehouse_id, sales_order_id, deleted_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load purchase order: ${error.message}`);
  }
  return (data as PoRow | null) ?? null;
}

async function loadPoItems(purchaseOrderId: string): Promise<PoItemRow[]> {
  const { data, error } = await db
    .from('purchase_order_items')
    .select('id, product_id, sku, description, quantity_ordered, quantity_received, products (item_type)')
    .eq('purchase_order_id', purchaseOrderId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to load purchase order items: ${error.message}`);
  }
  return (data || []) as unknown as PoItemRow[];
}

async function loadActiveAllocations(purchaseOrderId: string): Promise<AllocationRow[]> {
  const { data, error } = await db
    .from('fulfillment_allocations')
    .select('location_id, container_remaining, sales_order_items (product_id)')
    .eq('purchase_order_id', purchaseOrderId)
    .neq('status', 'cancelled');

  if (error) {
    throw new Error(`Failed to load allocations: ${error.message}`);
  }
  return (data || []) as unknown as AllocationRow[];
}

/** Physical warehouses stock can be received into (GDC-INV excluded). */
async function loadReceivingLocations(): Promise<ReceivingLocation[]> {
  const { data, error } = await db
    .from('locations')
    .select('id, name, location_code')
    .eq('location_type', 'warehouse')
    .eq('is_active', true)
    .is('deleted_at', null)
    .neq('location_code', GDC_INV_LOCATION_CODE)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load warehouses: ${error.message}`);
  }
  return (data || []).map((l) => ({ id: l.id, name: l.name, code: l.location_code }));
}

function isStockItem(item: PoItemRow): boolean {
  const type = item.products?.item_type || 'inventory';
  return !!item.product_id && type !== 'service' && type !== 'non_inventory';
}

function pendingOf(item: PoItemRow): number {
  return Math.max(0, (item.quantity_ordered || 0) - (item.quantity_received || 0));
}

/** Move the PO to partial / received based on what has been received so far. */
async function syncPoStatus(po: PoRow, items: PoItemRow[], userId?: string): Promise<string> {
  const stockItems = items.filter(isStockItem);
  const anyReceived = stockItems.some((i) => (i.quantity_received || 0) > 0);
  const allReceived = stockItems.length > 0 && stockItems.every((i) => pendingOf(i) === 0);

  let target: POStatus | null = null;
  if (allReceived) {
    target = 'received';
  } else if (anyReceived) {
    target = 'partial';
  }

  const current = po.status as POStatus;
  if (!target || target === current) {
    return po.status;
  }
  if (!(PO_STATUS_TRANSITIONS[current] || []).includes(target)) {
    return po.status;
  }

  const { error } = await db
    .from('purchase_orders')
    .update({ status: target, updated_by: userId || null, updated_at: new Date().toISOString() })
    .eq('id', po.id)
    .eq('status', current);

  if (error) {
    console.error('[POReceiving] Failed to update PO status:', error);
    return po.status;
  }
  return target;
}

// ============================================
// SERVICE
// ============================================

export const poReceivingService = {
  /**
   * Data for the "Receive into Warehouse" dialog
   */
  async getReceivingInfo(purchaseOrderId: string): Promise<ServiceResult<ReceivingInfo>> {
    try {
      const po = await loadPurchaseOrder(purchaseOrderId);
      if (!po || po.deleted_at) {
        return { success: false, error: 'Purchase order not found' };
      }

      const [items, allocations, locations] = await Promise.all([
        loadPoItems(po.id),
        loadActiveAllocations(po.id),
        loadReceivingLocations(),
      ]);

      // Leftover container units earmarked for a warehouse, per product
      const remainingByProduct = new Map<string, number>();
      let allocationLocationId: string | null = null;
      for (const a of allocations) {
        const productId = a.sales_order_items?.product_id;
        const remaining = a.container_remaining || 0;
        if (productId && remaining > 0) {
          remainingByProduct.set(productId, (remainingByProduct.get(productId) || 0) + remaining);
          allocationLocationId = allocationLocationId || a.location_id;
        }
      }

      let mode: ReceivingMode = 'stock';
      if (allocations.length > 0) {
        mode = remainingByProduct.size > 0 ? 'allocated' : 'dropship';
      } else if (po.sales_order_id) {
        mode = 'dropship';
      }

      const receivingItems: ReceivingItem[] = items.map((item) => {
        const pending = pendingOf(item);
        const stock = isStockItem(item);
        let suggested = 0;
        if (stock) {
          if (mode === 'stock') {
            suggested = pending;
          } else if (mode === 'allocated' && item.product_id) {
            suggested = Math.min(pending, remainingByProduct.get(item.product_id) || 0);
          }
        }
        return {
          poItemId: item.id,
          productId: item.product_id,
          sku: item.sku,
          description: item.description,
          ordered: item.quantity_ordered || 0,
          received: item.quantity_received || 0,
          pending,
          suggested,
          isStockItem: stock,
        };
      });

      const locationIds = new Set(locations.map((l) => l.id));
      const preferred = mode === 'allocated' ? allocationLocationId || po.warehouse_id : po.warehouse_id;
      const defaultLocationId = preferred && locationIds.has(preferred) ? preferred : null;

      let blockedReason: string | undefined;
      if (!RECEIVABLE_PO_STATUSES.includes(po.status)) {
        blockedReason = `Purchase order is ${po.status}; it must be confirmed before goods can be received`;
      } else if (!receivingItems.some((i) => i.isStockItem && i.pending > 0)) {
        blockedReason = 'All tires on this purchase order have already been received';
      } else if (locations.length === 0) {
        blockedReason = 'No active warehouse found';
      }

      return {
        success: true,
        data: {
          purchaseOrderId: po.id,
          poNumber: po.po_number,
          status: po.status,
          mode,
          defaultLocationId,
          locations,
          items: receivingItems,
          canReceive: !blockedReason,
          blockedReason,
        },
      };
    } catch (error) {
      console.error('[POReceiving] getReceivingInfo error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to load receiving data' };
    }
  },

  /**
   * Receive PO lines into a warehouse (on_hand += qty)
   */
  async receivePurchaseOrder(input: ReceiveInput): Promise<ServiceResult<ReceiveResult>> {
    try {
      const po = await loadPurchaseOrder(input.purchaseOrderId);
      if (!po || po.deleted_at) {
        return { success: false, error: 'Purchase order not found' };
      }
      if (!RECEIVABLE_PO_STATUSES.includes(po.status)) {
        return { success: false, error: `Purchase order is ${po.status}; it must be confirmed before goods can be received` };
      }

      const locations = await loadReceivingLocations();
      const location = locations.find((l) => l.id === input.locationId);
      if (!location) {
        return { success: false, error: 'Select a physical warehouse to receive into' };
      }

      const lines = input.lines.filter((l) => l.quantity > 0);
      if (lines.length === 0) {
        return { success: false, error: 'Enter a quantity to receive' };
      }
      if (new Set(lines.map((l) => l.poItemId)).size !== lines.length) {
        return { success: false, error: 'Each item can appear only once' };
      }

      const items = await loadPoItems(po.id);
      const itemsById = new Map(items.map((i) => [i.id, i]));

      // Validate everything before touching stock
      for (const line of lines) {
        const item = itemsById.get(line.poItemId);
        if (!item) {
          return { success: false, error: 'Item does not belong to this purchase order' };
        }
        if (!Number.isInteger(line.quantity)) {
          return { success: false, error: `Quantity for ${item.sku || 'item'} must be a whole number` };
        }
        if (!isStockItem(item)) {
          return { success: false, error: `${item.sku || 'Item'} is not a stock item and cannot be received` };
        }
        const pending = pendingOf(item);
        if (line.quantity > pending) {
          return { success: false, error: `${item.sku || 'Item'}: only ${pending} left to receive` };
        }
      }

      const reference = { type: 'purchase_order', id: po.id, number: po.po_number };
      const received: { sku: string | null; quantity: number }[] = [];
      const errors: string[] = [];

      for (const line of lines) {
        const item = itemsById.get(line.poItemId)!;
        const before = item.quantity_received || 0;
        const after = before + line.quantity;

        // Compare-and-set: claims the qty so a parallel delivery event can't receive it again
        const { data: claimed, error: claimError } = await db
          .from('purchase_order_items')
          .update({ quantity_received: after })
          .eq('id', item.id)
          .eq('quantity_received', before)
          .select('id');

        if (claimError || !claimed || claimed.length === 0) {
          errors.push(`${item.sku || 'Item'}: changed by someone else, reload and try again`);
          continue;
        }

        const stock = await inventoryService.receiveByProductLocation(
          item.product_id!,
          location.id,
          line.quantity,
          input.userId,
          reference
        );

        if (!stock.success) {
          // Give the qty back so it can be received again
          await db
            .from('purchase_order_items')
            .update({ quantity_received: before })
            .eq('id', item.id)
            .eq('quantity_received', after);
          errors.push(`${item.sku || 'Item'}: ${stock.error || 'failed to add stock'}`);
          continue;
        }

        item.quantity_received = after;
        received.push({ sku: item.sku, quantity: line.quantity });
      }

      const poStatus = received.length > 0 ? await syncPoStatus(po, items, input.userId) : po.status;
      const totalReceived = received.reduce((sum, r) => sum + r.quantity, 0);

      if (received.length > 0) {
        auditService.log({
          action: 'update',
          module: 'purchase_orders',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          oldData: { status: po.status },
          newData: {
            status: poStatus,
            received,
            locationId: location.id,
            source: input.source,
            notes: input.notes || null,
          },
          userId: input.userId,
          description: `${input.source === 'auto' ? 'Auto-received' : 'Received'} ${totalReceived} tires from ${po.po_number} into ${location.name}`,
        }).catch((err) => {
          console.error('[POReceiving] Failed to log audit:', err);
        });
      }

      if (received.length === 0) {
        return { success: false, error: errors.join('; ') || 'Nothing was received' };
      }

      return { success: true, data: { totalReceived, lines: received, poStatus, errors } };
    } catch (error) {
      console.error('[POReceiving] receivePurchaseOrder error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to receive purchase order' };
    }
  },

  /**
   * Auto-receive when a supplier container is delivered.
   * Only for clear stock POs; everything else is received manually. Never throws.
   */
  async autoReceiveForPurchaseOrder(purchaseOrderId: string, userId?: string): Promise<void> {
    try {
      const po = await loadPurchaseOrder(purchaseOrderId);
      if (!po || po.deleted_at || !po.warehouse_id || po.sales_order_id) {
        return;
      }
      if (!RECEIVABLE_PO_STATUSES.includes(po.status)) {
        return;
      }

      const allocations = await loadActiveAllocations(po.id);
      if (allocations.length > 0) {
        return; // Pre-sold container: Jenny receives the leftover units manually
      }

      const locations = await loadReceivingLocations();
      if (!locations.some((l) => l.id === po.warehouse_id)) {
        return; // GDC-INV / drop-ship / inactive location
      }

      const items = await loadPoItems(po.id);
      const lines = items
        .filter((i) => isStockItem(i) && pendingOf(i) > 0)
        .map((i) => ({ poItemId: i.id, quantity: pendingOf(i) }));

      if (lines.length === 0) {
        return; // Already received
      }

      const result = await this.receivePurchaseOrder({
        purchaseOrderId: po.id,
        locationId: po.warehouse_id,
        lines,
        userId,
        source: 'auto',
        notes: 'Container delivered',
      });

      if (result.success) {
        console.log(`[POReceiving] Auto-received ${result.data.totalReceived} tires for ${po.po_number}`);
      } else {
        console.error(`[POReceiving] Auto-receive failed for ${po.po_number}: ${result.error}`);
      }
    } catch (error) {
      console.error('[POReceiving] autoReceiveForPurchaseOrder error:', error);
    }
  },

  /**
   * True when the shipment is already delivered by any signal. Callers read
   * this BEFORE writing "delivered" and auto-receive only on the change to
   * delivered, so containers delivered before receiving existed (stock Jenny
   * already fixed by hand) are not added again when a row is re-saved.
   */
  async isShipmentDelivered(shipmentId: string): Promise<boolean> {
    try {
      const { data } = await db
        .from('shipments')
        .select('status, tracking_status, load_status')
        .eq('id', shipmentId)
        .maybeSingle();

      return (
        data?.status === 'delivered' ||
        data?.tracking_status === 'delivered' ||
        data?.load_status === 'delivered'
      );
    } catch {
      return true; // Unknown: don't auto-receive
    }
  },

  /** Same check for a PO row without a shipment (operations dashboard). */
  async isPurchaseOrderDelivered(purchaseOrderId: string): Promise<boolean> {
    try {
      const { data } = await db
        .from('purchase_orders')
        .select('status, load_status')
        .eq('id', purchaseOrderId)
        .maybeSingle();

      return data?.load_status === 'delivered' || data?.status === 'received';
    } catch {
      return true; // Unknown: don't auto-receive
    }
  },

  /** Auto-receive for a delivered shipment (looks up its PO). Never throws. */
  async autoReceiveForShipment(shipmentId: string, userId?: string): Promise<void> {
    try {
      const { data: shipment } = await db
        .from('shipments')
        .select('purchase_order_id')
        .eq('id', shipmentId)
        .maybeSingle();

      if (shipment?.purchase_order_id) {
        await this.autoReceiveForPurchaseOrder(shipment.purchase_order_id, userId);
      }
    } catch (error) {
      console.error('[POReceiving] autoReceiveForShipment error:', error);
    }
  },
};
