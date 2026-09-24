'use server';

/**
 * Shipping Server Actions
 *
 * API layer for shipping tracking functionality.
 * All actions are permission-gated using shipments permissions.
 */

import { createClient } from '@/shared/lib/supabase/server';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';
import * as shippingRepo from '../repositories/shipping.repository';
import { reprocessShippingEmail as reprocessEmail } from '../services/shipping-processor.service';
import type {
  ActionResult,
  ShippingEmailWithInbound,
  ShipmentStatusHistory,
  ShippingEmailListResponse,
} from '../types';

// ============================================
// AUTHORIZATION HELPERS
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Verify current user has the required permission
 */
async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

// ============================================
// SHIPPING EMAILS
// ============================================

/**
 * Get shipping emails list with pagination
 */
export async function getShippingEmails(params: {
  page?: number;
  limit?: number;
  isProcessed?: boolean;
  hasIssue?: boolean;
}): Promise<ActionResult<ShippingEmailListResponse>> {
  // Uses shipments.view_module since shipping is part of shipment tracking
  const auth = await authorize('shipments.view_module');
  if (!auth.ok) return auth.result;

  const { page = 1, limit = 20 } = params;
  const result = await shippingRepo.getShippingEmails(params);

  return {
    success: true,
    data: {
      data: result.data,
      meta: {
        total: result.total,
        page,
        limit,
      },
    },
  };
}

/**
 * Get a single shipping email by ID
 */
export async function getShippingEmail(
  id: string
): Promise<ActionResult<ShippingEmailWithInbound>> {
  const auth = await authorize('shipments.view_detail');
  if (!auth.ok) return auth.result;

  const email = await shippingRepo.getShippingEmailById(id);

  if (!email) {
    return { success: false, error: 'Shipping email not found' };
  }

  return {
    success: true,
    data: email,
  };
}

// ============================================
// STATUS HISTORY
// ============================================

/**
 * Get status history for a shipment
 */
export async function getShipmentStatusHistory(
  shipmentId: string
): Promise<ActionResult<ShipmentStatusHistory[]>> {
  const auth = await authorize('shipments.track');
  if (!auth.ok) return auth.result;

  const history = await shippingRepo.getShipmentStatusHistory(shipmentId);

  return {
    success: true,
    data: history,
  };
}

// ============================================
// MANUAL OPERATIONS
// ============================================

/**
 * Manually link a shipping email to a shipment
 */
export async function linkEmailToShipment(
  shippingEmailId: string,
  shipmentId: string
): Promise<ActionResult<void>> {
  // Linking requires edit permission
  const auth = await authorize('shipments.edit');
  if (!auth.ok) return auth.result;

  const success = await shippingRepo.linkShippingEmailToShipment(
    shippingEmailId,
    shipmentId
  );

  if (!success) {
    return { success: false, error: 'Failed to link email to shipment' };
  }

  return { success: true };
}

/**
 * Reprocess a shipping email (re-extract and re-match)
 */
export async function reprocessShippingEmail(
  shippingEmailId: string
): Promise<ActionResult<{ matched: boolean; shipmentId?: string }>> {
  // Reprocessing requires edit permission
  const auth = await authorize('shipments.edit');
  if (!auth.ok) return auth.result;

  const result = await reprocessEmail(shippingEmailId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      matched: result.matched,
      shipmentId: result.shipmentId,
    },
  };
}

// ============================================
// INBOUND EMAIL CONTENT
// ============================================

/**
 * Get full inbound email content for preview
 */
export async function getInboundEmailContent(
  inboundEmailId: string
): Promise<ActionResult<{
  id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  received_at: string;
  text_body: string | null;
  html_body: string | null;
}>> {
  const auth = await authorize('shipments.view_detail');
  if (!auth.ok) return auth.result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inbound_emails')
    .select('id, subject, from_email, from_name, to_email, received_at, text_body, html_body')
    .eq('id', inboundEmailId)
    .single();

  if (error || !data) {
    return { success: false, error: 'Email not found' };
  }

  return {
    success: true,
    data,
  };
}

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * Get shipping email statistics
 */
export async function getShippingStats(): Promise<
  ActionResult<{
    total: number;
    processed: number;
    unprocessed: number;
    matched: number;
    unmatched: number;
    withIssues: number;
  }>
> {
  const auth = await authorize('shipments.view_module');
  if (!auth.ok) return auth.result;

  const supabase = await createClient();

  // Get counts using separate queries
  const [totalResult, processedResult, matchedResult, issuesResult] =
    await Promise.all([
      supabase
        .from('shipping_emails')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('shipping_emails')
        .select('id', { count: 'exact', head: true })
        .eq('is_processed', true),
      supabase
        .from('shipping_emails')
        .select('id', { count: 'exact', head: true })
        .eq('is_matched', true),
      supabase
        .from('shipping_emails')
        .select('id', { count: 'exact', head: true })
        .eq('has_issue', true),
    ]);

  const total = totalResult.count || 0;
  const processed = processedResult.count || 0;
  const matched = matchedResult.count || 0;
  const withIssues = issuesResult.count || 0;

  return {
    success: true,
    data: {
      total,
      processed,
      unprocessed: total - processed,
      matched,
      unmatched: processed - matched,
      withIssues,
    },
  };
}
