/**
 * API: Validate Customers
 * ========================
 * Check if customers exist in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { customerNames } = await request.json();

    if (!Array.isArray(customerNames)) {
      return NextResponse.json(
        { error: 'customerNames must be an array' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch all customers and do case-insensitive matching in code
    // This handles variations better than SQL ILIKE with IN clause
    const { data: allCustomers, error } = await supabase
      .from('customers')
      .select('id, name');

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch customers' },
        { status: 500 }
      );
    }

    // Create case-insensitive lookup map
    const customerMap = new Map<string, { id: string; name: string }>();
    (allCustomers || []).forEach((customer) => {
      customerMap.set(customer.name.toLowerCase(), customer);
    });

    // Find matching customers
    const matchedCustomers: { id: string; name: string }[] = [];
    customerNames.forEach((searchName) => {
      const normalized = searchName.trim().toLowerCase();
      const customer = customerMap.get(normalized);
      if (customer && !matchedCustomers.some(c => c.id === customer.id)) {
        matchedCustomers.push(customer);
      }
    });

    return NextResponse.json({
      customers: matchedCustomers,
    });
  } catch (error) {
    console.error('Error in validate-customers API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
