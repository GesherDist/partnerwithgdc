/**
 * Shipping Processor Service
 *
 * Main processing logic for shipping emails.
 * Orchestrates extraction, matching, and database updates.
 */

import { extractShippingInfo } from './shipping-extract.service';
import * as shippingRepo from '../repositories/shipping.repository';
import {
  updateSalesOrderStatus,
  updateShipmentLoadStatus,
} from '../repositories/shipping.repository';
import type {
  ProcessShippingEmailResult,
  ShippingEmailExtraction,
  ShipmentTrackingStatus,
} from '../types';
import type { OrderStatus } from '@/features/sales-orders/types';

// ============================================
// CONFIDENCE THRESHOLD
// ============================================

/**
 * Minimum AI extraction confidence required to auto-update shipment data.
 * Extractions below this threshold will be logged but not applied.
 */
const CONFIDENCE_THRESHOLD = 0.6;

// ============================================
// STATUS MAPPING: Tracking → Sales Order
// ============================================

const TRACKING_TO_ORDER_STATUS: Record<ShipmentTrackingStatus, OrderStatus> = {
  booked: 'confirmed',
  container_picked: 'processing',
  loaded_on_vessel: 'processing',
  departed_origin: 'processing',
  in_transit: 'processing',
  arrived_port: 'processing',
  customs_clearance: 'processing',
  on_rail: 'shipped',
  at_ramp: 'shipped',
  out_for_delivery: 'shipped',
  delivered: 'delivered',
  exception: 'processing', // Keep processing, don't change on exception
};

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process a shipping email
 *
 * Flow:
 * 1. Extract shipping info using AI
 * 2. Create shipping_emails record
 * 3. Check confidence threshold
 * 4. Try to match with existing shipment (by Container# or SO#)
 * 5. If matched and confidence OK: Update shipment + Create status history
 * 6. If issue detected: Log for alerting
 *
 * @param inboundEmailId - The ID of the inbound email record
 * @param subject - Email subject
 * @param body - Email body
 * @param eventTimestamp - Optional timestamp of when the email was received (for ETA comparison)
 */
export async function processShippingEmail(
  inboundEmailId: string,
  subject: string,
  body: string,
  eventTimestamp?: string
): Promise<ProcessShippingEmailResult> {
  try {
    // Step 1: Extract shipping info using AI
    console.log(`[Shipping] Processing email: ${subject.substring(0, 50)}...`);

    const extraction = await extractShippingInfo(subject, body);

    console.log(`[Shipping] Extracted:`, {
      container: extraction.containerNumber,
      so: extraction.soNumber,
      status: extraction.detectedStatus,
      hasIssue: extraction.hasIssue,
      confidence: extraction.confidence,
    });

    // Step 2: Create shipping email record (idempotent - returns existing if duplicate)
    const shippingEmail = await shippingRepo.createShippingEmail({
      inbound_email_id: inboundEmailId,
      extraction,
    });

    if (!shippingEmail) {
      return {
        success: false,
        error: 'Failed to create shipping email record',
        matched: false,
      };
    }

    // Step 3: Check confidence threshold
    // Low confidence extractions should not auto-update shipment data
    if (extraction.confidence < CONFIDENCE_THRESHOLD) {
      console.warn(
        `[Shipping] Low confidence extraction (${extraction.confidence} < ${CONFIDENCE_THRESHOLD}). Skipping shipment updates.`
      );

      // Mark email as processed but don't update shipment
      await shippingRepo.markShippingEmailProcessed(shippingEmail.id);

      return {
        success: true,
        shippingEmailId: shippingEmail.id,
        matched: false,
        extraction,
        skippedReason: `Low confidence: ${extraction.confidence}`,
      };
    }

    // Step 4: Try to match with existing shipment
    const shipment = await shippingRepo.findShipmentByReference(
      extraction.containerNumber,
      extraction.soNumber
    );

    if (shipment) {
      console.log(`[Shipping] Matched to shipment: ${shipment.shipment_number}`);

      // Determine the active container number
      // For transload scenarios, prefer the NEW container as the active one
      let activeContainerNumber = extraction.containerNumber;
      let originalContainerNumber: string | undefined;

      if (extraction.isTransload && extraction.newContainerNumber) {
        // Transload: new container is the active one
        activeContainerNumber = extraction.newContainerNumber;
        // Keep original container for reference
        originalContainerNumber = extraction.containerNumber || undefined;
        console.log(
          `[Shipping] Transload detected: ${originalContainerNumber} → ${activeContainerNumber}`
        );
      }

      // Step 5: Update shipment with tracking info (with regression protection)
      await shippingRepo.updateShipmentTracking(
        shipment.id,
        {
          container_number: activeContainerNumber || undefined,
          mbl_number: extraction.mblNumber || undefined,
          vessel_name: extraction.vesselName || undefined,
          voyage_number: extraction.voyageNumber || undefined,
          tracking_status: extraction.detectedStatus,
          eta_port_tracking: extraction.etaPort || undefined,
          eta_ramp: extraction.etaRamp || undefined,
          lfd_date: extraction.lfdDate || undefined,
          has_issue: extraction.hasIssue,
          issue_type: extraction.issueType || undefined,
          issue_description: extraction.issueDescription || undefined,
          transload_container: extraction.newContainerNumber || undefined,
          original_container_number: originalContainerNumber,
          is_transloaded: extraction.isTransload,
        },
        eventTimestamp // Pass event timestamp for ETA comparison
      );

      // Step 5b: Update shipment load_status for Operations Dashboard (with regression protection)
      await updateShipmentLoadStatus(shipment.id, extraction.detectedStatus);

      // Step 5c: Send notification for shipment update (non-blocking)
      try {
        const { notificationService } = await import('@/features/notifications/services/notification.service');
        notificationService.notifyShipmentUpdate({
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipment_number,
          status: extraction.detectedStatus || 'updated',
          trackingNumber: extraction.containerNumber || undefined,
          customerName: shipment.customer_name || undefined,
          customerPoNumber: shipment.customer_po_number || undefined,
        });
      } catch (notifError) {
        console.error('[Shipping] Failed to send notification:', notifError);
      }

      // Step 6: Create status history entry (idempotent - skips duplicates)
      await shippingRepo.createStatusHistory({
        shipment_id: shipment.id,
        status: extraction.detectedStatus,
        location: extraction.currentLocation || undefined,
        inbound_email_id: inboundEmailId,
        shipping_email_id: shippingEmail.id,
        notes: extraction.statusDescription,
        raw_extract: extraction as unknown as Record<string, unknown>,
      });

      // Step 7: Link shipping email to shipment
      await shippingRepo.linkShippingEmailToShipment(
        shippingEmail.id,
        shipment.id
      );

      // Step 8: Handle issues if detected
      if (extraction.hasIssue) {
        await handleShippingIssue(shipment.id, extraction);
      }

      // Step 9: Update Sales Order status based on tracking status
      if (shipment.sales_order_id && extraction.detectedStatus) {
        const newOrderStatus = TRACKING_TO_ORDER_STATUS[extraction.detectedStatus];
        if (newOrderStatus) {
          await updateSalesOrderStatus(shipment.sales_order_id, newOrderStatus);
          console.log(
            `[Shipping] Sales Order status updated based on tracking: ${extraction.detectedStatus} → ${newOrderStatus}`
          );
        }
      }

      return {
        success: true,
        shippingEmailId: shippingEmail.id,
        shipmentId: shipment.id,
        matched: true,
        extraction,
      };
    }

    // No match found - mark as processed without match
    console.log(
      `[Shipping] No matching shipment found for container: ${extraction.containerNumber}, SO: ${extraction.soNumber}`
    );

    await shippingRepo.markShippingEmailProcessed(shippingEmail.id);

    return {
      success: true,
      shippingEmailId: shippingEmail.id,
      matched: false,
      extraction,
    };
  } catch (error) {
    console.error('[Shipping] Processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      matched: false,
    };
  }
}

// ============================================
// ISSUE HANDLING
// ============================================

/**
 * Handle shipping issues (alerts, notifications)
 *
 * TODO: Implement actual notification system
 * - Email to ops team
 * - Dashboard alert
 * - Slack/Teams notification
 */
async function handleShippingIssue(
  shipmentId: string,
  extraction: ShippingEmailExtraction
): Promise<void> {
  console.log(`[Shipping] Issue detected for shipment ${shipmentId}:`, {
    type: extraction.issueType,
    description: extraction.issueDescription,
  });

  // Log critical issues with appropriate severity
  switch (extraction.issueType) {
    case 'container_damaged':
      console.error(
        `[Shipping] 🚨 CRITICAL - Container Damaged: ${extraction.containerNumber}`
      );
      // TODO: Send urgent notification
      break;

    case 'lfd_approaching':
      console.warn(
        `[Shipping] ⚠️ WARNING - LFD Approaching: ${extraction.lfdDate} for container ${extraction.containerNumber}`
      );
      // TODO: Send warning notification
      break;

    case 'demurrage_risk':
      console.warn(
        `[Shipping] ⚠️ WARNING - Demurrage Risk: ${extraction.containerNumber}`
      );
      // TODO: Send warning notification
      break;

    case 'transload_required':
      console.log(
        `[Shipping] 📦 INFO - Transload Required: ${extraction.containerNumber} → ${extraction.newContainerNumber}`
      );
      break;

    case 'delayed':
      console.warn(
        `[Shipping] ⏰ WARNING - Shipment Delayed: ${extraction.containerNumber}`
      );
      break;

    default:
      console.log(
        `[Shipping] ℹ️ INFO - Issue detected: ${extraction.issueType}`
      );
  }

  // Future: Create notification record in database
  // Future: Send email/Slack notification to ops team
}

// ============================================
// BATCH PROCESSING (for manual/scheduled runs)
// ============================================

/**
 * Reprocess a shipping email
 * Useful for manual review or when AI model is updated
 */
export async function reprocessShippingEmail(
  shippingEmailId: string
): Promise<ProcessShippingEmailResult> {
  // Get the shipping email with inbound email data
  const shippingEmail = await shippingRepo.getShippingEmailById(shippingEmailId);

  if (!shippingEmail) {
    return {
      success: false,
      error: 'Shipping email not found',
      matched: false,
    };
  }

  const inboundEmail = shippingEmail.inbound_emails;
  if (!inboundEmail) {
    return {
      success: false,
      error: 'Inbound email not found',
      matched: false,
    };
  }

  // Re-extract and process
  // Note: This creates a new extraction but doesn't duplicate the shipping_email record
  const extraction = await extractShippingInfo(
    inboundEmail.subject,
    (inboundEmail as { text_body?: string }).text_body || ''
  );

  // Try to match with shipment
  const shipment = await shippingRepo.findShipmentByReference(
    extraction.containerNumber,
    extraction.soNumber
  );

  if (shipment) {
    // Update shipment
    await shippingRepo.updateShipmentTracking(shipment.id, {
      container_number: extraction.containerNumber || undefined,
      mbl_number: extraction.mblNumber || undefined,
      tracking_status: extraction.detectedStatus,
      eta_port_tracking: extraction.etaPort || undefined,
      lfd_date: extraction.lfdDate || undefined,
      has_issue: extraction.hasIssue,
      issue_type: extraction.issueType || undefined,
    });

    // Link email to shipment
    await shippingRepo.linkShippingEmailToShipment(shippingEmailId, shipment.id);

    return {
      success: true,
      shippingEmailId,
      shipmentId: shipment.id,
      matched: true,
      extraction,
    };
  }

  await shippingRepo.markShippingEmailProcessed(shippingEmailId);

  return {
    success: true,
    shippingEmailId,
    matched: false,
    extraction,
  };
}
