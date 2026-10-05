/**
 * HISTORICAL IMPORT - FULFILLMENT PREVIEW GENERATOR
 * ==================================================
 * Generate PO, Pick Ticket, and Shipment previews
 */

import {
  RawExcelRow,
  SalesOrderPreview,
  PurchaseOrderPreview,
  PurchaseOrderItemPreview,
  PickTicketPreview,
  PickTicketItemPreview,
  ShipmentPreview,
} from '../types';

// ============================================================================
// GET SUPPLIER (cached)
// ============================================================================

let supplierCache: { id: string; name: string } | null = null;

async function getSupplier() {
  if (supplierCache) return supplierCache;

  try {
    const response = await fetch('/api/historical-import/get-supplier');
    if (!response.ok) throw new Error('Failed to fetch supplier');

    const data = await response.json();
    supplierCache = data.supplier;
    return supplierCache;
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return null;
  }
}

// ============================================================================
// GET DEFAULT LOCATION (cached)
// ============================================================================

let locationCache: { id: string; name: string } | null = null;

async function getDefaultLocation() {
  if (locationCache) return locationCache;

  try {
    const response = await fetch('/api/historical-import/get-default-location');
    if (!response.ok) throw new Error('Failed to fetch location');

    const data = await response.json();
    locationCache = data.location;
    return locationCache;
  } catch (error) {
    console.error('Error fetching location:', error);
    return null;
  }
}

// ============================================================================
// GENERATE PO PREVIEWS
// ============================================================================

export async function generatePOPreviews(
  soPreviews: SalesOrderPreview[],
  internalCustomerRows: RawExcelRow[], // Warehouse inventory rows (no customer)
  rawRowsMap: Map<string, any>
): Promise<PurchaseOrderPreview[]> {
  const supplier = await getSupplier();
  if (!supplier) {
    throw new Error('Supplier not found. Please add Galileo supplier first.');
  }

  const previews: PurchaseOrderPreview[] = [];

  // ============================================================================
  // PART 1: Create POs for Sales Orders (customer orders from manufacturer)
  // ============================================================================
  for (const so of soPreviews) {
    // Only create PO if has manufacturer items
    const manufacturerItems = so.items.filter(
      (item) => item.fulfillmentSource === 'manufacturer'
    );

    if (manufacturerItems.length === 0) continue;

    const rawRow = rawRowsMap.get(so.loadNumber);
    const poNumber = so.orderNumber.replace('SO', 'PO');

    // Build PO items
    const items: PurchaseOrderItemPreview[] = manufacturerItems.map((soItem) => ({
      productId: soItem.productId,
      productName: soItem.productName,
      productSku: soItem.productSku,
      quantity: soItem.quantity,
      unitPrice: soItem.unitPrice,
      lineTotal: soItem.lineTotal,
      vendorId: supplier.id,
      vendorName: supplier.name,
    }));

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    const preview: PurchaseOrderPreview = {
      // Header
      poNumber,
      salesOrderId: null, // Will be populated after SO creation
      salesOrderNumber: so.orderNumber,
      vendorId: supplier.id,
      vendorName: supplier.name,
      status: 'confirmed',
      orderSeries: so.orderSeries,

      // Items
      items,

      // Dates
      orderDate: so.orderDate,
      expectedDeliveryDate: rawRow?.confirmedEta || so.expectedDeliveryDate,

      // Totals
      subtotal,
      taxTotal: 0,
      grandTotal: subtotal,

      // Notes
      notes: `Imported from historical data - ${so.loadNumber}`,

      // Source
      sourceRow: so.sourceRow,
      loadNumber: so.loadNumber,
    };

    previews.push(preview);
  }

  // ============================================================================
  // PART 2: Create POs for Warehouse Inventory (internal customers - no SO)
  // ============================================================================
  for (const row of internalCustomerRows) {
    const poNumber = row.loadNumber.replace('SO', 'PO');

    // Get products
    const products = await getProducts();
    if (!products.product38 || !products.product24) {
      throw new Error('Products not found for warehouse inventory PO');
    }

    // Build PO items from raw row quantities
    const items: PurchaseOrderItemPreview[] = [];

    if (row.qty38 > 0) {
      const lineTotal = row.qty38 * row.price38 * 100; // Convert to cents
      items.push({
        productId: products.product38.id,
        productName: products.product38.name,
        productSku: products.product38.sku,
        quantity: row.qty38,
        unitPrice: row.price38 * 100, // Convert to cents
        lineTotal,
        vendorId: supplier.id,
        vendorName: supplier.name,
      });
    }

    if (row.qty24 > 0) {
      const lineTotal = row.qty24 * row.price24 * 100; // Convert to cents
      items.push({
        productId: products.product24.id,
        productName: products.product24.name,
        productSku: products.product24.sku,
        quantity: row.qty24,
        unitPrice: row.price24 * 100, // Convert to cents
        lineTotal,
        vendorId: supplier.id,
        vendorName: supplier.name,
      });
    }

    if (items.length === 0) continue; // Skip if no items

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    // Generate order date (use ETA or current date)
    const orderDate = (row.etaPort || new Date().toISOString().split('T')[0]) as string;

    const preview: PurchaseOrderPreview = {
      // Header
      poNumber,
      salesOrderId: null, // No SO for warehouse inventory
      salesOrderNumber: row.loadNumber, // Use load number as reference
      vendorId: supplier.id,
      vendorName: supplier.name,
      status: 'confirmed',
      orderSeries: row.orderSeries,

      // Items
      items,

      // Dates
      orderDate,
      expectedDeliveryDate: row.confirmedEta || row.etaPort,

      // Totals
      subtotal,
      taxTotal: 0,
      grandTotal: subtotal,

      // Notes
      notes: `Warehouse inventory - Imported from ${row.sheetName} (${row.customer})`,

      // Source
      sourceRow: row.rowIndex,
      loadNumber: row.loadNumber,
    };

    previews.push(preview);
  }

  return previews;
}

