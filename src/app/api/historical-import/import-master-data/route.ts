/**
 * Import Master Data API
 * ======================
 * Bulk import customers and products from CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parse } from 'csv-parse/sync';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    if (type !== 'customers' && type !== 'products') {
      return NextResponse.json({ message: 'Invalid type' }, { status: 400 });
    }

    // Read CSV
    const buffer = Buffer.from(await file.arrayBuffer());
    const csvText = buffer.toString('utf-8');

    // Parse CSV
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return NextResponse.json(
        { message: 'No data found in CSV' },
        { status: 400 }
      );
    }

    // Import based on type
    if (type === 'customers') {
      return await importCustomers(records);
    } else {
      return await importProducts(records);
    }
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      {
        message: 'Failed to import data',
        errors: [(error as Error).message],
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// IMPORT CUSTOMERS
// ============================================================================

async function importCustomers(records: any[]) {
  const supabase = createAdminClient();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of records) {
    try {
      // Validate required fields
      if (!row.name || !row.email) {
        errors.push(`Row ${records.indexOf(row) + 1}: Missing name or email`);
        continue;
      }

      // Check if customer exists by email
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', row.email)
        .maybeSingle();

      const customerData = {
        name: row.name,
        email: row.email,
        phone: row.phone || null,
        billing_address_street: row.address_street || null,
        billing_address_city: row.address_city || null,
        billing_address_state: row.address_state || null,
        billing_address_postal_code: row.address_postal_code || null,
        billing_address_country: 'US',
        shipping_address_street: row.address_street || null,
        shipping_address_city: row.address_city || null,
        shipping_address_state: row.address_state || null,
        shipping_address_postal_code: row.address_postal_code || null,
        shipping_address_country: 'US',
        channel: row.channel === 'oem' || row.channel === 'dealer' ? row.channel : 'dealer',
        status: 'active',
      };

      if (existing) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', existing.id);

        if (error) throw error;
        updated++;
      } else {
        // Create new customer
        const { error } = await supabase
          .from('customers')
          .insert(customerData);

        if (error) throw error;
        created++;
      }
    } catch (error) {
      errors.push(
        `Row ${records.indexOf(row) + 1} (${row.name}): ${(error as Error).message}`
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: `Import completed: ${created} created, ${updated} updated`,
    created,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// ============================================================================
// IMPORT PRODUCTS
// ============================================================================

async function importProducts(records: any[]) {
  const supabase = createAdminClient();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of records) {
    try {
      // Validate required fields
      if (!row.sku || !row.name) {
        errors.push(`Row ${records.indexOf(row) + 1}: Missing SKU or name`);
        continue;
      }

      // Check if product exists by SKU
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', row.sku)
        .maybeSingle();

      // Determine product type
      let productType: string;
      if (row.category === 'tire' || row.category === 'rim' || row.category === 'accessory') {
        productType = row.category;
      } else {
        productType = 'tire'; // Default
      }

      // Item type
      const itemType = 'inventory'; // All imported products are inventory items

      const productData = {
        sku: row.sku,
        name: row.name,
        description: row.description || null,
        product_type: productType,
        item_type: itemType,
        cost: row.cost ? parseFloat(row.cost) * 100 : 0, // Convert to cents
        price: row.price ? parseFloat(row.price) * 100 : 0, // Convert to cents
        tire_size: row.tire_size || null,
        rim_size: row.rim_size || null,
        weight_lbs: row.weight_lbs ? parseFloat(row.weight_lbs) : null,
        status: 'active',
        is_active: true,
      };

      if (existing) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', existing.id);

        if (error) throw error;
        updated++;
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) throw error;
        created++;
      }
    } catch (error) {
      errors.push(
        `Row ${records.indexOf(row) + 1} (${row.sku}): ${(error as Error).message}`
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: `Import completed: ${created} created, ${updated} updated`,
    created,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  });
}
