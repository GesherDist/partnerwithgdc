#!/usr/bin/env node

/**
 * HISTORICAL DATA IMPORT
 * ======================
 * Import historical sales data from Excel/CSV file
 *
 * Usage:
 *   node scripts/historical-import/import.mjs <file-path>
 *   node scripts/historical-import/import.mjs "C:\path\to\master-sheet.xlsx"
 *   node scripts/historical-import/import.mjs "C:\path\to\master-sheet.xlsx" --dry-run
 *   node scripts/historical-import/import.mjs "C:\path\to\master-sheet.xlsx" --sheet=GDC_1
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Sheet names
  SHEETS: ['GDC 0', 'GDC 1', 'GDC 2'],

  // Data starts from these rows (after header)
  DATA_START_ROW: {
    'GDC 0': 4,
    'GDC 1': 4,
    'GDC 2': 3
  },

  // Order series mapping
  ORDER_SERIES: {
    'GDC 0': 'GDC 0',
    'GDC 1': 'GDC 1',
    'GDC 2': 'GDC 2'
  },

  // Status mapping
  STATUS_MAP: {
    'AVAILABLE': 'confirmed',
    'OPEN': 'confirmed',
    'IN TRANSIT': 'processing',
    'INVOICED': 'delivered',
    'SOLD': 'delivered',
    'DELIVERED': 'delivered'
  },

  // Products
  PRODUCTS: {
    TIRE_38: '290/85R38',
    TIRE_24: '380/85R24'
  },

  // Supplier
  SUPPLIER_NAME: 'Galileo',

  // Admin user
  ADMIN_EMAIL: 'ankur@gesher.com',

  // Skip internal customers
  INTERNAL_CUSTOMERS: ['GDC', 'Nebraska Warehouse', 'Kansas Warehouse', 'Gesher'],
  SKIP_INTERNAL: true,
  SKIP_IF_CUSTOMER_NOT_FOUND: true
};

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// HELPERS
// ============================================================================

function excelDateToISO(excelDate) {
  if (!excelDate || typeof excelDate !== 'number') return null;
  try {
    const date = XLSX.SSF.parse_date_code(excelDate);
    if (!date) return null;
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

function parseRow(row, sheetName) {
  return {
    loadNumber: row[1],
    customer: row[5],
    po: row[6],
    qty38: parseInt(row[2]) || 0,
    qty24: parseInt(row[3]) || 0,
    price38: parseFloat(row[14]) || 0,
    price24: parseFloat(row[15]) || 0,
    deliveryAddress: row[7],
    confirmedEta: excelDateToISO(row[9]),
    customerDueDate: excelDateToISO(row[10]),
    actualDelivery: excelDateToISO(row[11]),
    status: row[18],
    containerNumbers: row[22],
    orderSeries: CONFIG.ORDER_SERIES[sheetName],
    sheetName
  };
}

function isInternalCustomer(customerName) {
  if (!customerName) return false;
  const name = customerName.trim().toLowerCase();
  return CONFIG.INTERNAL_CUSTOMERS.some(internal =>
    name.includes(internal.toLowerCase())
  );
}

function shouldCreateShipment(status) {
  return ['IN TRANSIT', 'INVOICED', 'SOLD', 'DELIVERED'].includes(status?.toUpperCase());
}

function getShipmentStatus(status) {
  const map = {
    'IN TRANSIT': 'in_transit',
    'INVOICED': 'delivered',
    'SOLD': 'delivered',
    'DELIVERED': 'delivered'
  };
  return map[status?.toUpperCase()] || null;
}

// ============================================================================
// DATABASE QUERIES
// ============================================================================

async function getResources() {
  const { data: product38 } = await supabase
    .from('products')
    .select('id, name, sku')
    .ilike('sku', CONFIG.PRODUCTS.TIRE_38)
    .limit(1)
    .single();

  const { data: product24 } = await supabase
    .from('products')
    .select('id, name, sku')
    .ilike('sku', CONFIG.PRODUCTS.TIRE_24)
    .limit(1)
    .single();

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, name')
    .ilike('name', `%${CONFIG.SUPPLIER_NAME}%`)
    .limit(1)
    .single();

  const { data: adminUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', CONFIG.ADMIN_EMAIL)
    .limit(1)
    .single();

  return { product38, product24, supplier, adminUser };
}

async function findCustomer(customerName) {
  if (!customerName) return null;
  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', customerName.trim())
    .limit(1)
    .single();
  return data;
}

async function orderExists(loadNumber) {
  const { data } = await supabase
    .from('sales_orders')
    .select('id')
    .eq('order_number', loadNumber)
    .limit(1)
    .single();
  return !!data;
}

// ============================================================================
// IMPORT ORDER
// ============================================================================

async function importOrder(order, resources, stats) {
  const { product38, product24, supplier, adminUser } = resources;

  try {
    // Validation
    if (!order.loadNumber?.startsWith('SO')) {
      stats.skip(order.loadNumber, 'Invalid load number');
      return;
    }

    if (order.qty38 === 0 && order.qty24 === 0) {
      stats.skip(order.loadNumber, 'No quantities');
      return;
    }

    // Check internal customer
    if (CONFIG.SKIP_INTERNAL && isInternalCustomer(order.customer)) {
      stats.skip(order.loadNumber, `Internal customer: ${order.customer}`);
      return;
    }

    // Find customer
    const customer = await findCustomer(order.customer);
    if (!customer) {
      stats.skip(order.loadNumber, `Customer not found: ${order.customer}`);
      return;
    }

    // Check if exists
    if (await orderExists(order.loadNumber)) {
      stats.skip(order.loadNumber, 'Already exists');
      return;
    }

    // Calculate totals
    const total38 = order.qty38 * order.price38;
    const total24 = order.qty24 * order.price24;
    const grandTotal = total38 + total24;
    const grandTotalCents = Math.round(grandTotal * 100);

    console.log(`   📦 ${order.loadNumber} - ${order.customer} - $${grandTotal.toFixed(2)}`);

    // Create Quote
    const quoteNumber = order.loadNumber.replace('SO', 'QT');
    const { data: quote } = await supabase
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        customer_id: customer.id,
        status: 'converted',
        notes: `Imported from ${order.sheetName}`,
        subtotal: grandTotalCents,
        tax_total: 0,
        grand_total: grandTotalCents,
        created_by: adminUser.id
      })
      .select()
      .single();

    // Create Quote Items
    const quoteItems = [];
    if (order.qty38 > 0) {
      quoteItems.push({
        quote_id: quote.id,
        product_id: product38.id,
        quantity: order.qty38,
        unit_price: Math.round(order.price38 * 100),
        line_total: Math.round(total38 * 100)
      });
    }
    if (order.qty24 > 0) {
      quoteItems.push({
        quote_id: quote.id,
        product_id: product24.id,
        quantity: order.qty24,
        unit_price: Math.round(order.price24 * 100),
        line_total: Math.round(total24 * 100)
      });
    }
    await supabase.from('quote_items').insert(quoteItems);

    // Create Sales Order
    const { data: salesOrder } = await supabase
      .from('sales_orders')
      .insert({
        order_number: order.loadNumber,
        customer_id: customer.id,
        quote_id: quote.id,
        status: CONFIG.STATUS_MAP[order.status?.toUpperCase()] || 'confirmed',
        customer_po_number: order.po,
        order_series: order.orderSeries,
        shipping_address: order.deliveryAddress,
        expected_delivery_date: order.customerDueDate,
        order_date: new Date().toISOString().split('T')[0],
        notes: `Imported from ${order.sheetName}`,
        subtotal: grandTotalCents,
        tax_total: 0,
        grand_total: grandTotalCents,
        created_by: adminUser.id
      })
      .select()
      .single();

    // Create SO Items
    const soItems = [];
    if (order.qty38 > 0) {
      const { data: item } = await supabase
        .from('sales_order_items')
        .insert({
          sales_order_id: salesOrder.id,
          product_id: product38.id,
          quantity: order.qty38,
          unit_price: Math.round(order.price38 * 100),
          line_total: Math.round(total38 * 100),
          fulfillment_source: 'manufacturer'
        })
        .select()
        .single();
      soItems.push(item);
    }
    if (order.qty24 > 0) {
      const { data: item } = await supabase
        .from('sales_order_items')
        .insert({
          sales_order_id: salesOrder.id,
          product_id: product24.id,
          quantity: order.qty24,
          unit_price: Math.round(order.price24 * 100),
          line_total: Math.round(total24 * 100),
          fulfillment_source: 'manufacturer'
        })
        .select()
        .single();
      soItems.push(item);
    }

    // Create PO
    const poNumber = order.loadNumber.replace('SO', 'PO');
    const { data: purchaseOrder } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        sales_order_id: salesOrder.id,
        status: 'confirmed',
        order_series: order.orderSeries,
        expected_delivery_date: order.confirmedEta,
        notes: `Imported from ${order.sheetName}`,
        subtotal: grandTotalCents,
        tax_total: 0,
        grand_total: grandTotalCents,
        created_by: adminUser.id
      })
      .select()
      .single();

    // Create PO Items + Fulfillment Allocations
    for (const soItem of soItems) {
      const { data: poItem } = await supabase
        .from('purchase_order_items')
        .insert({
          purchase_order_id: purchaseOrder.id,
          product_id: soItem.product_id,
          quantity: soItem.quantity,
          unit_price: soItem.unit_price,
          line_total: soItem.line_total,
          supplier_id: supplier.id,
          supplier_name: supplier.name
        })
        .select()
        .single();

      await supabase.from('fulfillment_allocations').insert({
        sales_order_item_id: soItem.id,
        po_item_id: poItem.id,
        quantity_allocated: soItem.quantity,
        fulfillment_source: 'manufacturer'
      });
    }

    // Create Shipment (conditional)
    if (shouldCreateShipment(order.status)) {
      await supabase.from('shipments').insert({
        sales_order_id: salesOrder.id,
        purchase_order_id: purchaseOrder.id,
        status: getShipmentStatus(order.status),
        source: 'supplier',
        supplier_id: supplier.id,
        tracking_number: order.containerNumbers || null,
        estimated_delivery_date: order.confirmedEta,
        actual_delivery_date: order.actualDelivery,
        notes: `Imported from ${order.sheetName}`
      });
    }

    stats.success();

  } catch (error) {
    stats.error(order.loadNumber, error.message);
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

class Stats {
  constructor() {
    this.total = 0;
    this.imported = 0;
    this.skipped = [];
    this.errors = [];
  }

  success() { this.imported++; }
  skip(load, reason) { this.skipped.push({ load, reason }); }
  error(load, error) { this.errors.push({ load, error }); }

  print() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    IMPORT SUMMARY                               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`   Total: ${this.total}`);
    console.log(`   ✅ Imported: ${this.imported}`);
    console.log(`   ⏭️  Skipped: ${this.skipped.length}`);
    console.log(`   ❌ Errors: ${this.errors.length}`);

    if (this.skipped.length > 0) {
      console.log('\n   Skipped Orders:');
      this.skipped.forEach(({ load, reason }) => {
        console.log(`      • ${load}: ${reason}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n   Errors:');
      this.errors.forEach(({ load, error }) => {
        console.log(`      • ${load}: ${error}`);
      });
    }
    console.log('');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const dryRun = args.includes('--dry-run');
  const sheetFilter = args.find(a => a.startsWith('--sheet='))?.split('=')[1];

  if (!filePath) {
    console.log('\n❌ Please provide Excel file path\n');
    console.log('Usage:');
    console.log('  node scripts/historical-import/import.mjs <file-path>');
    console.log('  node scripts/historical-import/import.mjs "C:\\path\\to\\file.xlsx"');
    console.log('  node scripts/historical-import/import.mjs "C:\\path\\to\\file.xlsx" --dry-run');
    console.log('  node scripts/historical-import/import.mjs "C:\\path\\to\\file.xlsx" --sheet="GDC 1"\n');
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║            HISTORICAL DATA IMPORT                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`   File: ${filePath}`);
  console.log(`   Dry Run: ${dryRun ? 'YES (no changes)' : 'NO (will import)'}\n`);

  // Read Excel
  const workbook = XLSX.readFile(filePath);
  const sheetsToProcess = sheetFilter
    ? [sheetFilter]
    : CONFIG.SHEETS;

  const allOrders = [];

  // Parse sheets
  for (const sheetName of sheetsToProcess) {
    if (!workbook.Sheets[sheetName]) {
      console.log(`   ⚠️  Sheet "${sheetName}" not found, skipping...\n`);
      continue;
    }

    console.log(`   📋 Parsing sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 });
    const startRow = CONFIG.DATA_START_ROW[sheetName] - 1;

    let count = 0;
    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row[1] || !row[1].toString().startsWith('SO')) continue;

      const order = parseRow(row, sheetName);
      allOrders.push(order);
      count++;
    }
    console.log(`      Found ${count} orders\n`);
  }

  if (allOrders.length === 0) {
    console.log('   ⚠️  No orders found\n');
    process.exit(0);
  }

  if (dryRun) {
    console.log(`   📊 Total Orders: ${allOrders.length}\n`);
    console.log('   Sample:\n');
    allOrders.slice(0, 5).forEach(o => {
      console.log(`      ${o.loadNumber} - ${o.customer} - $${(o.qty38 * o.price38 + o.qty24 * o.price24).toFixed(2)}`);
    });
    console.log('\n   Run without --dry-run to import\n');
    process.exit(0);
  }

  console.log(`   📊 Total Orders: ${allOrders.length}\n`);
  console.log('   Loading resources...');

  const resources = await getResources();
  if (!resources.product38 || !resources.product24 || !resources.supplier || !resources.adminUser) {
    console.log('   ❌ Missing resources (products/supplier/admin)\n');
    process.exit(1);
  }

  console.log('   ✅ Resources loaded\n');
  console.log('   🚀 Starting import...\n');

  const stats = new Stats();
  stats.total = allOrders.length;

  for (const order of allOrders) {
    await importOrder(order, resources, stats);
  }

  stats.print();
  process.exit(stats.errors.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
