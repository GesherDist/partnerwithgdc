'use server';

/**
 * Operations Dashboard Server Actions
 *
 * Server-side actions for Jenny's operations dashboard.
 * These are called from client components.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/shared/lib/supabase/database';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { getCurrentUser } from '@/shared/lib/auth';
import {
  getOperationsData,
  getStats,
  getAttentionItems,
  getSupplierSchedule,
  getWarehouseInventory,
  getRimItems,
  getExportData,
  getFilterOptionsData,
  type ExportOptions,
} from '../services';
import type {
  OperationsData,
  OperationsStats,
  ImmediateAttentionItem,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  RimInstallationItem,
  ShipmentStatus,
  SKUColumnInfo,
  OperationsFilters,
  FilterOptions,
} from '../types';

// ============================================
// RESULT TYPE
// ============================================

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// FETCH ALL DASHBOARD DATA
// ============================================

/**
 * Fetch all operations dashboard data
 */
export async function fetchOperationsData(filters?: OperationsFilters): Promise<ActionResult<OperationsData>> {
  try {
    const data = await getOperationsData(filters);
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching operations data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch operations data',
    };
  }
}

/**
 * Fetch filter options for dropdowns
 */
export async function fetchFilterOptions(): Promise<ActionResult<FilterOptions>> {
  try {
    const data = await getFilterOptionsData();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch filter options',
    };
  }
}

// ============================================
// FETCH INDIVIDUAL SECTIONS
// ============================================

/**
 * Fetch just the KPI stats
 */
export async function fetchOperationsStats(): Promise<ActionResult<OperationsStats>> {
  try {
    const data = await getStats();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
    };
  }
}

/**
 * Fetch immediate attention items
 */
export async function fetchImmediateAttention(): Promise<ActionResult<ImmediateAttentionItem[]>> {
  try {
    const data = await getAttentionItems();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching attention items:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch attention items',
    };
  }
}

/**
 * Fetch supplier shipment schedule
 */
export async function fetchSupplierSchedule(): Promise<ActionResult<{ data: ShipmentScheduleItem[]; uniqueSkus: SKUColumnInfo[] }>> {
  try {
    const result = await getSupplierSchedule();
    return { success: true, data: result };
  } catch (error) {
    console.error('Error fetching supplier schedule:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch supplier schedule',
    };
  }
}

/**
 * Fetch GDC1 inventory
 */
export async function fetchGDC1Inventory(): Promise<ActionResult<{ data: GDC1InventoryItem[]; uniqueSkus: SKUColumnInfo[] }>> {
  try {
    const result = await getWarehouseInventory();
    return { success: true, data: result };
  } catch (error) {
    console.error('Error fetching GDC1 inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch GDC1 inventory',
    };
  }
}

/**
 * Fetch rim installation items
 */
export async function fetchRimInstallation(): Promise<ActionResult<RimInstallationItem[]>> {
  try {
    const result = await getRimItems();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error fetching rim installation items:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch rim installation items',
    };
  }
}

// ============================================
// REFRESH DATA
// ============================================

/**
 * Refresh all dashboard data (called by refresh button)
 */
export async function refreshOperationsData(filters?: OperationsFilters): Promise<ActionResult<OperationsData>> {
  return fetchOperationsData(filters);
}

// ============================================
// EXPORT DATA
// ============================================

/**
 * Get data for Excel export
 */
export async function fetchExportData(
  options?: ExportOptions
): Promise<ActionResult<Partial<OperationsData>>> {
  try {
    const data = await getExportData(options);
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching export data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch export data',
    };
  }
}

// ============================================
// UPDATE SHIPMENT STATUS (Jenny's manual update)
// ============================================

export interface UpdateShipmentStatusInput {
  shipmentId: string;
  loadStatus?: ShipmentStatus;
  actionRequired?: string;
  confirmedEta?: string | null;
  actualDeliveryDate?: string | null;
  qtyDelivered?: number;
  notes?: string;
}

/**
 * Update shipment status and notes
 * Used by Jenny to manually update load status
 */