// ============================================================================
// GET PRODUCTS (for warehouse inventory POs)
// ============================================================================

async function getProducts() {
  try {
    const response = await fetch('/api/historical-import/get-products');
    if (!response.ok) throw new Error('Failed to fetch products');
    const data = await response.json();
    return {
      product38: data.product38,
      product24: data.product24,
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { product38: null, product24: null };
  }
}

// ============================================================================
// GENERATE PICK TICKET PREVIEWS
// ============================================================================

export async function generatePickTicketPreviews(
  soPreviews: SalesOrderPreview[]
): Promise<PickTicketPreview[]> {
  const location = await getDefaultLocation();
  if (!location) {
    throw new Error('Default warehouse location not found.');
  }

  const previews: PickTicketPreview[] = [];

  for (const so of soPreviews) {
    // Only create Pick Ticket if has GDC inventory items
    const inventoryItems = so.items.filter(
      (item) => item.fulfillmentSource === 'gdc_inventory'
    );

    if (inventoryItems.length === 0) continue;

    // Build pick ticket items
    const items: PickTicketItemPreview[] = inventoryItems.map((soItem) => ({
      productId: soItem.productId,
      productName: soItem.productName,
      productSku: soItem.productSku,
      quantityToPick: soItem.quantity,
    }));

    const preview: PickTicketPreview = {
      // Header
      salesOrderId: null, // Will be populated after SO creation
      salesOrderNumber: so.orderNumber,
      locationId: location.id,
      locationName: location.name,
      status: 'pending',

      // Items
      items,

      // Notes
      notes: `Imported from historical data - ${so.loadNumber}`,

      // Source
      sourceRow: so.sourceRow,
      loadNumber: so.loadNumber,
    };

    previews.push(preview);
  }

  return previews;
}

// ============================================================================
// GENERATE SHIPMENT PREVIEWS
// ============================================================================

export async function generateShipmentPreviews(
  soPreviews: SalesOrderPreview[],
  poPreviews: PurchaseOrderPreview[],
  rawRowsMap: Map<string, any>
): Promise<ShipmentPreview[]> {
  const supplier = await getSupplier();
  const previews: ShipmentPreview[] = [];

  // Create map of SO number -> PO
  const poMap = new Map<string, PurchaseOrderPreview>();
  poPreviews.forEach((po) => {
    poMap.set(po.salesOrderNumber, po);
  });

  for (const so of soPreviews) {
    const rawRow = rawRowsMap.get(so.loadNumber);
    const po = poMap.get(so.orderNumber);

    // Determine shipment status
    let status = 'pending';
    if (rawRow?.status) {
      const excelStatus = rawRow.status.toUpperCase();
      if (['IN TRANSIT', 'INVOICED', 'SOLD', 'DELIVERED'].includes(excelStatus)) {
        if (excelStatus === 'IN TRANSIT') status = 'in_transit';
        else if (['INVOICED', 'SOLD', 'DELIVERED'].includes(excelStatus)) status = 'delivered';
      }
    }

    // Determine source
    const hasManufacturer = so.items.some((item) => item.fulfillmentSource === 'manufacturer');
    const hasInventory = so.items.some((item) => item.fulfillmentSource === 'gdc_inventory');
    const source = hasManufacturer ? 'supplier' : hasInventory ? 'warehouse' : 'supplier';

    const preview: ShipmentPreview = {
      // Header
      salesOrderId: null, // Will be populated after SO creation
      salesOrderNumber: so.orderNumber,
      purchaseOrderId: po ? null : null, // Will be populated if PO exists
      purchaseOrderNumber: po ? po.poNumber : null,
      status,
      source,

      // Supplier (if applicable)
      vendorId: supplier?.id || null,
      vendorName: supplier?.name || null,

      // Tracking
      trackingNumber: rawRow?.containerNumbers || null,
      containerNumbers: rawRow?.containerNumbers || null,

      // Delivery
      deliveryAddress: rawRow?.deliveryAddress || so.shippingAddress,

      // Dates
      shippedDate: status === 'in_transit' || status === 'delivered' ? rawRow?.etaPort : null,
      estimatedDeliveryDate: rawRow?.confirmedEta || so.expectedDeliveryDate,
      actualDeliveryDate: rawRow?.actualDelivery || null,

      // Notes
      notes: `Imported from historical data - ${so.loadNumber}`,

      // Source
      sourceRow: so.sourceRow,
      loadNumber: so.loadNumber,
    };

    previews.push(preview);
  }

  return previews;
}

// ============================================================================
// GET FULFILLMENT STATISTICS
// ============================================================================

export function getFulfillmentStats(
  poPreviews: PurchaseOrderPreview[],
  pickTicketPreviews: PickTicketPreview[],
  shipmentPreviews: ShipmentPreview[]
) {
  return {
    totalPOs: poPreviews.length,
    totalPickTickets: pickTicketPreviews.length,
    totalShipments: shipmentPreviews.length,
    totalPOItems: poPreviews.reduce((sum, po) => sum + po.items.length, 0),
    totalPickTicketItems: pickTicketPreviews.reduce(
      (sum, pt) => sum + pt.items.length,
      0
    ),
  };
}
