/**
 * API: Get Supplier
 * ==================
 * Fetch default supplier (Galileo) for historical import
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch Galileo supplier
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, name')
      .ilike('name', '%Galileo%')
      .limit(1)
      .single();

    return NextResponse.json({
      supplier: supplier || null,
    });
  } catch (error) {
    console.error('Error in get-supplier API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