export async function updateShipmentStatus(
  input: UpdateShipmentStatusInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Map ShipmentStatus to database load_status
    const loadStatusMap: Record<ShipmentStatus, string> = {
      'AVAILABLE': 'available',
      'OPEN': 'open',
      'HOLD': 'hold',
      'IN_TRANSIT': 'in_transit',
      'SOLD': 'sold',
      'CLOSED': 'closed',
      'INVOICED': 'invoiced',
      'NOT_INVOICED': 'not_invoiced',
      'PARTIALLY_PAID': 'partially_paid',
      'PAID': 'paid',
      'DISPUTED': 'disputed',
      'PO_NEEDED': 'po_needed',
      'DELIVERED': 'delivered',
      'CONFIRMED': 'confirmed',
      'PROCESSING': 'processing',
    };

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (input.loadStatus) {
      updateData.load_status = loadStatusMap[input.loadStatus] || input.loadStatus.toLowerCase();

      // Also update main status for certain load statuses
      if (input.loadStatus === 'IN_TRANSIT') {
        updateData.status = 'in_transit';
      } else if (input.loadStatus === 'DELIVERED') {
        updateData.status = 'delivered';
      }
    }

    if (input.actionRequired !== undefined) {
      updateData.action_required = input.actionRequired;
    }

    if (input.confirmedEta !== undefined) {
      updateData.confirmed_eta = input.confirmedEta;
    }

    if (input.actualDeliveryDate !== undefined) {
      updateData.actual_arrival = input.actualDeliveryDate;
    }

    if (input.qtyDelivered !== undefined) {
      updateData.qty_delivered = input.qtyDelivered;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const { error } = await db
      .from('shipments')
      .update(updateData)
      .eq('id', input.shipmentId);

    if (error) {
      console.error('Error updating shipment:', error);
      return { success: false, error: error.message };
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { id: input.shipmentId } };
  } catch (error) {
    console.error('Error updating shipment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update shipment',
    };
  }
}

/**
 * Bulk update shipment statuses
 * Useful for batch operations
 */
export async function bulkUpdateShipmentStatus(
  updates: UpdateShipmentStatusInput[]
): Promise<ActionResult<{ updated: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    let updatedCount = 0;

    for (const input of updates) {
      const result = await updateShipmentStatus(input);
      if (result.success) {
        updatedCount++;
      }
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { updated: updatedCount } };
  } catch (error) {
    console.error('Error bulk updating shipments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk update shipments',
    };
  }
}

// ============================================
// GET SHIPMENT FOR EDIT
// ============================================

export interface ShipmentEditData {
  id: string;
  shipmentNumber: string;
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPoNumber: string | null;
  loadStatus: string | null;
  totalQty: number;
  etaToPort: string | null;
  customerExpectedDelivery: string | null;
  actionRequired: string | null;
  notes: string | null;
}

/**
 * Get shipment data for editing
 */
export async function getShipmentForEdit(
  shipmentId: string
): Promise<ActionResult<ShipmentEditData>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await db
      .from('shipments')
      .select(`
        id,
        shipment_number,
        sales_order_id,
        load_status,
        total_qty,
        eta_to_port,
        customer_expected_delivery,
        action_required,
        notes,
        sales_orders(
          id,
          order_number,
          customer_po_number,
          customer_id,
          customers(
            id,
            name
          )
        )
      `)
      .eq('id', shipmentId)
      .single();

    if (error) {
      console.error('Error fetching shipment:', error);
      return { success: false, error: error.message };
    }

    // Extract nested data
    const salesOrder = Array.isArray(data.sales_orders)
      ? data.sales_orders[0]
      : data.sales_orders;
    const customer = salesOrder?.customers
      ? (Array.isArray(salesOrder.customers) ? salesOrder.customers[0] : salesOrder.customers)
      : null;

    return {
      success: true,
      data: {
        id: data.id,
        shipmentNumber: data.shipment_number,
        salesOrderId: data.sales_order_id,
        salesOrderNumber: salesOrder?.order_number || null,
        customerId: customer?.id || null,
        customerName: customer?.name || null,
        customerPoNumber: salesOrder?.customer_po_number || null,
        loadStatus: data.load_status,
        totalQty: data.total_qty || 0,
        etaToPort: data.eta_to_port,
        customerExpectedDelivery: data.customer_expected_delivery,
        actionRequired: data.action_required,
        notes: data.notes,
      },
    };
  } catch (error) {
    console.error('Error fetching shipment for edit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch shipment',
    };
  }
}

// ============================================
// GET SALES ORDERS FOR DROPDOWN
// ============================================

export interface SalesOrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPoNumber: string | null;
}

