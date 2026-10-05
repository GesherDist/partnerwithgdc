/**
 * HISTORICAL IMPORT - VALIDATE SINGLE CUSTOMER
 * =============================================
 * API endpoint to validate a single customer name against database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { customerName } = await request.json();

    if (!customerName) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Search for customer by normalized name (case-insensitive, partial match)
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name')
      .ilike('name', `%${customerName}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Customer validation error:', error);
      return NextResponse.json(
        { error: 'Failed to validate customer' },
        { status: 500 }
      );
    }

    if (customer) {
      return NextResponse.json({
        exists: true,
        customerId: customer.id,
        customerName: customer.name,
      });
    } else {
      return NextResponse.json({
        exists: false,
        customerId: null,
        customerName: null,
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
