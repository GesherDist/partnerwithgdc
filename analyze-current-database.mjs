import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from both .env and .env.local
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeDatabase() {
  console.log('=== ANALYZING CURRENT DATABASE STATE ===\n');

  try {
    // 1. Sales Orders
    const { data: salesOrders, error: soError } = await supabase
      .from('sales_orders')
      .select('id, order_number, customer_po_number, status, order_date, created_at')
      .order('created_at', { ascending: false });

    if (soError) {
      console.error('Error fetching sales orders:', soError);
    } else {
      console.log(`\n📋 SALES ORDERS: ${salesOrders?.length || 0} records`);
      if (salesOrders && salesOrders.length > 0) {
        console.log('\nRecent Sales Orders:');
        salesOrders.slice(0, 10).forEach(so => {
          console.log(`  - ${so.order_number} | PO: ${so.customer_po_number || 'N/A'} | Status: ${so.status} | Date: ${so.order_date}`);
        });
      }
    }

    // 2. Purchase Orders
    const { data: purchaseOrders, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, status, created_at')
      .order('created_at', { ascending: false });

    if (poError) {
      console.error('Error fetching purchase orders:', poError);
    } else {
      console.log(`\n\n📦 PURCHASE ORDERS: ${purchaseOrders?.length || 0} records`);
      if (purchaseOrders && purchaseOrders.length > 0) {
        console.log('\nRecent Purchase Orders:');
        purchaseOrders.slice(0, 10).forEach(po => {
          console.log(`  - ${po.po_number} | Status: ${po.status}`);
        });
      }
    }

    // 3. Quotes
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, quote_number, status, quote_date, created_at')
      .order('created_at', { ascending: false });

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
    } else {
      console.log(`\n\n💰 QUOTES: ${quotes?.length || 0} records`);
      if (quotes && quotes.length > 0) {
        console.log('\nRecent Quotes:');
        quotes.slice(0, 10).forEach(q => {
          console.log(`  - ${q.quote_number} | Status: ${q.status} | Date: ${q.quote_date}`);
        });
      }
    }

    // 4. Shipments
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select('id, shipment_number, tracking_status, created_at')
      .order('created_at', { ascending: false });

    if (shipmentsError) {
      console.error('Error fetching shipments:', shipmentsError);
    } else {
      console.log(`\n\n🚚 SHIPMENTS: ${shipments?.length || 0} records`);
      if (shipments && shipments.length > 0) {
        console.log('\nRecent Shipments:');
        shipments.slice(0, 10).forEach(s => {
          console.log(`  - ${s.shipment_number} | Status: ${s.tracking_status || 'N/A'}`);
        });
      }
    }

    // 5. Customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, customer_code, status')
      .order('name', { ascending: true });

    if (customersError) {
      console.error('Error fetching customers:', customersError);
    } else {
      console.log(`\n\n👥 CUSTOMERS: ${customers?.length || 0} records`);
      if (customers && customers.length > 0) {
        console.log('\nAll Customers:');
        customers.forEach(c => {
          console.log(`  - ${c.name} (${c.customer_code}) | Status: ${c.status}`);
        });
      }
    }

    // 6. Products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, item_type')
      .order('name', { ascending: true });

    if (productsError) {
      console.error('Error fetching products:', productsError);
    } else {
      console.log(`\n\n📦 PRODUCTS: ${products?.length || 0} records`);
      if (products && products.length > 0) {
        console.log('\nAll Products:');
        products.forEach(p => {
          console.log(`  - ${p.name} (SKU: ${p.sku}) | Type: ${p.item_type}`);
        });
      }
    }

    // Summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Sales Orders: ${salesOrders?.length || 0}`);
    console.log(`Purchase Orders: ${purchaseOrders?.length || 0}`);
    console.log(`Quotes: ${quotes?.length || 0}`);
    console.log(`Shipments: ${shipments?.length || 0}`);
    console.log(`Customers: ${customers?.length || 0}`);
    console.log(`Products: ${products?.length || 0}`);

    console.log('\n\n=== RECOMMENDATION ===');
    console.log('Based on user instruction:');
    console.log('  ✅ Keep: Customers and Products (already proper)');
    console.log('  ❌ Clean: Sales Orders, Purchase Orders, Quotes, Shipments (extra/test data)');
    console.log('\nNext step: Remove extra data from sales_orders, purchase_orders, quotes, shipments tables');
    console.log('Then import 31 orders from gdc-data-parsed.json');

  } catch (error) {
    console.error('Error analyzing database:', error);
  }
}

analyzeDatabase();
