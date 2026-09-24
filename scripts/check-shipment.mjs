import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yqhdfgfoaelwrgknqsvh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxaGRmZ2ZvYWVsd3Jna25xc3ZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzk1NzM4NywiZXhwIjoyMDUzNTMzMzg3fQ.bqJOtDVN4DFkTOCqDm3sC6y9wCt0lJfW8vN1Io-ux-c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShipment() {
  // Find the shipment SH-2026-00004
  const { data: shipment, error } = await supabase
    .from('shipments')
    .select(`
      id,
      shipment_number,
      sales_order_id,
      total_qty,
      load_status,
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
    .eq('shipment_number', 'SH-2026-00004')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Shipment SH-2026-00004 ===');
  console.log('Shipment ID:', shipment.id);
  console.log('Shipment Number:', shipment.shipment_number);
  console.log('Sales Order ID:', shipment.sales_order_id);
  console.log('Load Status:', shipment.load_status);
  console.log('Total Qty:', shipment.total_qty);
  
  console.log('\n=== Linked Sales Order ===');
  if (shipment.sales_orders) {
    const so = Array.isArray(shipment.sales_orders) 
      ? shipment.sales_orders[0] 
      : shipment.sales_orders;
    
    if (so) {
      console.log('SO ID:', so.id);
      console.log('SO Order Number:', so.order_number);
      console.log('SO Customer PO:', so.customer_po_number);
      console.log('SO Customer ID:', so.customer_id);
      
      if (so.customers) {
        const customer = Array.isArray(so.customers) 
          ? so.customers[0] 
          : so.customers;
        console.log('Customer Name:', customer?.name || 'NOT FOUND');
      } else {
        console.log('Customer: NO CUSTOMER DATA');
      }
    } else {
      console.log('NO SALES ORDER DATA');
    }
  } else {
    console.log('NO LINKED SALES ORDER');
  }
}

checkShipment();
