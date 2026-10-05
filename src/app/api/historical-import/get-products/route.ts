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

    // Find 38" tire (prefer non-Direct, non-Offset versions)
    const product38 = (allProducts || [])
      .filter(p => p.name.includes('38'))
      .sort((a, b) => {
        // Prefer simpler product names (without "Direct" or "Offset")
        const aScore = (a.name.includes('Direct') ? 1 : 0) + (a.name.includes('Offset') ? 1 : 0);
        const bScore = (b.name.includes('Direct') ? 1 : 0) + (b.name.includes('Offset') ? 1 : 0);
        return aScore - bScore;
      })[0] || null;

    // Find 24" tire (prefer non-Direct, non-Offset versions)
    const product24 = (allProducts || [])
      .filter(p => p.name.includes('24'))
      .sort((a, b) => {
        const aScore = (a.name.includes('Direct') ? 1 : 0) + (a.name.includes('Offset') ? 1 : 0);
        const bScore = (b.name.includes('Direct') ? 1 : 0) + (b.name.includes('Offset') ? 1 : 0);
        return aScore - bScore;
      })[0] || null;

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
