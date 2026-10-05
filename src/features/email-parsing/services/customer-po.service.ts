/**
 * Customer PO Email Processing Service
 *
 * Main service for processing customer purchase order emails.
 * Similar to processShippingEmail() but for customer POs.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import { parseCustomerPOEmail } from '../parsers/customer-po.parser';
import { matchCustomerPOData } from './matching.service';
import type { CustomerPOProcessingResult } from '../types';

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process customer PO email
 *
 * Similar to processShippingEmail() but for customer PO emails:
 * 1. Extract data using AI
 * 2. Match customer and products with database
 * 3. Save to review queue (or auto-create quote if high confidence)
 */
export async function processCustomerPO(
  emailId: string,
  subject: string,
  body: string
): Promise<CustomerPOProcessingResult> {
  console.log('[Customer PO Processor] Processing email:', emailId);

  const supabase = createAdminClient();

  try {
    // ============================================
    // STEP 1: EXTRACT DATA USING AI
    // ============================================

    console.log('[Customer PO Processor] Step 1: Extracting data with AI');

    const parsedData = await parseCustomerPOEmail(subject, body);

    console.log('[Customer PO Processor] Extraction complete:', {
      customerName: parsedData.customerName,
      poNumber: parsedData.poNumber,
      itemCount: parsedData.items?.length || 0,
      confidence: parsedData.confidence,
    });

    // ============================================
    // STEP 2: MATCH WITH DATABASE
    // ============================================

    console.log('[Customer PO Processor] Step 2: Matching with database');

    const matchingResults = await matchCustomerPOData(parsedData);

    console.log('[Customer PO Processor] Matching complete:', {
      customerMatch: matchingResults.customer.matchType,
      productsMatched: matchingResults.products.filter((p) =>
        p.matchType.includes('exact')
      ).length,
      overallConfidence: matchingResults.overallConfidence,
      hasIssues: matchingResults.hasIssues,
    });

    // ============================================
    // STEP 3: DETERMINE ACTION
    // ============================================

    const shouldAutoProcess =
      parsedData.confidence > 0.85 &&
      matchingResults.overallConfidence > 0.85 &&
      !matchingResults.hasIssues &&
      matchingResults.customer.customerId !== null;

    console.log('[Customer PO Processor] Should auto-process?', shouldAutoProcess);

    // ============================================
    // STEP 4: SAVE EXTRACTED DATA TO EMAIL
    // ============================================

    console.log('[Customer PO Processor] Step 4: Saving extracted data to email');

    // Save extracted data in the inbound_emails table itself
    // No need for separate review queue table - use existing Inbox!
    await supabase
      .from('inbound_emails')
      .update({
        status: 'extracted',
        extracted_data: {
          parsed: parsedData,
          matching: matchingResults,
        },
        extraction_confidence: matchingResults.overallConfidence,
        extraction_status: 'pending_review',
      })
      .eq('id', emailId);

    console.log('[Customer PO Processor] Saved extracted data to email:', emailId);

    // ============================================
    // RETURN RESULT
    // ============================================

    return {
      success: true,
      emailId,
      parsedData,
      matchingResults,
      quoteId: null, // Not auto-creating quotes yet
      shouldReview: true, // Always requires review for now
    };
  } catch (error) {
    console.error('[Customer PO Processor] Processing failed:', error);

    // Update email status to failed
    await supabase.from('inbound_emails').update({ status: 'failed' }).eq('id', emailId);

    return {
      success: false,
      emailId,
      parsedData: null,
      matchingResults: null,
      quoteId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      shouldReview: false,
    };
  }
}
