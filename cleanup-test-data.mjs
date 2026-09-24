import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupDatabase() {
  console.log('=== DATABASE CLEANUP SCRIPT ===\n');
  console.log('⚠️  WARNING: This will DELETE all test data!');
  console.log('✅ KEEP: Customers and Products');
  console.log('❌ REMOVE: Sales Orders, Purchase Orders, Quotes, Shipments\n');

  try {
    // 1. Delete Sales Order Items first (foreign key dependency)
    console.log('1️⃣  Deleting Sales Order Items...');
    const { data: soItems, error: soItemsError } = await supabase
      .from('sales_order_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (soItemsError) {
      console.error('   ❌ Error:', soItemsError.message);
    } else {
      console.log('   ✅ Sales Order Items deleted');
    }

    // 2. Delete Sales Orders
    console.log('\n2️⃣  Deleting Sales Orders...');
    const { data: so, error: soError } = await supabase
      .from('sales_orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (soError) {
      console.error('   ❌ Error:', soError.message);
    } else {
      console.log('   ✅ Sales Orders deleted');
    }

    // 3. Delete Purchase Order Items first
    console.log('\n3️⃣  Deleting Purchase Order Items...');
    const { data: poItems, error: poItemsError } = await supabase
      .from('purchase_order_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (poItemsError) {
      console.error('   ❌ Error:', poItemsError.message);
    } else {
      console.log('   ✅ Purchase Order Items deleted');
    }

    // 4. Delete Purchase Orders
    console.log('\n4️⃣  Deleting Purchase Orders...');
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (poError) {
      console.error('   ❌ Error:', poError.message);
    } else {
      console.log('   ✅ Purchase Orders deleted');
    }

    // 5. Delete Quote Items first
    console.log('\n5️⃣  Deleting Quote Items...');
    const { data: quoteItems, error: quoteItemsError } = await supabase
      .from('quote_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (quoteItemsError) {
      console.error('   ❌ Error:', quoteItemsError.message);
    } else {
      console.log('   ✅ Quote Items deleted');
    }

    // 6. Delete Quotes
    console.log('\n6️⃣  Deleting Quotes...');
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (quotesError) {
      console.error('   ❌ Error:', quotesError.message);
    } else {
      console.log('   ✅ Quotes deleted');
    }

    // 7. Delete Shipments
    console.log('\n7️⃣  Deleting Shipments...');
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (shipmentsError) {
      console.error('   ❌ Error:', shipmentsError.message);
    } else {
      console.log('   ✅ Shipments deleted');
    }

    // 8. Delete Inventory Movements (if any)
    console.log('\n8️⃣  Deleting Inventory Movements...');
    const { data: invMov, error: invMovError } = await supabase
      .from('inventory_movements')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (invMovError) {
      console.error('   ❌ Error:', invMovError.message);
    } else {
      console.log('   ✅ Inventory Movements deleted');
    }

    // 9. Reset Inventory (set all to 0)
    console.log('\n9️⃣  Resetting Inventory to 0...');
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .update({ on_hand: 0, allocated: 0 })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

    if (inventoryError) {
      console.error('   ❌ Error:', inventoryError.message);
    } else {
      console.log('   ✅ Inventory reset to 0');
    }

    console.log('\n\n=== CLEANUP COMPLETE ===');
    console.log('✅ All test data removed');
    console.log('✅ Customers and Products preserved');
    console.log('\nDatabase is now ready for client data import from Excel file.');

  } catch (error) {
    console.error('\n❌ Fatal error during cleanup:', error);
  }
}

// Run cleanup
cleanupDatabase();
