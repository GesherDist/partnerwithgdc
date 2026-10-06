/**
 * HISTORICAL IMPORT - SERVER ACTIONS
 * ===================================
 * Import quotes, sales orders, POs, pick tickets, shipments
 *
 * Strategy: Option B - Complete Replace
 * - If SO exists: DELETE items, UPDATE header, CREATE new items
 * - If SO doesn't exist: CREATE everything new
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  QuotePreview,
  SalesOrderPreview,
  PurchaseOrderPreview,
  PickTicketPreview,
  ShipmentPreview,
  ImportResult,
} from '../types';

// ============================================================================
// IMPORT ALL DATA (Main Entry Point)
// ============================================================================

export async function importHistoricalData(data: {
  quotes: QuotePreview[];
  salesOrders: SalesOrderPreview[];
  purchaseOrders: PurchaseOrderPreview[];
  pickTickets: PickTicketPreview[];
  shipments: ShipmentPreview[];
}): Promise<ImportResult> {
  // Use regular client for auth check (verify who is importing)
  const authClient = await createClient();
  const errors: string[] = [];
  const stats = {
    quotesCreated: 0,
    quotesUpdated: 0,
    salesOrdersCreated: 0,
    salesOrdersUpdated: 0,
    purchaseOrdersCreated: 0,
    pickTicketsCreated: 0,
    shipmentsCreated: 0,
    allocationsCreated: 0,
  };

  // Get current user for audit purposes
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return {
      success: false,
      errors: ['User not authenticated'],
      stats,
    };
  }

  // Get user record for created_by field
  const { data: userRecord } = await authClient
    .from('users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!userRecord) {
    return {
      success: false,
      errors: ['User record not found'],
      stats,
    };
  }

  const userId = userRecord.id;

  try {
    // Track imported records for Pre-PO/SO workflow
    const importedPOs = new Map<string, string>(); // Map<poNumber, poId>
    const importedSOs = new Map<string, { id: string; customerId: string; items: any[] }>(); // Map<soNumber, data>
    const failedSOs = new Set<string>();

    // ============================================================================
    // NEW WORKFLOW: Pre-PO/SO Flow
    // Step 1: Purchase Orders FIRST (unallocated inventory)
    // Step 2: Shipments (container tracking)
    // Step 3: Quotes (customer requests)
    // Step 4: Sales Orders (customer orders)
    // Step 5: Allocations (link PO → SO)
    // ============================================================================

    // 1. Import Purchase Orders FIRST (unallocated, customer: null)
    for (const po of data.purchaseOrders) {
      try {
        const result = await importPurchaseOrder(po, userId);
        stats.purchaseOrdersCreated++;
        if (result.poId) {
          importedPOs.set(po.poNumber, result.poId);
        }
      } catch (error: any) {
        errors.push(`PO ${po.poNumber}: ${error.message}`);
      }
    }

    // 2. Import Shipments (container arrives)
    for (const shipment of data.shipments) {
      try {
        await importShipment(shipment, userId);
        stats.shipmentsCreated++;
      } catch (error: any) {
        errors.push(`Shipment for ${shipment.salesOrderNumber}: ${error.message}`);
      }
    }

    // Helper function to check if customer is unallocated inventory (GDC/Gesher/Warehouse)
    const isUnallocatedInventory = (customerName: string): boolean => {
      const name = customerName.toUpperCase().trim();
      return (
        name === 'GDC' ||
        name === 'GESHER' ||
        name.includes('WAREHOUSE') ||
        name.includes('GDC INVENTORY') ||
        name === 'UNALLOCATED'
      );
    };

    // 3. Import Quotes (customer requests) - ONLY for real customers (not GDC/Gesher/Warehouse)
    const realCustomerQuotes = data.quotes.filter(q => !isUnallocatedInventory(q.customerName));

    console.log(`\n📋 Importing ${realCustomerQuotes.length} quotes (skipping ${data.quotes.length - realCustomerQuotes.length} GDC/warehouse/unallocated)...`);

    for (const quote of realCustomerQuotes) {
      try {
        const result = await importQuote(quote, userId);
        if (result.created) stats.quotesCreated++;
        else stats.quotesUpdated++;
      } catch (error: any) {
        errors.push(`Quote ${quote.quoteNumber}: ${error.message}`);
      }
    }

    // 4. Import Sales Orders (customer orders) - ONLY for real customers (not GDC/Gesher/Warehouse)
    const realCustomerSOs = data.salesOrders.filter(so => !isUnallocatedInventory(so.customerName));

    console.log(`\n📦 Importing ${realCustomerSOs.length} sales orders (skipping ${data.salesOrders.length - realCustomerSOs.length} GDC/warehouse/unallocated)...`);

    for (const so of realCustomerSOs) {
      try {
        const result = await importSalesOrder(so, userId);
        if (result.created) stats.salesOrdersCreated++;
        else stats.salesOrdersUpdated++;

        // Save SO data for allocation step
        if (result.soId && result.items) {
          importedSOs.set(so.orderNumber, {
            id: result.soId,
            customerId: so.customerId,
            items: result.items
          });
        }
      } catch (error: any) {
        errors.push(`SO ${so.orderNumber}: ${error.message}`);
        failedSOs.add(so.orderNumber);
      }
    }

    // 5. Create Allocations (Link PO → SO) - NEW STEP
    console.log(`\n📦 Creating allocations to link ${importedPOs.size} POs with ${importedSOs.size} SOs...`);
    for (const [soNumber, soData] of importedSOs.entries()) {
      try {
        const poNumber = soNumber.replace('SO', 'PO');
        const poId = importedPOs.get(poNumber);

        if (poId) {
          const allocCount = await createAllocationsForHistoricalImport(
            soData.id,
            soData.customerId,
            soData.items,
            poId,
            userId
          );
          stats.allocationsCreated += allocCount;
        }
      } catch (error: any) {
        errors.push(`Allocation for ${soNumber}: ${error.message}`);
      }
    }

    // 6. Import Pick Tickets (skip if SO not imported)
    for (const pt of data.pickTickets) {
      try {
        // Check if SO was successfully imported
        if (!importedSOs.has(pt.salesOrderNumber)) {
          errors.push(
            `Pick Ticket for ${pt.salesOrderNumber}: SKIPPED - Sales order not imported (see SO errors above)`
          );
          continue;
        }

        await importPickTicket(pt, userId);
        stats.pickTicketsCreated++;
      } catch (error: any) {
        errors.push(`Pick Ticket for ${pt.salesOrderNumber}: ${error.message}`);
      }
    }

    // Add diagnostic summary if there were failed SOs
    if (failedSOs.size > 0) {
      errors.push(
        `\n⚠️ IMPORT SUMMARY: ${failedSOs.size} sales order(s) failed to import: ${Array.from(failedSOs).join(', ')}. ` +
        `This caused ${data.pickTickets.filter(pt => failedSOs.has(pt.salesOrderNumber)).length} pick ticket(s) and ` +
        `${data.shipments.filter(s => failedSOs.has(s.salesOrderNumber)).length} shipment(s) to be skipped.`
      );
    }

    return {
      success: errors.length === 0,
      errors,
      stats,
    };
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message],
      stats,
    };
  }
}

// ============================================================================
// IMPORT QUOTE
// ============================================================================

async function importQuote(
  quote: QuotePreview,
  userId: string
): Promise<{ created: boolean }> {
  const supabase = createAdminClient();

  // Check if quote exists
  const { data: existing } = await supabase
    .from('quotes')
    .select('id')
    .eq('quote_number', quote.quoteNumber)
    .single();

  if (existing) {
    // Update existing quote
    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        customer_id: quote.customerId,
        quote_date: quote.quoteDate,
        valid_until: quote.validUntil,
        status: quote.status,
        subtotal: quote.subtotal,
        tax_total: quote.taxTotal,
        grand_total: quote.grandTotal,
        terms_and_conditions: quote.terms,
        customer_notes: quote.notes,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    // Delete old items
    await supabase.from('quote_items').delete().eq('quote_id', existing.id);

    // Create new items (with SKU field)
    const items = quote.items.map((item) => ({
      quote_id: existing.id,
      product_id: item.productId,
      sku: item.productSku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    }));

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(items);

    if (itemsError) throw itemsError;

    return { created: false };
  } else {
    // Create new quote
    const { data: newQuote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: quote.quoteNumber,
        customer_id: quote.customerId,
        quote_date: quote.quoteDate,
        valid_until: quote.validUntil,
        status: quote.status,
        subtotal: quote.subtotal,
        tax_total: quote.taxTotal,
        grand_total: quote.grandTotal,
        terms_and_conditions: quote.terms,
        customer_notes: quote.notes,
        created_by: userId,
      })
      .select('id')
      .single();

    if (quoteError) throw quoteError;

    // Create items (with SKU field)
    const items = quote.items.map((item) => ({
      quote_id: newQuote.id,
      product_id: item.productId,
      sku: item.productSku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    }));

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(items);

    if (itemsError) throw itemsError;

    return { created: true };
  }
}

// ============================================================================
// IMPORT SALES ORDER (Option B: Complete Replace)
// ============================================================================

async function importSalesOrder(
  so: SalesOrderPreview,
  userId: string
): Promise<{ created: boolean; soId?: string; items?: any[] }> {
  const supabase = createAdminClient();

  // Check if SO exists by order_number
  const { data: existing } = await supabase
    .from('sales_orders')
    .select('id, order_number')
    .eq('order_number', so.orderNumber)
    .maybeSingle();

  if (existing) {
    // Option B: Complete Replace - UPDATE existing SO
    console.log(`   ℹ️  Sales Order ${so.orderNumber} already exists, updating...`);

    // 1. Delete all items
    await supabase.from('sales_order_items').delete().eq('sales_order_id', existing.id);

    // 2. Validate requested delivery date (constraint: requested_delivery_date >= order_date)
    let requestedDelivery = so.expectedDeliveryDate;
    if (requestedDelivery && so.orderDate && requestedDelivery < so.orderDate) {
      requestedDelivery = so.orderDate; // Set to same date if invalid
    }

    // 3. Update header
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({
        customer_id: so.customerId,
        order_date: so.orderDate,
        requested_delivery_date: requestedDelivery,
        customer_po_number: so.customerPO,
        order_series: so.orderSeries,
        status: so.status,
        subtotal: so.subtotal,
        tax_total: so.taxTotal,
        grand_total: so.grandTotal,
        shipping_method: so.shippingMethod,
        shipping_address_street: so.shippingAddress,
        customer_notes: so.notes,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    // 3. Create new items (with SKU field and customer_qty)
    const itemsToInsert = so.items.map((item) => ({
      sales_order_id: existing.id,
      product_id: item.productId,
      sku: item.productSku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      tax_rate: item.taxRate,
      customer_qty: item.customerQty,
      created_by: userId,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(itemsToInsert)
      .select('id, product_id, quantity, customer_qty');

    if (itemsError) throw itemsError;

    return { created: false, soId: existing.id, items: insertedItems };
  } else {
    // Validate requested delivery date (constraint: requested_delivery_date >= order_date)
    let requestedDelivery = so.expectedDeliveryDate;
    if (requestedDelivery && so.orderDate && requestedDelivery < so.orderDate) {
      requestedDelivery = so.orderDate; // Set to same date if invalid
    }

    // Create new sales order
    const { data: newSO, error: soError } = await supabase
      .from('sales_orders')
      .insert({
        order_number: so.orderNumber,
        customer_id: so.customerId,
        order_date: so.orderDate,
        requested_delivery_date: requestedDelivery,
        customer_po_number: so.customerPO,
        order_series: so.orderSeries,
        status: so.status,
        subtotal: so.subtotal,
        tax_total: so.taxTotal,
        grand_total: so.grandTotal,
        shipping_method: so.shippingMethod,
        shipping_address_street: so.shippingAddress,
        customer_notes: so.notes,
        created_by: userId,
      })
      .select('id')
      .single();

    if (soError) throw soError;

    // Create items (with SKU field, customer_qty, and created_by)
    const itemsToInsert = so.items.map((item) => ({
      sales_order_id: newSO.id,
      product_id: item.productId,
      sku: item.productSku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      tax_rate: item.taxRate,
      customer_qty: item.customerQty,
      created_by: userId,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(itemsToInsert)
      .select('id, product_id, quantity, customer_qty');

    if (itemsError) throw itemsError;

    return { created: true, soId: newSO.id, items: insertedItems };
  }
}

// ============================================================================
// IMPORT PURCHASE ORDER (Pre-PO/SO Workflow)
// ============================================================================
// Creates unallocated POs (customer: null, sales_order_id: null)
// Will be linked to SOs later via allocations

async function importPurchaseOrder(
  po: PurchaseOrderPreview,
  userId: string
): Promise<{ poId: string }> {
  const supabase = createAdminClient();

  // PRE-PO/SO WORKFLOW: Do NOT link to SO during import
  // POs are created first (unallocated)
  // Linking happens later via fulfillment_allocations

  // Get GDC Inventory warehouse location for unallocated inventory
  const { data: gdcLocation } = await supabase
    .from('locations')
    .select('id')
    .eq('location_code', 'GDC-INV')
    .single();

  const warehouseId = gdcLocation?.id || null;

  // Check if PO exists
  const { data: existing } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('po_number', po.poNumber)
    .single();

  if (existing) {
    // Ensure expected_delivery_date >= po_date (constraint validation)
    let expectedDelivery = po.expectedDeliveryDate;
    if (expectedDelivery && po.orderDate && expectedDelivery < po.orderDate) {
      expectedDelivery = po.orderDate; // Set to same date if invalid
    }

    // Update existing PO (unallocated - no SO link)
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        sales_order_id: null, // Pre-PO/SO: Always null initially
        warehouse_id: warehouseId, // GDC Inventory location
        order_series: po.orderSeries || null, // GDC 1, GDC 2, etc. from Excel
        po_date: po.orderDate,
        expected_delivery_date: expectedDelivery,
        status: po.status, // Extract from Excel (AVAILABLE, SOLD, etc.)
        subtotal: po.subtotal,
        tax_total: po.taxTotal,
        grand_total: po.grandTotal,
        internal_notes: po.notes,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    // Delete and recreate items
    await supabase.from('purchase_order_items').delete().eq('purchase_order_id', existing.id);

    // Items with supplier_id at item level (migration 068)
    const items = po.items.map((item) => ({
      purchase_order_id: existing.id,
      product_id: item.productId,
      sku: item.productSku,
      quantity_ordered: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      supplier_id: item.vendorId, // Item-level supplier (migration 068)
      supplier_name: item.vendorName, // Denormalized name
      created_by: userId,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(items);

    if (itemsError) throw itemsError;

    return { poId: existing.id }; // Return PO ID for allocation step
  } else {
    // Ensure expected_delivery_date >= po_date (constraint validation)
    let expectedDelivery = po.expectedDeliveryDate;
    if (expectedDelivery && po.orderDate && expectedDelivery < po.orderDate) {
      expectedDelivery = po.orderDate; // Set to same date if invalid
    }

    // Create new PO (unallocated - no SO link)
    const { data: newPO, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: po.poNumber,
        sales_order_id: null, // Pre-PO/SO: Always null initially
        warehouse_id: warehouseId, // GDC Inventory location
        order_series: po.orderSeries || null, // GDC 1, GDC 2, etc. from Excel
        po_date: po.orderDate,
        expected_delivery_date: expectedDelivery,
        status: po.status, // Extract from Excel (AVAILABLE, SOLD, etc.)
        subtotal: po.subtotal,
        tax_total: po.taxTotal,
        grand_total: po.grandTotal,
        internal_notes: po.notes,
        created_by: userId,
      })
      .select('id')
      .single();

    if (poError) throw poError;

    // Items with supplier_id at item level (migration 068)
    const items = po.items.map((item) => ({
      purchase_order_id: newPO.id,
      product_id: item.productId,
      sku: item.productSku,
      quantity_ordered: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      supplier_id: item.vendorId, // Item-level supplier (migration 068)
      supplier_name: item.vendorName, // Denormalized name
      created_by: userId,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(items);

    if (itemsError) throw itemsError;

    return { poId: newPO.id }; // Return PO ID for allocation step
  }
}

// ============================================================================
// IMPORT PICK TICKET
// ============================================================================

async function importPickTicket(pt: PickTicketPreview, userId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get sales order ID
  const { data: salesOrder } = await supabase
    .from('sales_orders')
    .select('id')
    .eq('order_number', pt.salesOrderNumber)
    .single();

  if (!salesOrder) {
    throw new Error(
      `Sales order ${pt.salesOrderNumber} not found. This SO may have failed to import or was not included in the import data. Please check the Sales Orders import errors above.`
    );
  }

  // Check if pick ticket exists
  const { data: existing } = await supabase
    .from('pick_tickets')
    .select('id')
    .eq('ticket_number', pt.ticketNumber)
    .single();

  if (existing) {
    // Update existing pick ticket
    const { error: updateError } = await supabase
      .from('pick_tickets')
      .update({
        sales_order_id: salesOrder.id,
        location_id: pt.locationId,
        status: pt.status,
        notes: pt.notes,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    // Delete and recreate items
    await supabase.from('pick_ticket_items').delete().eq('pick_ticket_id', existing.id);

    const items = pt.items.map((item) => ({
      pick_ticket_id: existing.id,
      product_id: item.productId,
      quantity_to_pick: item.quantityToPick,
      quantity_picked: item.quantityPicked,
    }));

    const { error: itemsError } = await supabase
      .from('pick_ticket_items')
      .insert(items);

    if (itemsError) throw itemsError;
  } else {
    // Create new pick ticket
    const { data: newPT, error: ptError } = await supabase
      .from('pick_tickets')
      .insert({
        ticket_number: pt.ticketNumber,
        sales_order_id: salesOrder.id,
        location_id: pt.locationId,
        status: pt.status,
        notes: pt.notes,
        created_by: userId,
      })
      .select('id')
      .single();

    if (ptError) throw ptError;

    const items = pt.items.map((item) => ({
      pick_ticket_id: newPT.id,
      product_id: item.productId,
      quantity_to_pick: item.quantityToPick,
      quantity_picked: item.quantityPicked,
    }));

    const { error: itemsError } = await supabase
      .from('pick_ticket_items')
      .insert(items);

    if (itemsError) throw itemsError;
  }
}

// ============================================================================
// CREATE ALLOCATIONS FOR HISTORICAL IMPORT (Pre-PO/SO Workflow)
// ============================================================================
// Links Purchase Orders to Sales Orders via fulfillment_allocations
// Updates PO with customer_id and sales_order_id

async function createAllocationsForHistoricalImport(
  salesOrderId: string,
  customerId: string,
  soItems: any[],
  purchaseOrderId: string,
  userId: string
): Promise<number> {
  const supabase = createAdminClient();
  let allocationsCreated = 0;

  // Get PO details (items with quantities)
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, items:purchase_order_items(id, product_id, quantity_ordered)')
    .eq('id', purchaseOrderId)
    .single();

  if (poError || !po) {
    console.error(`⚠️  PO ${purchaseOrderId} not found for allocation`);
    return 0;
  }

  // Get location (first location or default)
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('location_type', 'warehouse')
    .limit(1)
    .single();

  const locationId = location?.id;

  // Create allocations for each SO item
  for (const soItem of soItems) {
    // Find matching PO item
    const poItem = po.items.find((item: any) => item.product_id === soItem.product_id);

    if (!poItem) {
      console.warn(`⚠️  No matching PO item for product ${soItem.product_id}`);
      continue;
    }

    // Create allocation
    const { error: allocError } = await supabase
      .from('fulfillment_allocations')
      .insert({
        sales_order_item_id: soItem.id,
        purchase_order_id: purchaseOrderId,
        fulfillment_source: 'gdc_inventory',
        quantity: soItem.customer_qty || soItem.quantity,
        container_qty: poItem.quantity_ordered,
        container_remaining: poItem.quantity_ordered - (soItem.customer_qty || soItem.quantity),
        status: 'allocated',
        location_id: locationId,
        created_by: userId,
      });

    if (allocError) {
      console.error(`⚠️  Failed to create allocation: ${allocError.message}`);
      continue;
    }

    allocationsCreated++;
  }

  // Update PO with customer and SO link
  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({
      customer_id: customerId,
      sales_order_id: salesOrderId,
      status: 'partially_allocated', // TODO: Calculate if fully allocated
    })
    .eq('id', purchaseOrderId);

  if (updateError) {
    console.error(`⚠️  Failed to update PO: ${updateError.message}`);
  }

  // Update Shipment with customer and SO link (assign customer to shipment)
  // Get SO number to find matching shipment
  const { data: salesOrder } = await supabase
    .from('sales_orders')
    .select('order_number')
    .eq('id', salesOrderId)
    .single();

  if (salesOrder) {
    // Shipment number matches SO number (e.g., SO2600043)
    const shipmentNumber = salesOrder.order_number;

    const { error: shipmentUpdateError } = await supabase
      .from('shipments')
      .update({
        sales_order_id: salesOrderId,
      })
      .eq('shipment_number', shipmentNumber);

    if (shipmentUpdateError) {
      console.error(`⚠️  Failed to update shipment ${shipmentNumber}: ${shipmentUpdateError.message}`);
    } else {
      console.log(`✅ Shipment ${shipmentNumber} assigned to customer`);
    }
  }

  return allocationsCreated;
}

// ============================================================================
// IMPORT SHIPMENT (with container numbers)
// ============================================================================

async function importShipment(shipment: ShipmentPreview, userId: string): Promise<void> {
  const supabase = createAdminClient();

  // Pre-PO/SO: Sales order is OPTIONAL (may not exist for unallocated inventory)
  const { data: salesOrder } = await supabase
    .from('sales_orders')
    .select('id, customer_id')
    .eq('order_number', shipment.salesOrderNumber)
    .maybeSingle(); // Changed from .single() to .maybeSingle()

  // SO is optional - unallocated inventory won't have SO yet
  // That's OK in Pre-PO/SO workflow

  // Pre-PO/SO: Look up Purchase Order by PO number
  const { data: purchaseOrder } = await supabase
    .from('purchase_orders')
    .select('id, warehouse_id')
    .eq('po_number', shipment.purchaseOrderNumber)
    .maybeSingle();

  if (!purchaseOrder) {
    console.warn(`⚠️  PO ${shipment.purchaseOrderNumber} not found for shipment ${shipment.salesOrderNumber}`);
  }

  // Pre-PO/SO: Get warehouse location from PO (GDC Inventory)
  const warehouseId = purchaseOrder?.warehouse_id || null;

  // Use load_status from shipment preview (Operations Dashboard status from Excel)
  // If not provided, map from shipment workflow status
  let loadStatus: 'available' | 'sold' | 'open' | 'hold' | 'in_transit' | 'invoiced' | 'not_invoiced' | 'closed' | 'po_needed' | 'partially_paid' | 'paid' | 'disputed' = 'available';

  if (shipment.loadStatus) {
    // Use Excel status directly (OPEN, AVAILABLE, IN TRANSIT, etc.)
    loadStatus = shipment.loadStatus as typeof loadStatus;
  } else {
    // Fallback: Map from shipment workflow status
    if (shipment.status === 'in_transit') {
      loadStatus = 'in_transit';
    } else if (shipment.status === 'delivered') {
      loadStatus = 'invoiced';
    }
  }

  // Pre-PO/SO: Check if shipment exists (by PO number first, then SO number)
  // Lookup priority: purchase_order_id > tracking_number > supplier_reference_number
  const lookupConditions: string[] = [];

  if (purchaseOrder?.id) {
    lookupConditions.push(`purchase_order_id.eq.${purchaseOrder.id}`);
  }
  if (shipment.trackingNumber) {
    lookupConditions.push(`tracking_number.eq.${shipment.trackingNumber}`);
  }
  if (shipment.salesOrderNumber) {
    lookupConditions.push(`supplier_reference_number.eq.${shipment.salesOrderNumber}`);
  }

  const { data: existing } = await supabase
    .from('shipments')
    .select('id, shipment_number')
    .or(lookupConditions.join(','))
    .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

  // Prepare dates with constraint validation
  const shipmentDate = shipment.shippedDate || new Date().toISOString().split('T')[0];

  // Ensure estimated_arrival >= shipment_date (constraint validation)
  let estimatedArrival = shipment.estimatedDeliveryDate;
  if (estimatedArrival && shipmentDate && estimatedArrival < shipmentDate) {
    estimatedArrival = shipmentDate; // Set to same date if invalid
  }

  // Ensure actual_arrival >= shipment_date (if exists)
  let actualArrival = shipment.actualDeliveryDate;
  if (actualArrival && shipmentDate && actualArrival < shipmentDate) {
    actualArrival = null; // Clear if invalid
  }

  if (existing) {
    // Update existing shipment
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        sales_order_id: salesOrder?.id || null, // Pre-PO/SO: May be null for unallocated
        purchase_order_id: purchaseOrder?.id || null, // Pre-PO/SO: Link to PO
        from_location_id: warehouseId, // Pre-PO/SO: GDC Inventory warehouse
        carrier: 'Ocean Freight',
        tracking_number: shipment.trackingNumber,
        supplier_reference_number: shipment.salesOrderNumber,
        ship_to_address_street: shipment.deliveryAddress,
        shipment_date: shipmentDate,
        estimated_arrival: estimatedArrival,
        actual_arrival: actualArrival,
        status: shipment.status,
        load_status: loadStatus, // Pre-PO/SO: Operations Dashboard status (available, in_transit, etc.)
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
  } else {
    // Use Load Number (SO number) as shipment number
    // PO number is stored separately in purchase_order_id field
    const shipmentNumber = shipment.salesOrderNumber; // Load Number (SO2600057)

    // Create new shipment
    const { error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        sales_order_id: salesOrder?.id || null, // Pre-PO/SO: May be null for unallocated
        purchase_order_id: purchaseOrder?.id || null, // Pre-PO/SO: Link to PO
        from_location_id: warehouseId, // Pre-PO/SO: GDC Inventory warehouse
        carrier: 'Ocean Freight',
        tracking_number: shipment.trackingNumber || null,
        supplier_reference_number: shipment.salesOrderNumber,
        ship_to_address_street: shipment.deliveryAddress,
        shipment_date: shipmentDate,
        estimated_arrival: estimatedArrival,
        actual_arrival: actualArrival,
        status: shipment.status,
        load_status: loadStatus, // Pre-PO/SO: Operations Dashboard status (available, in_transit, etc.)
        created_by: userId,
      });

    if (shipmentError) throw shipmentError;
  }
}
