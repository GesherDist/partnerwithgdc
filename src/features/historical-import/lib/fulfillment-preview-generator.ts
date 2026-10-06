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

    // DEBUG: Log what products are being used
    console.log(`[FULFILLMENT] ${row.loadNumber}: Products from API:`, {
      product38: products.product38 ? `${products.product38.sku} (${products.product38.name})` : 'NULL',
      product24: products.product24 ? `${products.product24.sku} (${products.product24.name})` : 'NULL',
    });

    if (row.qty38 > 0) {
      const lineTotal = row.qty38 * row.price38 * 100; // Convert to cents
      console.log(`[FULFILLMENT] ${row.loadNumber}: Adding 38" tire: qty=${row.qty38}, sku=${products.product38.sku}, name=${products.product38.name}`);
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
      console.log(`[FULFILLMENT] ${row.loadNumber}: Adding 24" tire: qty=${row.qty24}, sku=${products.product24.sku}, name=${products.product24.name}`);
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

  // Create map of SO number -> SO (for lookup)
  const soMap = new Map<string, SalesOrderPreview>();
  soPreviews.forEach((so) => {
    soMap.set(so.orderNumber, so);
  });

  // NEW: Create shipment for EVERY PO (not just SOs)
  // This supports Pre-PO/SO workflow where POs exist before customer orders
  console.log(`🚢 Generating ${poPreviews.length} shipments (one per PO)...`);

  // Track status mapping for debugging
  const statusMappingLog: Record<string, number> = {};

  for (const po of poPreviews) {
    const rawRow = rawRowsMap.get(po.loadNumber);
    const so = soMap.get(po.salesOrderNumber); // May be null for warehouse inventory

    // Determine shipment status from Excel status
    // Map Excel status to shipment workflow status (pending, in_transit, delivered, failed)
    let status = 'pending';

    // Define load status type
    type LoadStatusType = 'available' | 'sold' | 'open' | 'hold' | 'in_transit' | 'invoiced' | 'not_invoiced' | 'closed' | 'po_needed' | 'partially_paid' | 'paid' | 'disputed';
    let loadStatus: LoadStatusType = 'available';

    if (rawRow?.status) {
      const excelStatus = rawRow.status.toUpperCase();

      // Map to load_status (Operations Dashboard status - preserve Excel value)
      const statusMap: Record<string, LoadStatusType> = {
        'AVAILABLE': 'available',
        'SOLD': 'sold',
        'OPEN': 'open',
        'HOLD': 'hold',
        'IN TRANSIT': 'in_transit',
        'INVOICED': 'invoiced',
        'NOT INVOICED': 'not_invoiced',
        'CLOSED': 'closed',
        'PO NEEDED': 'po_needed',
        'PARTIALLY PAID': 'partially_paid',
        'PAID': 'paid',
        'DISPUTED': 'disputed',
      };

      loadStatus = statusMap[excelStatus] || 'available';

      // Map Operations Dashboard statuses to shipment workflow statuses
      if (excelStatus === 'IN TRANSIT') {
        status = 'in_transit';
      } else if (['INVOICED', 'DELIVERED', 'CLOSED'].includes(excelStatus)) {
        status = 'delivered';
      } else if (['OPEN', 'SOLD', 'AVAILABLE', 'HOLD', 'NOT INVOICED', 'PO NEEDED'].includes(excelStatus)) {
        // OPEN/SOLD/AVAILABLE/HOLD = confirmed order, not yet shipped
        status = 'pending';
      }
      // Default: pending
    }

    // DEBUG: Track status mapping
    const excelStatus = rawRow?.status || 'UNKNOWN';
    statusMappingLog[excelStatus] = (statusMappingLog[excelStatus] || 0) + 1;

    // Determine source (default to supplier for all POs)
    const source = 'supplier';

    // Get delivery address (from raw row or SO if available)
    const deliveryAddress = rawRow?.deliveryAddress || so?.shippingAddress || 'TBD';

    const preview: ShipmentPreview = {
      // Header
      salesOrderId: null, // Will be populated after SO creation (if SO exists)
      salesOrderNumber: po.salesOrderNumber, // Load number (SO2600057)
      purchaseOrderId: null, // Will be populated after PO creation
      purchaseOrderNumber: po.poNumber,
      status,
      loadStatus, // Operations Dashboard status from Excel
      source,

      // Supplier (if applicable)
      vendorId: supplier?.id || null,
      vendorName: supplier?.name || null,

      // Tracking
      trackingNumber: rawRow?.containerNumbers || null,
      containerNumbers: rawRow?.containerNumbers || null,

      // Delivery
      deliveryAddress,

      // Dates
      shippedDate: status === 'in_transit' || status === 'delivered' ? rawRow?.etaPort : null,
      estimatedDeliveryDate: rawRow?.confirmedEta || po.expectedDeliveryDate,
      actualDeliveryDate: rawRow?.actualDelivery || null,

      // Notes
      notes: so
        ? `Imported from historical data - ${po.loadNumber}`
        : `Warehouse inventory shipment - ${po.loadNumber} (${rawRow?.customer})`,

      // Source
      sourceRow: po.sourceRow,
      loadNumber: po.loadNumber,
    };

    previews.push(preview);
  }

  // DEBUG: Log status mapping summary
  console.log(`✅ Generated ${previews.length} shipment previews`);
  console.log(`📊 Excel Status Mapping:`, statusMappingLog);
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
