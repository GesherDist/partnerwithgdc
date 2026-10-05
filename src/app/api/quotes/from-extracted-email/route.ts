/**
 * Create Quote from Extracted Email Data
 *
 * POST /api/quotes/from-extracted-email
 *
 * Creates a quote from AI-extracted customer PO email data.
 * Called when Jenny approves extracted data from AutoExtractedDataSection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

// ============================================
// POST /api/quotes/from-extracted-email
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { emailId } = body;

    if (!emailId) {
      return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
    }

    console.log('[Create Quote from Email] Processing email:', emailId);

    // ============================================
    // STEP 1: FETCH EMAIL WITH EXTRACTED DATA
    // ============================================

    const { data: email, error: emailError } = await adminClient
      .from('inbound_emails')
      .select('*')
      .eq('id', emailId)
      .single();

    if (emailError || !email) {
      console.error('[Create Quote from Email] Email not found:', emailError);
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (!email.extracted_data) {
      return NextResponse.json(
        { error: 'No extracted data found for this email' },
        { status: 400 }
      );
    }

    const extractedData = email.extracted_data as any;
    const parsedData = extractedData.parsed;
    const matchingResults = extractedData.matching;

    console.log('[Create Quote from Email] Extracted data:', {
      customer: parsedData.customerName,
      items: parsedData.items?.length || 0,
      confidence: matchingResults.overallConfidence,
    });

    // ============================================
    // STEP 2: VALIDATE CUSTOMER MATCH
    // ============================================

    const customerId = matchingResults.customer?.customerId;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer not matched. Please create customer first.' },
        { status: 400 }
      );
    }

    // ============================================
    // STEP 3: GENERATE QUOTE NUMBER
    // ============================================

    const quoteNumber = await generateQuoteNumber(adminClient);

    // ============================================
    // STEP 4: CREATE QUOTE
    // ============================================

    const quoteData = {
      quote_number: quoteNumber,
      customer_id: customerId,
      customer_po_number: parsedData.poNumber,
      quote_date: new Date().toISOString().split('T')[0],
      expiration_date: parsedData.requiredDate || null,
      status: 'draft' as const,
      subtotal: parsedData.subtotal || 0,
      tax_amount: parsedData.tax || 0,
      total_amount: parsedData.total || parsedData.subtotal || 0,
      notes: parsedData.notes || `Auto-created from email (${email.subject})`,
      internal_notes: `Created from AI-extracted email data.\nEmail ID: ${emailId}\nConfidence: ${(matchingResults.overallConfidence * 100).toFixed(0)}%`,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: quote, error: quoteError } = await adminClient
      .from('quotes')
      .insert(quoteData)
      .select()
      .single();

    if (quoteError || !quote) {
      console.error('[Create Quote from Email] Error creating quote:', quoteError);
      return NextResponse.json(
        { error: 'Failed to create quote', details: quoteError?.message },
        { status: 500 }
      );
    }

    console.log('[Create Quote from Email] Quote created:', quote.id);

    // ============================================
    // STEP 5: CREATE QUOTE ITEMS
    // ============================================

    const quoteItems = [];

    for (let i = 0; i < parsedData.items.length; i++) {
      const item = parsedData.items[i];
      const productMatch = matchingResults.products[i];

      if (!productMatch || !productMatch.productId) {
        console.warn('[Create Quote from Email] Product not matched for item:', item.sku);
        continue; // Skip items without product match
      }

      const quoteItem = {
        quote_id: quote.id,
        product_id: productMatch.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice || 0,
        discount_percent: 0,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        line_total: item.lineTotal || item.quantity * (item.unitPrice || 0),
        notes: item.description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      quoteItems.push(quoteItem);
    }

    if (quoteItems.length > 0) {
      const { error: itemsError } = await adminClient
        .from('quote_items')
        .insert(quoteItems);

      if (itemsError) {
        console.error('[Create Quote from Email] Error creating quote items:', itemsError);
        // Don't fail the whole operation, just log the error
      } else {
        console.log('[Create Quote from Email] Created', quoteItems.length, 'quote items');
      }
    }

    // ============================================
    // STEP 6: UPDATE EMAIL STATUS
    // ============================================

    await adminClient
      .from('inbound_emails')
      .update({
        status: 'processed',
        extraction_status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailId);

    // ============================================
    // STEP 7: RETURN SUCCESS
    // ============================================

    return NextResponse.json({
      success: true,
      message: 'Quote created successfully from extracted email data',
      quoteId: quote.id,
      quoteNumber: quote.quote_number,
      itemsCreated: quoteItems.length,
    });
  } catch (error) {
    console.error('[Create Quote from Email] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate next quote number
 */
async function generateQuoteNumber(supabase: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;

  // Get the latest quote number for this year
  const { data: latestQuote } = await supabase
    .from('quotes')
    .select('quote_number')
    .like('quote_number', `${prefix}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let nextNumber = 1;

  if (latestQuote) {
    // Extract the number part and increment
    const match = latestQuote.quote_number.match(/Q-\d{4}-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Format as Q-2026-00001
  const paddedNumber = nextNumber.toString().padStart(5, '0');
  return `${prefix}${paddedNumber}`;
}
