/**
 * API: Get Default Location
 * ==========================
 * Fetch default warehouse location for pick tickets
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch first warehouse location
    const { data: location } = await supabase
      .from('locations')
      .select('id, name, location_code')
      .eq('location_type', 'warehouse')
      .limit(1)
      .single();

    return NextResponse.json({
      location: location || null,
    });
  } catch (error) {
    console.error('Error in get-default-location API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
