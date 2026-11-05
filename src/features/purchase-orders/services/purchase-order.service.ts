/**
 * Purchase Orders Service
 *
 * Business logic layer for Purchase Orders module.
 */

import { purchaseOrderRepository } from '../repositories/purchase-order.repository';
import { db } from '@/shared/lib/supabase/database';
import { auditService } from '@/shared/lib/audit';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  type CreatePOInput,
  type UpdatePOInput,
} from '../lib/schemas';
import type {
  PurchaseOrder,
  PurchaseOrderWithItems,
  POListItem,
  POListParams,
  POStatus,
} from '../types';
import { PO_STATUS_TRANSITIONS } from '../types';

// Helper to convert purchase order to audit data (exclude large/sensitive fields)
function purchaseOrderToAuditData(po: PurchaseOrder | PurchaseOrderWithItems): Record<string, unknown> {
  return {
    id: po.id,
    poNumber: po.poNumber,
    salesOrderId: po.salesOrderId,
    status: po.status,
    subtotal: po.subtotal,
    taxTotal: po.taxTotal,
    grandTotal: po.grandTotal,
    orderSeries: po.orderSeries,
    expectedDeliveryDate: po.expectedDeliveryDate,
  };
}

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  warning?: string;
}

interface PaginatedServiceResult<T> {
  success: boolean;
  data?: {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
  error?: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isValidStatusTransition(currentStatus: POStatus, newStatus: POStatus): boolean {
  const allowedTransitions = PO_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

// ============================================
// WAREHOUSE CHANGE: MOVE RECEIVED STOCK
// ============================================

interface StockMove {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
}

interface WarehouseMove {
  toLocationId: string;
  moves: StockMove[];
  /** Received on the PO but with no receive movement (e.g. imported data) */
  untrackedQty: number;
}

/**
 * Where this PO's received tires are in stock now, from its inventory movements
 * (receive + transfers referencing the PO), and what has to move to the new warehouse.
 *
 * Only tires sitting in the PO's OLD warehouse move (the container was re-routed).
 * Tires received into another warehouse stay where they physically are, e.g. a
 * GDC Inventory PO received into Kansas keeps those tires in Kansas when the PO
 * warehouse is later set to Nebraska.
 */
async function planWarehouseMove(
  poId: string,
  fromLocationId: string | null,
  toLocationId: string | null
): Promise<WarehouseMove | { error: string }> {
  const [{ data: movements, error }, { data: items }] = await Promise.all([
    db
      .from('inventory_movements')
      .select('product_id, location_id, quantity')
      .eq('reference_type', 'purchase_order')
      .eq('reference_id', poId)
      .in('movement_type', ['receive', 'transfer_in', 'transfer_out']),
    db
      .from('purchase_order_items')
      .select('quantity_received')
      .eq('purchase_order_id', poId),
  ]);
  if (error) {
    return { error: `Could not load the stock received from this PO: ${error.message}` };
  }

  // Net stock from this PO per product and location
  const net = new Map<string, { productId: string; locationId: string; quantity: number }>();
  for (const m of movements || []) {
    const key = `${m.product_id}|${m.location_id}`;
    const row = net.get(key) || { productId: m.product_id, locationId: m.location_id, quantity: 0 };
    row.quantity += Number(m.quantity) || 0;
    net.set(key, row);
  }

  const inStock = [...net.values()].filter((r) => r.quantity > 0);
  const trackedQty = inStock.reduce((t, r) => t + r.quantity, 0);
  const receivedQty = (items || []).reduce((t, i) => t + Number(i.quantity_received ?? 0), 0);

  const toMove = inStock.filter((r) => !!fromLocationId && r.locationId === fromLocationId && r.locationId !== toLocationId);
  const untrackedQty = Math.max(0, receivedQty - trackedQty);
  if (toMove.length === 0) {
    return { toLocationId: toLocationId ?? '', moves: [], untrackedQty };
  }

  // Tires in the old warehouse need a real warehouse to go to
  if (!toLocationId) {
    return { error: 'Tires of this PO are already received into its warehouse, so it needs a warehouse. Select the warehouse they are in now.' };
  }
  const { data: location } = await db
    .from('locations')
    .select('id, location_code, location_type')
    .eq('id', toLocationId)
    .maybeSingle();
  if (!location || location.location_type !== 'warehouse' || location.location_code === 'GDC-INV') {
    return { error: 'Received tires can only move to a physical warehouse (not GDC Inventory).' };
  }

  const moves: StockMove[] = toMove.map((r) => ({
    productId: r.productId,
    fromLocationId: r.locationId,
    toLocationId,
    quantity: r.quantity,
  }));

  // Every source must have the tires free (not allocated to orders) before any move
  for (const move of moves) {
    const { data: stock } = await db
      .from('inventory')
      .select('on_hand, allocated, products(sku), locations(name)')
      .eq('product_id', move.productId)
      .eq('location_id', move.fromLocationId)
      .maybeSingle();
    const available = stock ? Number(stock.on_hand) - Number(stock.allocated) : 0;
    if (available < move.quantity) {
      const sku = (stock?.products as { sku?: string } | null)?.sku || 'a product';
      const from = (stock?.locations as { name?: string } | null)?.name || 'the current warehouse';
      return {
        error: `Cannot move ${move.quantity} x ${sku} from ${from}: only ${Math.max(0, available)} there are free (the rest are allocated to orders or already shipped). Nothing was changed.`,
      };
    }
  }

  return { toLocationId, moves, untrackedQty };
}

function reverseStockMoves(moves: StockMove[]): StockMove[] {
  return moves.map((m) => ({ ...m, fromLocationId: m.toLocationId, toLocationId: m.fromLocationId }));
}

/** Transfer the stock; undoes the moves already done if one fails. Returns an error or null. */
async function applyStockMoves(
  moves: StockMove[],
  reference: { type: string; id: string; number: string },
  userId?: string
): Promise<string | null> {
  const { inventoryRepository } = await import('@/features/inventory/repositories/inventory.repository');
  const done: StockMove[] = [];
  for (const move of moves) {
    try {
      await inventoryRepository.transfer(move.productId, move.fromLocationId, move.toLocationId, move.quantity, userId, reference);
      done.push(move);
    } catch (error) {
      for (const undo of reverseStockMoves(done).reverse()) {
        await inventoryRepository
          .transfer(undo.productId, undo.fromLocationId, undo.toLocationId, undo.quantity, userId, reference)
          .catch((err) => console.error('[PO warehouse] Failed to undo stock transfer:', err));
      }
      return `Could not move the received stock: ${error instanceof Error ? error.message : 'unknown error'}. Nothing was changed.`;
    }
  }
  return null;
}

/** Leftover container tires earmarked for the old warehouse now go to the new one */
async function moveContainerAllocations(poId: string, fromLocationId: string | null, toLocationId: string): Promise<void> {
  if (!fromLocationId) {
    return;
  }
  const { error } = await db
    .from('fulfillment_allocations')
    .update({ location_id: toLocationId, updated_at: new Date().toISOString() })
    .eq('purchase_order_id', poId)
    .eq('location_id', fromLocationId)
    .neq('status', 'cancelled');
  if (error) {
    console.error('[PO warehouse] Failed to move container allocations:', error);
  }
}

/** A PO can be edited at any status except cancelled (Nov 2026: edit any time) */
const isEditablePO = (status: string) => status !== 'cancelled';

type ItemChange = NonNullable<UpdatePOInput['items']>[number];

/**
 * Checks that an item edit does not lose tires already received into stock or
 * allocated to customer orders. Returns an error message, or null when OK.
 */
async function checkItemChanges(poId: string, items: ItemChange[]): Promise<string | null> {
  const [{ data: rows, error: rowsError }, { data: allocations, error: allocError }] = await Promise.all([
    db.from('purchase_order_items').select('id, sku, product_id, quantity_received').eq('purchase_order_id', poId),
    db
      .from('fulfillment_allocations')
      .select('quantity, sales_order_items (product_id)')
      .eq('purchase_order_id', poId)
      .neq('status', 'cancelled'),
  ]);
  if (rowsError || allocError) {
    return 'Could not check received and allocated quantities';
  }

  const incomingById = new Map(items.filter((i) => i.id).map((i) => [i.id as string, i]));
  for (const row of rows ?? []) {
    const received = Number(row.quantity_received ?? 0);
    const next = incomingById.get(row.id);
    if (!next && received > 0) {
      return `${row.sku}: ${received} tires were already received, so this item cannot be removed`;
    }
    if (next && received > 0 && next.productId !== row.product_id) {
      return `${row.sku}: ${received} tires were already received, so the product cannot be changed`;
    }
    if (next && next.quantityOrdered < received) {
      return `${row.sku}: quantity cannot be lower than the ${received} tires already received`;
    }
  }

  // Tires allocated to customer orders, per product, must stay on the PO
  const allocatedByProduct = new Map<string, number>();
  for (const a of (allocations ?? []) as unknown as Array<{ quantity: number; sales_order_items: { product_id: string | null } | null }>) {
    const productId = a.sales_order_items?.product_id;
    if (productId) {
      allocatedByProduct.set(productId, (allocatedByProduct.get(productId) ?? 0) + Number(a.quantity ?? 0));
    }
  }
  for (const [productId, allocated] of allocatedByProduct) {
    const ordered = items.filter((i) => i.productId === productId).reduce((t, i) => t + i.quantityOrdered, 0);
    if (ordered < allocated) {
      const sku = (rows ?? []).find((r) => r.product_id === productId)?.sku ?? 'Product';
      return `${sku}: ${allocated} tires are allocated to customer orders, so the quantity cannot be lower than ${allocated}`;
    }
  }
  return null;
}

/**
 * Keeps the load shipment quantity in step with the PO after an item edit.
 * Only when the PO has exactly one shipment and it carried the old PO total
 * (a split or hand-set shipment quantity is left alone).
 */
async function syncShipmentQuantity(poId: string, oldTotal: number, newTotal: number): Promise<void> {
  if (oldTotal === newTotal) {
    return;
  }
  const { data: shipments } = await db
    .from('shipments')
    .select('id, total_qty')
    .eq('purchase_order_id', poId)
    .is('deleted_at', null);
  if (shipments?.length === 1 && Number(shipments[0]!.total_qty ?? 0) === oldTotal) {
    const { error } = await db
      .from('shipments')
      .update({ total_qty: newTotal, updated_at: new Date().toISOString() })
      .eq('id', shipments[0]!.id);
    if (error) {
      console.error('[PurchaseOrderService] Shipment quantity sync failed:', error);
    }
  }
}

export const purchaseOrderService = {
  /**
   * Get paginated list of purchase orders
   */
  async list(params: POListParams = {}): Promise<PaginatedServiceResult<POListItem>> {
    try {
      const result = await purchaseOrderRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('PurchaseOrderService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch purchase orders',
      };
    }
  },

  /**
   * Get a single PO by ID
   */
  async getById(id: string): Promise<ServiceResult<PurchaseOrderWithItems>> {
    try {
      const po = await purchaseOrderRepository.findById(id);

      if (!po) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch purchase order',
      };
    }
  },

  /**
   * Create a new PO
   */
  async create(
    input: CreatePOInput,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrderWithItems>> {
    try {
      const validation = createPurchaseOrderSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check for duplicate PO number if manually entered
      if (input.poNumber && input.poNumber.trim() !== '') {
        const existing = await purchaseOrderRepository.findByPONumber(input.poNumber.trim());
        if (existing) {
          return {
            success: false,
            error: `Purchase order number "${input.poNumber}" already exists.`,
            errors: { poNumber: [`PO number "${input.poNumber}" already exists`] },
          };
        }
      }

      const po = await purchaseOrderRepository.create(validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'purchase_orders',
        'PurchaseOrder',
        po.id,
        purchaseOrderToAuditData(po),
        { userId },
        `Created purchase order: ${po.poNumber}`
      ).catch((err) => {
        console.error('Failed to log purchase order create audit:', err);
      });

      // Send notification (async, non-blocking)
      this.sendPurchaseOrderCreatedNotification(po, userId).catch((err) => {
        console.error('Failed to send purchase order created notification:', err);
      });

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.create error:', error);
      return {
        success: false,
        error: 'Failed to create purchase order',
      };
    }
  },

  /**
   * Send notification for purchase order created (helper method)
   */
  async sendPurchaseOrderCreatedNotification(
    po: PurchaseOrderWithItems,
    userId?: string
  ): Promise<void> {
    const { notificationService } = await import('@/features/notifications/services/notification.service');

    // Get supplier name from items (supplier is at item level)
    const supplierName = po.items?.[0]?.supplierName || 'Unknown Supplier';

    // Notify internal users about PO creation
    await notificationService.notifyPurchaseOrderCreated({
      purchaseOrderId: po.id,
      poNumber: po.poNumber,
      supplierName,
      totalAmount: po.grandTotal,
      createdBy: userId,
    });

    // Notify supplier users about PO assignment
    // Get unique supplier IDs from items
    const supplierIds = [...new Set(
      po.items
        ?.map(item => item.supplierId)
        .filter((id): id is string => !!id) || []
    )];

    // Send notification to each supplier
    for (const supplierId of supplierIds) {
      const supplierItems = po.items?.filter(item => item.supplierId === supplierId) || [];
      await notificationService.notifySupplierPOAssigned({
        poId: po.id,
        poNumber: po.poNumber,
        supplierId,
        totalAmount: po.grandTotal,
        itemCount: supplierItems.length,
        createdBy: userId,
      });
    }
  },

  /**
   * Update an existing PO
   */
  async update(
    id: string,
    input: UpdatePOInput,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!isEditablePO(existing.status)) {
        return {
          success: false,
          error: `Cannot edit purchase order in ${existing.status} status`,
        };
      }

      const validation = updatePurchaseOrderSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const poNumber = validation.data.poNumber;
      if (poNumber !== undefined && poNumber !== existing.poNumber) {
        const duplicate = await purchaseOrderRepository.findByPONumber(poNumber);
        if (duplicate && duplicate.id !== id) {
          return {
            success: false,
            error: `Purchase order number "${poNumber}" already exists.`,
            errors: { poNumber: [`PO number "${poNumber}" already exists`] },
          };
        }
      }

      // Items: never lose tires already received or allocated to customer orders
      const newItems = validation.data.items;
      if (newItems && newItems.length > 0) {
        const problem = await checkItemChanges(id, newItems);
        if (problem) {
          return { success: false, error: problem };
        }
      }

      // Warehouse: tires already received into the PO's old warehouse move with it
      // to the new warehouse (stock transfer); tires received elsewhere stay put.
      // Checked here, applied before the PO saves (and undone if the save fails).
      const newWarehouseId = validation.data.warehouseId;
      let warehouseMove: WarehouseMove | null = null;
      if (newWarehouseId !== undefined && (newWarehouseId || null) !== (existing.warehouseId || null)) {
        const receivedQty = (existing.items ?? []).reduce((t, i) => t + Number(i.quantityReceived ?? 0), 0);
        if (receivedQty > 0) {
          const plan = await planWarehouseMove(id, existing.warehouseId || null, newWarehouseId || null);
          if ('error' in plan) {
            return { success: false, error: plan.error };
          }
          warehouseMove = plan;
        }
      }

      // Capture old data for audit before update
      const oldAuditData = purchaseOrderToAuditData(existing);
      const oldTotalQty = (existing.items ?? []).reduce((t, i) => t + Number(i.quantityOrdered ?? 0), 0);

      // Move the received stock first; if the PO then fails to save, move it back
      const reference = { type: 'purchase_order', id, number: existing.poNumber };
      if (warehouseMove) {
        const moveError = await applyStockMoves(warehouseMove.moves, reference, userId);
        if (moveError) {
          return { success: false, error: moveError };
        }
      }

      let po: PurchaseOrder;
      try {
        po = await purchaseOrderRepository.update(id, validation.data, userId);
      } catch (error) {
        if (warehouseMove) {
          await applyStockMoves(reverseStockMoves(warehouseMove.moves), reference, userId);
        }
        throw error;
      }

      // Leftover container tires follow the PO to its new warehouse, also when
      // nothing has been received yet (container re-routed while in transit)
      const warehouseChanged =
        newWarehouseId !== undefined && (newWarehouseId || null) !== (existing.warehouseId || null);
      if (warehouseChanged && newWarehouseId) {
        await moveContainerAllocations(id, existing.warehouseId || null, newWarehouseId);
      }

      if (newItems && newItems.length > 0) {
        await syncShipmentQuantity(id, oldTotalQty, newItems.reduce((t, i) => t + i.quantityOrdered, 0));
      }

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'purchase_orders',
        'PurchaseOrder',
        po.id,
        oldAuditData,
        purchaseOrderToAuditData(po),
        { userId },
        `Updated purchase order: ${po.poNumber}`
      ).catch((err) => {
        console.error('Failed to log purchase order update audit:', err);
      });

      return {
        success: true,
        data: po,
        ...(warehouseMove?.untrackedQty
          ? { warning: `${warehouseMove.untrackedQty} received tires have no receive record in inventory, so their stock was not moved. Adjust it on the Inventory page if needed.` }
          : {}),
      };
    } catch (error) {
      console.error('PurchaseOrderService.update error:', error);
      return {
        success: false,
        error: 'Failed to update purchase order',
      };
    }
  },

