/**
 * API: Get Products
 * ==================
 * Fetch required products for historical import
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all inventory tire products
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('item_type', 'inventory')
      .ilike('name', '%Tire%');

    // DEBUG: Log all products found
    console.log('[GET-PRODUCTS API] All tire products:', allProducts?.map(p => `${p.sku} - ${p.name}`));

    // Find 38" tire using SKU pattern (290/85R38)
    // Match products with SKU containing "290" or name ending with "R38"
    const product38 = (allProducts || [])
      .filter(p => {
        const sku = p.sku.toLowerCase();
        const name = p.name.toLowerCase();
        // Match SKU like "290/85R38" OR name ending with "R38" or "(38")"
        return sku.includes('290') || name.match(/r38|38['"]?\s*\)/);
      })
      .sort((a, b) => {
        // Prefer simpler product names (without "Direct" or "Offset")
        const aScore = (a.name.includes('Direct') ? 1 : 0) + (a.name.includes('Offset') ? 1 : 0);
        const bScore = (b.name.includes('Direct') ? 1 : 0) + (b.name.includes('Offset') ? 1 : 0);
        return aScore - bScore;
      })[0] || null;

    // Find 24" tire using SKU pattern (380/85R24)
    // Match products with SKU containing "380" or name ending with "R24"
    const product24 = (allProducts || [])
      .filter(p => {
        const sku = p.sku.toLowerCase();
        const name = p.name.toLowerCase();
        // Match SKU like "380/85R24" OR name ending with "R24" or "(24")"
        return sku.includes('380') || name.match(/r24|24['"]?\s*\)/);
      })
      .sort((a, b) => {
        const aScore = (a.name.includes('Direct') ? 1 : 0) + (a.name.includes('Offset') ? 1 : 0);
        const bScore = (b.name.includes('Direct') ? 1 : 0) + (b.name.includes('Offset') ? 1 : 0);
        return aScore - bScore;
      })[0] || null;

    // DEBUG: Log selected products
    console.log('[GET-PRODUCTS API] Selected:', {
      product38: product38 ? `${product38.sku} - ${product38.name}` : 'NULL',
      product24: product24 ? `${product24.sku} - ${product24.name}` : 'NULL',
    });

    return NextResponse.json({
      product38,
      product24,
    });
  } catch (error) {
    console.error('Error in get-products API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
