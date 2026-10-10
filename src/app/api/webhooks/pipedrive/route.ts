/**
 * Pipedrive Webhook Endpoint
 *
 * Handles incoming webhook events from Pipedrive CRM.
 * Supports person, deal, and note events.
 *
 * Endpoint: POST /api/webhooks/pipedrive
 *
 * Authentication: HTTP Basic Auth configured on the Pipedrive webhook
 * (PIPEDRIVE_WEBHOOK_USERNAME / PIPEDRIVE_WEBHOOK_PASSWORD). Requests are
 * rejected when the password is not configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pipedriveWebhookService } from '@/features/pipedrive/services/webhook.service';
import {
  verifyWebhookAuth,
  parseWebhookPayload,
  isSupportedEvent,
  getWebhookConfig,
  isWebhookAuthConfigured,
  generateEventKey,
  getEventTimestamp,
  normalizeWebhookPayload,
} from '@/features/pipedrive/lib/webhook-verify';
import {
  claimWebhookEvent,
  completeWebhookEvent,
  releaseWebhookEvent,
} from '@/features/pipedrive/lib/webhook-dedup';
import { toPipedriveId } from '@/features/pipedrive/lib/sync-log';
import { db } from '@/shared/lib/supabase/database';

// ============================================
// TYPES
// ============================================

interface WebhookPayload {
  v: number;
  matches_filters?: { current: unknown[] };
  meta: {
    action: string;
    object: string;
    id: number;
    company_id: number;
    user_id: number;
    host: string;
    timestamp: number;
    timestamp_micro: number;
    permitted_user_ids: number[];
    trans_pending: boolean;
    is_bulk_update: boolean;
    matches_filters?: { current: unknown[] };
    webhook_id: string;
    version?: string;
  };
  current?: unknown;
  previous?: unknown;
  event: string;
}

// ============================================
// POST HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let claimedEventKey: string | null = null;

  try {
    // Get config
    const config = getWebhookConfig();

    // Fail closed: an unconfigured secret must not mean "accept everything"
    if (!isWebhookAuthConfigured(config)) {
      console.error('[Pipedrive Webhook] Rejected: PIPEDRIVE_WEBHOOK_PASSWORD is not configured');
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Webhook authentication is not configured' },
        { status: 503 }
      );
    }

    const authResult = verifyWebhookAuth(
      request.headers.get('Authorization'),
      config.username,
      config.password
    );

    if (!authResult.valid) {
      console.warn('[Pipedrive Webhook] Auth failed:', authResult.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await request.text();
    const parseResult = parseWebhookPayload<WebhookPayload>(body);

    if (!parseResult.success || !parseResult.data?.meta) {
      const message = parseResult.success ? 'Missing meta in payload' : parseResult.error;
      console.error('[Pipedrive Webhook] Parse error:', message);
      return NextResponse.json({ error: 'Bad Request', message }, { status: 400 });
    }

    // Webhooks v2 (Pipedrive's default since Mar 17, 2025) are normalized to the v1 shape
    const payload = normalizeWebhookPayload(parseResult.data);

    // Check if event is supported
    if (!isSupportedEvent(payload.event)) {
      return NextResponse.json({
        success: true,
        action: 'skipped',
        message: `Unsupported event: ${payload.event ?? 'unknown'}`,
      });
    }

    // Deduplication: claim the event key before processing
    const eventKey = generateEventKey(
      payload.event,
      payload.meta.id,
      getEventTimestamp(payload.meta)
    );

    const claim = await claimWebhookEvent(eventKey, payload.event, toPipedriveId(payload.meta.id));
    if (claim === 'duplicate') {
      return NextResponse.json({
        success: true,
        action: 'skipped',
        message: 'Duplicate event',
      });
    }
    if (claim === 'in_progress') {
      // Another delivery is processing this event right now. A non-2xx makes
      // Pipedrive retry later, by which time it is either done or released.
      return NextResponse.json(
        { error: 'Conflict', message: 'Event is already being processed' },
        { status: 409 }
      );
    }
    claimedEventKey = eventKey;

    // Process the event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await pipedriveWebhookService.processEvent(payload as any);

    const duration = Date.now() - startTime;

    if (result.success) {
      await completeWebhookEvent(eventKey);
    } else {
      // Allow a later redelivery of this event to be processed again
      await releaseWebhookEvent(eventKey);

      console.error(
        `[Pipedrive Webhook] ${payload.event} (${payload.meta.object}:${payload.meta.id}) failed in ${duration}ms: ${result.message}`
      );

      const { error: logError } = await db.from('pipedrive_sync_log').insert({
        event_type: 'webhook',
        direction: 'inbound',
        entity_type: payload.meta.object,
        entity_id: null,
        pipedrive_id: toPipedriveId(payload.meta.id),
        payload: payload as unknown as Record<string, unknown>,
        status: 'failed',
        error_message: result.message,
      });
      if (logError) {
        console.error('[Pipedrive Webhook] Failed to write sync log:', logError.message);
      }
    }

    return NextResponse.json({
      success: result.success,
      action: result.action,
      entityType: result.entityType,
      entityId: result.entityId,
      message: result.message,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[Pipedrive Webhook] Error:', error);

    // Pipedrive retries on 5xx - release the key so the retry is processed
    if (claimedEventKey) {
      await releaseWebhookEvent(claimedEventKey);
    }

    // Log error
    try {
      await db.from('pipedrive_sync_log').insert({
        event_type: 'webhook',
        direction: 'inbound',
        entity_type: 'unknown',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET HANDLER (Health Check)
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/pipedrive',
    supportedEvents: [
      'added.person',
      'updated.person',
      'deleted.person',
      'added.deal',
      'updated.deal',
      'deleted.deal',
      'added.note',
      'updated.note',
    ],
    timestamp: new Date().toISOString(),
  });
}
