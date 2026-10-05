/**
 * Supplier PO Email Processing Service
 *
 * Main service for processing supplier purchase order confirmation and update emails.
 * Similar to processShippingEmail() but for supplier PO confirmations from manufacturers.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import { parseSupplierPOEmail } from '../parsers/supplier-po.parser';
import { matchSupplierPOData } from './matching.service';
import type { SupplierPOProcessingResult } from '../types';

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process supplier PO confirmation/update email
 *
 * Flow:
 * 1. Extract data using AI (parseSupplierPOEmail)
 * 2. Match supplier and PO with database (matchSupplierPOData)
 * 3. Update purchase order status and details
 * 4. Save to inbound_emails.extracted_data (or separate review queue)
 */
export async function processSupplierPO(
  emailId: string,
  subject: string,
  body: string
): Promise<SupplierPOProcessingResult> {
  console.log('[Supplier PO Processor] Processing email:', emailId);

  const supabase = createAdminClient();

  try {
    // ============================================
    // STEP 1: EXTRACT DATA USING AI
    // ============================================

    console.log('[Supplier PO Processor] Step 1: Extracting data with AI');

    const parsedData = await parseSupplierPOEmail(subject, body);

    console.log('[Supplier PO Processor] Extraction complete:', {
      supplier: parsedData.supplierName,
      poNumber: parsedData.poNumber,
      productionStatus: parsedData.productionStatus,
      confidence: parsedData.confidence,
    });

    // ============================================
    // STEP 2: MATCH WITH DATABASE
    // ============================================

    console.log('[Supplier PO Processor] Step 2: Matching with database');

    const matchingResults = await matchSupplierPOData(parsedData);

    console.log('[Supplier PO Processor] Matching complete:', {
      supplierMatch: matchingResults.supplier.matchType,
      poMatch: matchingResults.purchaseOrder.matchType,
      overallConfidence: matchingResults.overallConfidence,
      hasIssues: matchingResults.hasIssues,
    });

    // ============================================
    // STEP 3: UPDATE PURCHASE ORDER (if matched)
    // ============================================

    let purchaseOrderId: string | null = matchingResults.purchaseOrder.poId;
    let updated = false;

    if (purchaseOrderId && matchingResults.overallConfidence >= 0.6) {
      console.log('[Supplier PO Processor] Step 3: Updating purchase order');

      updated = await updatePurchaseOrder(
        supabase,
        purchaseOrderId,
        parsedData,
        matchingResults
      );

      console.log('[Supplier PO Processor] PO updated:', updated);
    } else {
      console.log('[Supplier PO Processor] Skipping PO update (low confidence or no match)');
    }

    // ============================================
    // STEP 4: SAVE EXTRACTED DATA TO EMAIL RECORD
    // ============================================

    await supabase
      .from('inbound_emails')
      .update({
        extracted_data: {
          parsed: parsedData,
          matching: matchingResults,
        },
        extraction_confidence: matchingResults.overallConfidence,
        extraction_status: updated ? 'processed' : 'extracted',
        status: updated ? 'processed' : 'received',
      })
      .eq('id', emailId);

    // ============================================
    // STEP 5: RETURN RESULT
    // ============================================

    const shouldReview = matchingResults.hasIssues || matchingResults.overallConfidence < 0.85;

    return {
      success: true,
      emailId,
      parsedData,
      matchingResults,
      purchaseOrderId,
      updated,
      shouldReview,
    };
  } catch (error) {
    console.error('[Supplier PO Processor] Error:', error);

    // Update email status to failed
    await supabase
      .from('inbound_emails')
      .update({
        status: 'failed',
        extraction_status: 'failed',
      })
      .eq('id', emailId);

    return {
      success: false,
      emailId,
      parsedData: null,
      matchingResults: null,
      purchaseOrderId: null,
      updated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      shouldReview: true,
    };
  }
}

// ============================================
// PURCHASE ORDER UPDATE
// ============================================

/**
 * Update purchase order with supplier confirmation data
 */
async function updatePurchaseOrder(
  supabase: any,
  poId: string,
  parsedData: any,
  _matchingResults: any
): Promise<boolean> {
  try {
    const updateData: any = {};

    // Update production status if provided
    if (parsedData.productionStatus) {
      // Map production status to PO status
      const statusMapping: Record<string, string> = {
        not_started: 'confirmed',
        in_production: 'in_production',
        ready_to_ship: 'ready_to_ship',
        shipped: 'in_transit',
      };

      const newStatus = statusMapping[parsedData.productionStatus];
      if (newStatus) {
        updateData.status = newStatus;
      }
    }

    // Update dates if provided
    if (parsedData.expectedCompletionDate) {
      updateData.expected_completion_date = parsedData.expectedCompletionDate;
    }

    if (parsedData.expectedShipDate) {
      updateData.expected_ship_date = parsedData.expectedShipDate;
    }

    if (parsedData.actualShipDate) {
      updateData.actual_ship_date = parsedData.actualShipDate;
    }

    // Update container info if provided
    if (parsedData.containerNumber) {
      // Find related shipment and update container number
      const { data: shipments } = await supabase
        .from('shipments')
        .select('id')
        .eq('purchase_order_id', poId)
        .limit(1);

      if (shipments && shipments.length > 0) {
        await supabase
          .from('shipments')
          .update({
            container_number: parsedData.containerNumber,
            vessel_name: parsedData.vesselName,
            voyage_number: parsedData.voyageNumber,
            mbl_number: parsedData.mblNumber,
            port_of_loading: parsedData.portOfLoading,
            port_of_discharge: parsedData.portOfDischarge,
            eta_to_port: parsedData.eta,
          })
          .eq('id', shipments[0].id);
      }
    }

    // Update internal notes with supplier notes
    if (parsedData.notes || parsedData.issuesOrConcerns) {
      const supplierNotes = `
Supplier Update (${new Date().toISOString().split('T')[0]}):
${parsedData.notes || ''}
${parsedData.issuesOrConcerns ? `\nIssues/Concerns: ${parsedData.issuesOrConcerns}` : ''}
      `.trim();

      updateData.internal_notes = supplierNotes;
    }

    // Only update if we have data to update
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', poId);

      if (error) {
        console.error('[Supplier PO Processor] Error updating PO:', error);
        return false;
      }

      console.log('[Supplier PO Processor] PO updated with:', Object.keys(updateData));
      return true;
    }

    console.log('[Supplier PO Processor] No updates needed for PO');
    return false;
  } catch (error) {
    console.error('[Supplier PO Processor] Error in updatePurchaseOrder:', error);
    return false;
  }
}