  /**
   * Soft delete a PO
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft purchase orders can be deleted',
        };
      }

      const po = await purchaseOrderRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'purchase_orders',
        'PurchaseOrder',
        po.id,
        purchaseOrderToAuditData(existing),
        { userId },
        `Deleted purchase order: ${po.poNumber}`
      ).catch((err) => {
        console.error('Failed to log purchase order delete audit:', err);
      });

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete purchase order',
      };
    }
  },

  // ==========================================
  // INLINE UPDATE METHODS
  // ==========================================

  /**
   * Update supplier for all items in a PO
   */
  async updateSupplier(
    id: string,
    supplierId: string | null,
    supplierName: string | null,
    userId?: string
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!isEditablePO(existing.status)) {
        return {
          success: false,
          error: `Cannot edit purchase order in ${existing.status} status`,
        };
      }

      // Use db (service role) to bypass RLS
      const { error } = await db
        .from('purchase_order_items')
        .update({
          supplier_id: supplierId,
          supplier_name: supplierName,
          updated_by: userId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('purchase_order_id', id);

      if (error) {
        console.error('[updateSupplier] Error:', error);
        return {
          success: false,
          error: 'Failed to update supplier',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('PurchaseOrderService.updateSupplier error:', error);
      return {
        success: false,
        error: 'Failed to update supplier',
      };
    }
  },

  /**
   * Update order series for a PO
   */
  async updateOrderSeries(
    id: string,
    orderSeries: string | null,
    userId?: string
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!isEditablePO(existing.status)) {
        return {
          success: false,
          error: `Cannot edit purchase order in ${existing.status} status`,
        };
      }

      // Use db (service role) to bypass RLS
      const { error } = await db
        .from('purchase_orders')
        .update({
          order_series: orderSeries,
          updated_by: userId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('[updateOrderSeries] Error:', error);
        return {
          success: false,
          error: 'Failed to update order series',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('PurchaseOrderService.updateOrderSeries error:', error);
      return {
        success: false,
        error: 'Failed to update order series',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Send PO (draft -> sent)
   */
  async send(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'sent', userId);
  },

  /**
   * Confirm PO (sent -> confirmed)
   * Also auto-creates a shipment with source='supplier' for Supplier Schedule
   */
  async confirm(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    const result = await this.transitionStatus(id, 'confirmed', userId);

    // If PO confirmed successfully, auto-create shipment with source='supplier'
    if (result.success && result.data) {
      try {
        await this.createSupplierShipment(id, userId);
      } catch (error) {
        console.error('Failed to auto-create supplier shipment:', error);
        // Don't fail the PO confirmation if shipment creation fails
      }
    }

    return result;
  },

  /**
   * Auto-create shipment from PO for Supplier Schedule (source='supplier')
   * Uses service role client to bypass RLS (suppliers can't INSERT shipments directly)
   */
  async createSupplierShipment(poId: string, userId?: string): Promise<void> {
    // Import db client for service role access (bypass RLS)
    const { db } = await import('@/shared/lib/supabase/database');

    // Check if shipment already exists for this PO
    const { data: existingPOShipment } = await db
      .from('shipments')
      .select('id, shipment_number')
      .eq('purchase_order_id', poId)
      .maybeSingle();

    if (existingPOShipment) {
      console.log(`[createSupplierShipment] Shipment ${existingPOShipment.shipment_number} already exists for PO ${poId}`);
      return; // Shipment already exists, no need to create
    }

    // Get PO with items
    const po = await purchaseOrderRepository.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Ensure items exist
    if (!po.items || po.items.length === 0) {
      console.warn(`[createSupplierShipment] PO ${po.poNumber} has no items, creating shipment without items`);
    }

    // Generate shipment number from PO number
    // PO format: PO-2600052 or PO-2600052-A → Shipment format: SO2600052 or SO2600052-A
    // Extract the number part from PO (remove "PO-" prefix)
    const poNumberPart = po.poNumber.replace(/^PO-?/i, '');
    const desiredShipmentNumber = `SO${poNumberPart}`;

    // Check if shipment number already exists (different PO might have same number)
    const { data: existingShipment } = await db
      .from('shipments')
      .select('id')
      .eq('shipment_number', desiredShipmentNumber)
      .maybeSingle();

    let shipmentNumber: string;
    if (existingShipment) {
      // Shipment number exists, generate auto number
      const { data: autoShipmentNumber, error: shipmentNumberError } = await db.rpc('generate_shipment_number');
      if (shipmentNumberError || !autoShipmentNumber) {
        throw new Error(`Failed to generate shipment number: ${shipmentNumberError?.message}`);
      }
      shipmentNumber = autoShipmentNumber;
      console.log(`ℹ️ Shipment number ${desiredShipmentNumber} already exists, using auto-generated: ${shipmentNumber}`);
    } else {
      shipmentNumber = desiredShipmentNumber;
      console.log(`✅ Using PO-matched shipment number: ${shipmentNumber}`);
    }

    // Calculate total quantity (handle empty/undefined items)
    const items = po.items || [];
    const totalQty = items.reduce((sum, item) => sum + (item.quantityOrdered || 0), 0);

    // Get supplier_id from first PO item (item-level supplier)
    const supplierId = items[0]?.supplierId || null;

    // Map PO status to shipment status
    // Valid shipment status values: 'pending', 'in_transit', 'delivered', 'failed'
    // Note: load_status is a separate field that can be 'available', 'sold', etc.
    const getShipmentStatus = (poStatus: string): string => {
      switch (poStatus) {
        case 'confirmed':
        case 'in_production':
        case 'ready_to_ship':
          return 'pending'; // Shipment is pending until it's actually in transit
        case 'in_transit':
          return 'in_transit';
        case 'received':
          return 'delivered';
        default:
          return 'pending'; // Default to pending for new shipments
      }
    };

    const shipmentStatus = getShipmentStatus(po.status);

    // Create shipment with source='supplier' (using service role to bypass RLS)
    const { data: shipment, error: shipmentError } = await db
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        shipment_date: new Date().toISOString().split('T')[0],
        estimated_arrival: po.expectedDeliveryDate?.toISOString().split('T')[0] || null,
        sales_order_id: po.salesOrderId || null,
        purchase_order_id: po.id,
        supplier_id: supplierId,
        source: 'supplier',
        load_status: 'available',
        total_qty: totalQty,
        outstanding_qty: totalQty,
        ship_to_address_street: po.shipToAddressStreet,
        ship_to_address_city: po.shipToAddressCity,
        ship_to_address_state: po.shipToAddressState,
        ship_to_address_postal_code: po.shipToAddressPostalCode,
        ship_to_address_country: po.shipToAddressCountry,
        status: shipmentStatus, // Mapped from PO status
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (shipmentError) {
      throw new Error(`Failed to create shipment: ${shipmentError.message}`);
    }

    // Create shipment items (only if PO has items)
    if (items.length > 0) {
      const shipmentItems = items.map((item, index) => ({
        shipment_id: shipment.id,
        product_id: item.productId,
        purchase_order_item_id: item.id,
        sku: item.sku,
        description: item.description,
        quantity_shipped: item.quantityOrdered,
        sort_order: index,
        created_by: userId || null,
        updated_by: userId || null,
      }));

      const { error: itemsError } = await db
        .from('shipment_items')
        .insert(shipmentItems);

      if (itemsError) {
        // Clean up shipment if items insertion fails
        await db.from('shipments').delete().eq('id', shipment.id);
        throw new Error(`Failed to create shipment items: ${itemsError.message}`);
      }
    }

    console.log(`[PO Confirm] ✅ Auto-created shipment ${shipmentNumber} with source='supplier' for PO ${po.poNumber}`);
  },

  /**
   * Mark as partially received (confirmed -> partial)
   */
  async markPartial(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'partial', userId);
  },

  /**
   * Mark as fully received (confirmed/partial -> received)
   */
  async markReceived(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'received', userId);
  },

  /**
   * Cancel PO
   */
  async cancel(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'cancelled', userId);
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: POStatus,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const po = await purchaseOrderRepository.updateStatus(id, newStatus, userId);

      // Log audit event for status change (fire and forget)
      auditService.log({
        action: 'update', // status_change
        module: 'purchase_orders',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        oldData: { status: existing.status },
        newData: { status: newStatus },
        userId,
        description: `Purchase order ${po.poNumber} status changed: ${existing.status} → ${newStatus}`,
      }).catch((err) => {
        console.error('Failed to log purchase order status change audit:', err);
      });

      // Marked received: put clear stock POs into warehouse stock (once)
      if (newStatus === 'received') {
        const { poReceivingService } = await import('@/features/inventory/services/po-receiving.service');
        await poReceivingService.autoReceiveForPurchaseOrder(id, userId);
      }

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update purchase order status',
      };
    }
  },

