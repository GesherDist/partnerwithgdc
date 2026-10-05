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
    // Track successfully imported sales order numbers
    const importedSOs = new Set<string>();
    const failedSOs = new Set<string>();

    // 1. Import Quotes
    for (const quote of data.quotes) {
      try {
        const result = await importQuote(quote, userId);
        if (result.created) stats.quotesCreated++;
        else stats.quotesUpdated++;
      } catch (error: any) {
        errors.push(`Quote ${quote.quoteNumber}: ${error.message}`);
      }
    }

    // 2. Import Sales Orders (with Option B: Complete Replace)
    for (const so of data.salesOrders) {
      try {
        const result = await importSalesOrder(so, userId);
        if (result.created) stats.salesOrdersCreated++;
        else stats.salesOrdersUpdated++;
        importedSOs.add(so.orderNumber);
      } catch (error: any) {
        errors.push(`SO ${so.orderNumber}: ${error.message}`);
        failedSOs.add(so.orderNumber);
      }
    }

    // 3. Import Purchase Orders
    for (const po of data.purchaseOrders) {
      try {
        await importPurchaseOrder(po, userId);
        stats.purchaseOrdersCreated++;
      } catch (error: any) {
        errors.push(`PO ${po.poNumber}: ${error.message}`);
      }
    }

    // 4. Import Pick Tickets (skip if SO not imported)
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

    // 5. Import Shipments (skip if SO not imported)
    for (const shipment of data.shipments) {
      try {
        // Check if SO was successfully imported
        if (!importedSOs.has(shipment.salesOrderNumber)) {
          errors.push(
            `Shipment for ${shipment.salesOrderNumber}: SKIPPED - Sales order not imported (see SO errors above)`
          );
          continue;
        }

        await importShipment(shipment, userId);
        stats.shipmentsCreated++;
      } catch (error: any) {
        errors.push(`Shipment for ${shipment.salesOrderNumber}: ${error.message}`);
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
): Promise<{ created: boolean }> {
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
    const items = so.items.map((item) => ({
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

    const { error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(items);

    if (itemsError) throw itemsError;

    return { created: false };
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
    const items = so.items.map((item) => ({
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

    const { error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(items);

    if (itemsError) throw itemsError;

    return { created: true };
  }
}

// ============================================================================
// IMPORT PURCHASE ORDER
// ============================================================================

async function importPurchaseOrder(po: PurchaseOrderPreview, userId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get sales order ID (if exists)
  // For warehouse inventory POs, there is no sales order
  let salesOrderId: string | null = null;

  // Try to find SO by order number
  // Warehouse inventory POs won't have matching SOs (notes contain "Warehouse inventory")
  const isWarehouseInventory = po.notes.includes('Warehouse inventory');

  if (!isWarehouseInventory && po.salesOrderNumber) {
    const { data: salesOrder } = await supabase
      .from('sales_orders')
      .select('id')
      .eq('order_number', po.salesOrderNumber)
      .maybeSingle(); // Use maybeSingle - no error if not found

    if (salesOrder) {
      salesOrderId = salesOrder.id;
    }
  }

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

    // Update existing PO (no supplier_id at PO level - it's on items now)
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        sales_order_id: salesOrderId, // Can be null for warehouse inventory
        po_date: po.orderDate,
        expected_delivery_date: expectedDelivery,
        status: po.status,
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
  } else {
    // Ensure expected_delivery_date >= po_date (constraint validation)
    let expectedDelivery = po.expectedDeliveryDate;
    if (expectedDelivery && po.orderDate && expectedDelivery < po.orderDate) {
      expectedDelivery = po.orderDate; // Set to same date if invalid
    }

    // Create new PO (no supplier_id at PO level)
    const { data: newPO, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: po.poNumber,
        sales_order_id: salesOrderId, // Can be null for warehouse inventory
        po_date: po.orderDate,
        expected_delivery_date: expectedDelivery,
        status: po.status,
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
// IMPORT SHIPMENT (with container numbers)
// ============================================================================

async function importShipment(shipment: ShipmentPreview, userId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get sales order ID
  const { data: salesOrder } = await supabase
    .from('sales_orders')
    .select('id')
    .eq('order_number', shipment.salesOrderNumber)
    .single();

  if (!salesOrder) {
    throw new Error(
      `Sales order ${shipment.salesOrderNumber} not found. This SO may have failed to import or was not included in the import data. Please check the Sales Orders import errors above.`
    );
  }

  // Check if shipment exists (by tracking_number or supplier_reference_number)
  const { data: existing } = await supabase
    .from('shipments')
    .select('id, shipment_number')
    .or(`tracking_number.eq.${shipment.trackingNumber || shipment.salesOrderNumber},supplier_reference_number.eq.${shipment.salesOrderNumber}`)
    .single();

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
        sales_order_id: salesOrder.id,
        carrier: 'Ocean Freight',
        tracking_number: shipment.trackingNumber,
        supplier_reference_number: shipment.salesOrderNumber,
        ship_to_address_street: shipment.deliveryAddress,
        shipment_date: shipmentDate,
        estimated_arrival: estimatedArrival,
        actual_arrival: actualArrival,
        status: shipment.status,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
  } else {
    // Generate shipment number
    const { data: shipmentNumber, error: numError } = await supabase
      .rpc('generate_shipment_number');

    if (numError || !shipmentNumber) {
      throw new Error(`Failed to generate shipment number: ${numError?.message}`);
    }

    // Create new shipment
    const { error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        sales_order_id: salesOrder.id,
        carrier: 'Ocean Freight',
        tracking_number: shipment.trackingNumber || null,
        supplier_reference_number: shipment.salesOrderNumber,
        ship_to_address_street: shipment.deliveryAddress,
        shipment_date: shipmentDate,
        estimated_arrival: estimatedArrival,
        actual_arrival: actualArrival,
        status: shipment.status,
        created_by: userId,
      });

    if (shipmentError) throw shipmentError;
  }
}