/**
 * Get sales orders for dropdown selection
 */
export async function getSalesOrdersForDropdown(): Promise<ActionResult<SalesOrderOption[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_po_number,
        customers(
          id,
          name
        )
      `)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching sales orders:', error);
      return { success: false, error: error.message };
    }

    const options: SalesOrderOption[] = (data || []).map((so) => {
      const customer = Array.isArray(so.customers) ? so.customers[0] : so.customers;
      return {
        id: so.id,
        orderNumber: so.order_number,
        customerName: customer?.name || 'Unknown',
        customerPoNumber: so.customer_po_number,
      };
    });

    return { success: true, data: options };
  } catch (error) {
    console.error('Error fetching sales orders for dropdown:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sales orders',
    };
  }
}

// ============================================
// UPDATE SHIPMENT (Full Edit)
// ============================================

export interface UpdateShipmentInput {
  shipmentId: string;
  salesOrderId?: string | null;
  loadStatus?: string;
  etaToPort?: string | null;
  customerExpectedDelivery?: string | null;
  actionRequired?: string | null;
  notes?: string | null;
}

/**
 * Update shipment with sales order link and other fields
 */
export async function updateShipment(
  input: UpdateShipmentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (input.salesOrderId !== undefined) {
      updateData.sales_order_id = input.salesOrderId || null;
    }

    if (input.loadStatus !== undefined) {
      updateData.load_status = input.loadStatus;

      // Also update main status for certain load statuses
      if (input.loadStatus === 'in_transit') {
        updateData.status = 'in_transit';
      } else if (input.loadStatus === 'delivered') {
        updateData.status = 'delivered';
      }
    }

    if (input.etaToPort !== undefined) {
      updateData.eta_to_port = input.etaToPort || null;
    }

    if (input.customerExpectedDelivery !== undefined) {
      updateData.customer_expected_delivery = input.customerExpectedDelivery || null;
    }

    if (input.actionRequired !== undefined) {
      updateData.action_required = input.actionRequired || null;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes || null;
    }

    const { error } = await db
      .from('shipments')
      .update(updateData)
      .eq('id', input.shipmentId);

    if (error) {
      console.error('Error updating shipment:', error);
      return { success: false, error: error.message };
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { id: input.shipmentId } };
  } catch (error) {
    console.error('Error updating shipment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update shipment',
    };
  }
}

// ============================================
// UPDATE SHIPMENT OR ORDER (Smart Update)
// ============================================

export interface UpdateShipmentOrOrderInput {
  id: string;
  status: string; // ShipmentStatus for shipments/SOs, or PO status for POs (confirmed, sent, draft, etc.)
  etaToPort?: string | null;
  customerExpectedDelivery?: string | null;
  actionRequired?: string | null;
}

/**
 * Smart update that tries shipments first, then sales_orders
 * Used by the simplified edit dialog
 */
export async function updateShipmentOrOrder(
  input: UpdateShipmentOrOrderInput
): Promise<ActionResult<{ id: string }>> {
  try {
    console.log('[updateShipmentOrOrder] Starting update with input:', JSON.stringify(input, null, 2));

    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Use admin client to bypass RLS policies
    const supabase = createAdminClient();

    // Map ShipmentStatus to database values (based on Jenny's Master Sheet)
    const statusMap: Record<ShipmentStatus, { loadStatus: string; soStatus: string }> = {
      // Common statuses
      'AVAILABLE': { loadStatus: 'available', soStatus: 'pending' },
      'OPEN': { loadStatus: 'open', soStatus: 'pending' },
      'IN_TRANSIT': { loadStatus: 'in_transit', soStatus: 'shipped' },
      'SOLD': { loadStatus: 'sold', soStatus: 'confirmed' },
      'HOLD': { loadStatus: 'hold', soStatus: 'pending' },
      'CLOSED': { loadStatus: 'closed', soStatus: 'cancelled' },
      // Invoice/Payment statuses
      'INVOICED': { loadStatus: 'invoiced', soStatus: 'delivered' },
      'NOT_INVOICED': { loadStatus: 'not_invoiced', soStatus: 'confirmed' },
      'PARTIALLY_PAID': { loadStatus: 'partially_paid', soStatus: 'delivered' },
      'PAID': { loadStatus: 'paid', soStatus: 'delivered' },
      'DISPUTED': { loadStatus: 'disputed', soStatus: 'pending' },
      // Other statuses
      'PO_NEEDED': { loadStatus: 'po_needed', soStatus: 'draft' },
      'DELIVERED': { loadStatus: 'delivered', soStatus: 'delivered' },
      'CONFIRMED': { loadStatus: 'confirmed', soStatus: 'confirmed' },
      'PROCESSING': { loadStatus: 'processing', soStatus: 'processing' },
    };

    const mapped = statusMap[input.status as ShipmentStatus] || { loadStatus: 'open', soStatus: 'pending' };

    // Try to update shipment first
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id')
      .eq('id', input.id)
      .single();

    console.log('[updateShipmentOrOrder] Checked shipments table:', { found: !!shipment, error: shipmentError?.message });

    if (shipment) {
      console.log('[updateShipmentOrOrder] UPDATING SHIPMENT');
      // Update shipment
      const updateData: Record<string, unknown> = {
        load_status: mapped.loadStatus,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      if (input.etaToPort !== undefined) {
        updateData.eta_to_port = input.etaToPort || null;
      }
      if (input.customerExpectedDelivery !== undefined) {
        updateData.customer_expected_delivery = input.customerExpectedDelivery || null;
      }
      if (input.actionRequired !== undefined) {
        updateData.action_required = input.actionRequired || null;
      }

      const { error } = await supabase
        .from('shipments')
        .update(updateData)
        .eq('id', input.id);

      if (error) {
        console.error('Error updating shipment:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Try sales_orders
      const { data: salesOrder, error: soError } = await supabase
        .from('sales_orders')
        .select('id')
        .eq('id', input.id)
        .single();

      console.log('[updateShipmentOrOrder] Checked sales_orders table:', { found: !!salesOrder, error: soError?.message });

      if (salesOrder) {
        console.log('[updateShipmentOrOrder] UPDATING SALES ORDER - status will be:', mapped.soStatus);
        // Update sales order
        const updateData: Record<string, unknown> = {
          status: mapped.soStatus,
          updated_at: new Date().toISOString(),
        };

        if (input.customerExpectedDelivery !== undefined) {
          updateData.requested_delivery_date = input.customerExpectedDelivery || null;
        }
        if (input.actionRequired !== undefined) {
          updateData.internal_notes = input.actionRequired || null;
        }

        const { error } = await supabase
          .from('sales_orders')
          .update(updateData)
          .eq('id', input.id);

        if (error) {
          console.error('Error updating sales order:', error);
          return { success: false, error: error.message };
        }
      } else {
        // Try purchase_orders
        const { data: purchaseOrder, error: poError } = await supabase
          .from('purchase_orders')
          .select('id')
          .eq('id', input.id)
          .single();

        console.log('[updateShipmentOrOrder] Checked purchase_orders table:', { found: !!purchaseOrder, error: poError?.message });

        if (purchaseOrder) {
          console.log('[updateShipmentOrOrder] UPDATING PURCHASE ORDER');
          // Update purchase order
          const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          // Only update status if it's a valid PO status (lowercase)
          const validPOStatuses = ['draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled'];
          const statusValue = input.status.toLowerCase();
          if (validPOStatuses.includes(statusValue)) {
            updateData.status = statusValue;
          }

          // Note: purchase_orders table doesn't have eta_to_us_port column
          // Only has expected_delivery_date
          if (input.customerExpectedDelivery !== undefined) {
            updateData.expected_delivery_date = input.customerExpectedDelivery || null;
          }
          if (input.actionRequired !== undefined) {
            updateData.internal_notes = input.actionRequired || null;
          }

          console.log('[PO Update] Updating PO:', input.id, 'with data:', updateData);

          const { error } = await supabase
            .from('purchase_orders')
            .update(updateData)
            .eq('id', input.id);

          if (error) {
            console.error('Error updating purchase order:', error);
            return { success: false, error: error.message };
          }

          console.log('[PO Update] Successfully updated PO:', input.id);
        } else {
          return { success: false, error: 'Record not found' };
        }
      }
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    console.log('[updateShipmentOrOrder] ✅ Update completed successfully for ID:', input.id);

    return { success: true, data: { id: input.id } };
  } catch (error) {
    console.error('Error updating record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update record',
    };
  }
}

// ============================================
// UPDATE SHIPMENT NOTES (Quick Edit)
// ============================================

/**
 * Quick update for shipment action_required notes
 * Used by EditNotesDialog for fast note updates
 */
export async function updateShipmentNotes(
  shipmentId: string,
  notes: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { error } = await db
      .from('shipments')
      .update({
        action_required: notes,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', shipmentId);

    if (error) {
      console.error('Error updating shipment notes:', error);
      return { success: false, error: error.message };
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { id: shipmentId } };
  } catch (error) {
    console.error('Error updating shipment notes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update notes',
    };
  }
}

/**
 * Quick update for sales order internal notes
 * Used when the item is a sales order (not shipment)
 */
export async function updateSalesOrderNotes(
  salesOrderId: string,
  notes: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { error } = await db
      .from('sales_orders')
      .update({
        internal_notes: notes,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', salesOrderId);

    if (error) {
      console.error('Error updating sales order notes:', error);
      return { success: false, error: error.message };
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { id: salesOrderId } };
  } catch (error) {
    console.error('Error updating sales order notes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update notes',
    };
  }
}

// ============================================
// GET SHIPMENT DETAIL BY ID (View Modal)
// ============================================

export interface ShipmentDetailData {
  id: string;
  shipmentNumber: string;
  shipmentDate: string;
  status: string;
  // Shipping Details
  containerNumber: string | null;
  billOfLading: string | null;
  vesselName: string | null;
  // Ports
  portOfLoading: string | null;
  portOfDischarge: string | null;
finalDestination: string | null;
  // Dates
  etd: string | null;
  etaPort: string | null;
  etaCustomer: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  lastFreeDay: string | null;
  // Customer
  customerName: string | null;
  customerPo: string | null;
  salesOrderNumber: string | null;
  // Ship To
  shipToName: string | null;
  shipToAddressStreet: string | null;
  shipToAddressCity: string | null;
  shipToAddressState: string | null;
  shipToAddressPostalCode: string | null;
  shipToAddressCountry: string | null;
  // Carrier
  carrier: string | null;
  trackingNumber: string | null;
  serviceType: string | null;
  // Items
  items: Array<{
    id: string;
    sku: string;
    description: string | null;
    quantityShipped: number;
  }>;
  // Package Info
  totalWeight: number | null;
  weightUnit: string;
  totalPackages: number;
  // Notes
  notes: string | null;
  actionRequired: string | null;
  deliveryInstructions: string | null;
  // Flags
  isDelayed: boolean;
}

/**
 * Get full shipment details for view modal
 * Handles both shipment IDs and sales order IDs (for orders without shipments)
 */
export async function getShipmentDetailById(
  itemId: string
): Promise<ShipmentDetailData> {
  console.log('[getShipmentDetailById] Looking for ID:', itemId);

  // First, try a simple check if shipment exists
  const { data: shipmentCheck, error: checkError } = await db
    .from('shipments')
    .select('id, shipment_number')
    .eq('id', itemId)
    .maybeSingle();

  console.log('[getShipmentDetailById] Simple check:', {
    found: !!shipmentCheck,
    shipmentNumber: shipmentCheck?.shipment_number,
    error: checkError?.message,
  });

  // If shipment exists, get full details
  if (shipmentCheck) {
    const { data: shipmentData, error: shipmentError } = await db
      .from('shipments')
      .select(`
        id,
        shipment_number,
        shipment_date,
        status,
        container_number,
        bill_of_lading,
        vessel_name,
        port_of_loading,
        port_of_discharge,
final_destination,
        etd,
        eta_port,
        eta_customer,
        estimated_arrival,
        actual_arrival,
        lfd_date,
        ship_to_name,
        ship_to_address_street,
        ship_to_address_city,
        ship_to_address_state,
        ship_to_address_postal_code,
        ship_to_address_country,
        carrier,
        tracking_number,
        service_type,
        total_weight,
        weight_unit,
        total_packages,
        notes,
        action_required,
        delivery_instructions,
        is_delayed,
        sales_order_id,
        sales_orders(
          id,
          order_number,
          customer_po_number,
          customers(
            id,
            name
          )
        ),
        shipment_items(
          id,
          sku,
          description,
          quantity_shipped
        )
      `)
      .eq('id', itemId)
      .single();

    if (shipmentError) {
      console.error('[getShipmentDetailById] Full shipment query error:', shipmentError);
      throw new Error(`Failed to load shipment details: ${shipmentError.message}`);
    }

    if (shipmentData) {
      const salesOrder = Array.isArray(shipmentData.sales_orders)
        ? shipmentData.sales_orders[0]
        : shipmentData.sales_orders;
      const customer = salesOrder?.customers
        ? (Array.isArray(salesOrder.customers) ? salesOrder.customers[0] : salesOrder.customers)
        : null;

      return {
        id: shipmentData.id,
        shipmentNumber: shipmentData.shipment_number,
        shipmentDate: shipmentData.shipment_date,
        status: shipmentData.status,
        containerNumber: shipmentData.container_number,
        billOfLading: shipmentData.bill_of_lading,
        vesselName: shipmentData.vessel_name,
        portOfLoading: shipmentData.port_of_loading,
        portOfDischarge: shipmentData.port_of_discharge,
finalDestination: shipmentData.final_destination,
        etd: shipmentData.etd,
        etaPort: shipmentData.eta_port,
        etaCustomer: shipmentData.eta_customer,
        estimatedArrival: shipmentData.estimated_arrival,
        actualArrival: shipmentData.actual_arrival,
        lastFreeDay: shipmentData.lfd_date,
        customerName: customer?.name || null,
        customerPo: salesOrder?.customer_po_number || null,
        salesOrderNumber: salesOrder?.order_number || null,
        shipToName: shipmentData.ship_to_name,
        shipToAddressStreet: shipmentData.ship_to_address_street,
        shipToAddressCity: shipmentData.ship_to_address_city,
        shipToAddressState: shipmentData.ship_to_address_state,
        shipToAddressPostalCode: shipmentData.ship_to_address_postal_code,
        shipToAddressCountry: shipmentData.ship_to_address_country,
        carrier: shipmentData.carrier,
        trackingNumber: shipmentData.tracking_number,
        serviceType: shipmentData.service_type,
        items: (shipmentData.shipment_items || []).map((item: { id: string; sku: string; description: string | null; quantity_shipped: number }) => ({
          id: item.id,
          sku: item.sku,
          description: item.description,
          quantityShipped: item.quantity_shipped,
        })),
        totalWeight: shipmentData.total_weight,
        weightUnit: shipmentData.weight_unit || 'lbs',
        totalPackages: shipmentData.total_packages || 1,
        notes: shipmentData.notes,
        actionRequired: shipmentData.action_required,
        deliveryInstructions: shipmentData.delivery_instructions,
        isDelayed: shipmentData.is_delayed || false,
      };
    }
  }

  // If not found in shipments, try sales_orders table (for items without shipments)
  console.log('[getShipmentDetailById] Not found in shipments, trying sales_orders...');
  const { data: salesOrderData, error: salesOrderError } = await db
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_date,
      status,
      customer_po_number,
      requested_delivery_date,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      shipping_address_country,
      internal_notes,
      customers(
        id,
        name
      ),
      sales_order_items(
        id,
        sku,
        description,
        quantity
      )
    `)
    .eq('id', itemId)
    .maybeSingle();

  console.log('[getShipmentDetailById] Sales order query result:', {
    found: !!salesOrderData,
    error: salesOrderError?.message,
  });

  if (salesOrderError) {
    console.error('Sales order query error:', salesOrderError);
    throw new Error(`Record not found: ${salesOrderError.message}`);
  }

  if (!salesOrderData) {
    // Try purchase_orders table (for GDC inventory items)
    console.log('[getShipmentDetailById] Not found in sales_orders, trying purchase_orders...');
    const { data: purchaseOrderData, error: purchaseOrderError } = await db
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        po_date,
        status,
        expected_delivery_date,
        order_series,
        internal_notes,
        sales_order_id,
        sales_orders(
          id,
          order_number,
          customer_po_number,
          eta_to_us_port,
          confirmed_eta,
          requested_delivery_date,
          actual_delivery_date,
          shipping_address_street,
          shipping_address_city,
          shipping_address_state,
          shipping_address_postal_code,
          shipping_address_country,
          customers(id, name)
        ),
        purchase_order_items(
          id,
          sku,
          description,
          quantity_ordered
        )
      `)
      .eq('id', itemId)
      .maybeSingle();

    console.log('[getShipmentDetailById] Purchase order query result:', {
      found: !!purchaseOrderData,
      error: purchaseOrderError?.message,
    });

    if (purchaseOrderError) {
      console.error('Purchase order query error:', purchaseOrderError);
      throw new Error(`Record not found: ${purchaseOrderError.message}`);
    }

    if (!purchaseOrderData) {
      // Log the ID that wasn't found for debugging
      console.error('Record not found for ID:', itemId);
      throw new Error('Record not found - ID does not exist in shipments, sales_orders, or purchase_orders tables');
    }

    // Extract sales order and customer data
    const linkedSO = Array.isArray(purchaseOrderData.sales_orders)
      ? purchaseOrderData.sales_orders[0]
      : purchaseOrderData.sales_orders;
    const customer = linkedSO?.customers
      ? (Array.isArray(linkedSO.customers) ? linkedSO.customers[0] : linkedSO.customers)
      : null;

    // Map purchase order data to ShipmentDetailData format
    return {
      id: purchaseOrderData.id,
      shipmentNumber: purchaseOrderData.po_number,
      shipmentDate: purchaseOrderData.po_date,
      status: purchaseOrderData.status,
      containerNumber: null,
      billOfLading: null,
      vesselName: null,
      portOfLoading: null,
      portOfDischarge: null,
      finalDestination: null,
      etd: null,
      etaPort: linkedSO?.eta_to_us_port || null,
      etaCustomer: linkedSO?.requested_delivery_date || null,
      estimatedArrival: null,
      actualArrival: linkedSO?.actual_delivery_date || null,
      lastFreeDay: null,
      customerName: customer?.name || 'Gesher',
      customerPo: linkedSO?.customer_po_number || null,
      salesOrderNumber: linkedSO?.order_number || null,
      shipToName: null,
      shipToAddressStreet: linkedSO?.shipping_address_street || null,
      shipToAddressCity: linkedSO?.shipping_address_city || null,
      shipToAddressState: linkedSO?.shipping_address_state || null,
      shipToAddressPostalCode: linkedSO?.shipping_address_postal_code || null,
      shipToAddressCountry: linkedSO?.shipping_address_country || null,
      carrier: null,
      trackingNumber: null,
      serviceType: null,
      items: (purchaseOrderData.purchase_order_items || []).map((item: { id: string; sku: string; description: string | null; quantity_ordered: number }) => ({
        id: item.id,
        sku: item.sku,
        description: item.description,
        quantityShipped: item.quantity_ordered,
      })),
      totalWeight: null,
      weightUnit: 'lbs',
      totalPackages: 1,
      notes: purchaseOrderData.internal_notes,
      actionRequired: null,
      deliveryInstructions: null,
      isDelayed: false,
    };
  }

  // Extract customer data
  const customer = Array.isArray(salesOrderData.customers)
    ? salesOrderData.customers[0]
    : salesOrderData.customers;

  // Map sales order data to ShipmentDetailData format
  return {
    id: salesOrderData.id,
    shipmentNumber: salesOrderData.order_number,
    shipmentDate: salesOrderData.order_date,
    status: salesOrderData.status,
    containerNumber: null,
    billOfLading: null,
    vesselName: null,
    portOfLoading: null,
    portOfDischarge: null,
finalDestination: null,
    etd: null,
    etaPort: null,
    etaCustomer: salesOrderData.requested_delivery_date,
    estimatedArrival: salesOrderData.requested_delivery_date,
    actualArrival: null,
    lastFreeDay: null,
    customerName: customer?.name || null,
    customerPo: salesOrderData.customer_po_number,
    salesOrderNumber: salesOrderData.order_number,
    shipToName: customer?.name || null,
    shipToAddressStreet: salesOrderData.shipping_address_street,
    shipToAddressCity: salesOrderData.shipping_address_city,
    shipToAddressState: salesOrderData.shipping_address_state,
    shipToAddressPostalCode: salesOrderData.shipping_address_postal_code,
    shipToAddressCountry: salesOrderData.shipping_address_country,
    carrier: null,
    trackingNumber: null,
    serviceType: null,
    items: (salesOrderData.sales_order_items || []).map((item: { id: string; sku: string; description: string | null; quantity: number }) => ({
      id: item.id,
      sku: item.sku,
      description: item.description,
      quantityShipped: item.quantity,
    })),
    totalWeight: null,
    weightUnit: 'lbs',
    totalPackages: 1,
    notes: salesOrderData.internal_notes,
    actionRequired: null,
    deliveryInstructions: null,
    isDelayed: false,
  };
}