  /**
   * Update Supplier/Production Status
   * Updates PO status and creates shipment if needed
   * When status changes to "confirmed" or "in_production", shipment is auto-created
   */
  async updateSupplierStatus(
    id: string,
    newStatus: string,
    userId?: string
  ): Promise<ServiceResult<{ shipmentCreated?: boolean; shipmentNumber?: string }>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      // Check if valid status transition
      if (!isValidStatusTransition(existing.status, newStatus as POStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      // Update PO status
      const po = await purchaseOrderRepository.updateStatus(id, newStatus as POStatus, userId);

      // Check if shipment should be created
      // Create shipment when:
      // 1. Status changes to "confirmed" OR "in_production"
      // 2. AND no shipment exists yet
      const shouldCreateShipment =
        (newStatus === 'confirmed' || newStatus === 'in_production') &&
        (existing.status === 'draft' || existing.status === 'sent');

      let shipmentCreated = false;
      let shipmentNumber: string | undefined;

      if (shouldCreateShipment) {
        // Check if shipment already exists
        const { data: existingShipments } = await db
          .from('shipments')
          .select('id, shipment_number')
          .eq('purchase_order_id', id)
          .limit(1);

        if (!existingShipments || existingShipments.length === 0) {
          // Create shipment using existing logic
          try {
            await this.createSupplierShipment(id, userId);
            shipmentCreated = true;

            // Get the created shipment number
            const { data: newShipment } = await db
              .from('shipments')
              .select('shipment_number')
              .eq('purchase_order_id', id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            shipmentNumber = newShipment?.shipment_number;

            console.log(`[updateSupplierStatus] Auto-created shipment ${shipmentNumber} for PO ${po.poNumber} (status: ${newStatus})`);
          } catch (shipmentError) {
            console.error('[updateSupplierStatus] Failed to create shipment:', shipmentError);
            // Continue - status was updated successfully, shipment creation is secondary
          }
        }
      } else {
        // Update existing shipment status if shipment exists
        // Valid shipment status values: 'pending', 'in_transit', 'delivered', 'failed'
        const getShipmentStatusFromPO = (poStatus: string): string => {
          switch (poStatus) {
            case 'in_transit':
              return 'in_transit';
            case 'received':
              return 'delivered';
            default:
              // All other statuses (confirmed, in_production, ready_to_ship, partial) = pending
              return 'pending';
          }
        };

        const { data: existingShipments } = await db
          .from('shipments')
          .select('id, shipment_number, status')
          .eq('purchase_order_id', id)
          .limit(1);

        const shipment = existingShipments?.[0];
        if (shipment) {
          const newShipmentStatus = getShipmentStatusFromPO(newStatus);

          if (shipment.status !== newShipmentStatus) {
            await db
              .from('shipments')
              .update({
                status: newShipmentStatus,
                updated_at: new Date().toISOString(),
                updated_by: userId,
              })
              .eq('id', shipment.id);

            console.log(`[updateSupplierStatus] Updated shipment ${shipment.shipment_number} status: ${shipment.status} → ${newShipmentStatus}`);
          }
        }
      }

      // Log audit event
      auditService.log({
        action: 'update',
        module: 'purchase_orders',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        oldData: { status: existing.status },
        newData: { status: newStatus, shipmentCreated },
        userId,
        description: `Purchase order ${po.poNumber} status changed: ${existing.status} → ${newStatus}${shipmentCreated ? ` (shipment ${shipmentNumber} created)` : ''}`,
      }).catch((err) => {
        console.error('Failed to log purchase order status change audit:', err);
      });

      // Marked received: put clear stock POs into warehouse stock (once)
      if (newStatus === 'received') {
        const { poReceivingService } = await import('@/features/inventory/services/po-receiving.service');
        await poReceivingService.autoReceiveForPurchaseOrder(id, userId);
      }

      return {
        success: true,
        data: {
          shipmentCreated,
          shipmentNumber,
        },
      };
    } catch (error) {
      console.error('PurchaseOrderService.updateSupplierStatus error:', error);
      return {
        success: false,
        error: 'Failed to update supplier status',
      };
    }
  },
};

export type PurchaseOrderService = typeof purchaseOrderService;
