/**
 * Pipedrive Webhook Endpoint
 *
 * Handles incoming webhook events from Pipedrive CRM.
 * Supports person, deal, and note events.
 *
 * Endpoint: POST /api/webhooks/pipedrive
 */

import { NextRequest, NextResponse } from 'next/server';
import { pipedriveWebhookService } from '@/features/pipedrive/services/webhook.service';
import {
  verifyWebhookAuth,
  parseWebhookPayload,
  isSupportedEvent,
  getWebhookConfig,
  generateEventKey,
} from '@/features/pipedrive/lib/webhook-verify';
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
  };
  current?: unknown;
  previous?: unknown;
  event: string;
}

// In-memory dedup cache (5 minute window)
const processedEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedEvents.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedEvents.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

// ============================================
// POST HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get config
    const config = getWebhookConfig();

    // Verify authentication (if configured)
    if (config.username && config.password) {
      const authHeader = request.headers.get('Authorization');
      const authResult = verifyWebhookAuth(
        authHeader,
        config.username,
        config.password
      );

      if (!authResult.valid) {
        console.warn('[Pipedrive Webhook] Auth failed:', authResult.error);
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error },
          { status: 401 }
        );
      }
    }

    // Parse body
    const body = await request.text();
    const parseResult = parseWebhookPayload<WebhookPayload>(body);

    if (!parseResult.success) {
      console.error('[Pipedrive Webhook] Parse error:', parseResult.error);
      return NextResponse.json(
        { error: 'Bad Request', message: parseResult.error },
        { status: 400 }
      );
    }

    const payload = parseResult.data;

    // Log incoming webhook
    console.log(`[Pipedrive Webhook] Received: ${payload.event} (${payload.meta.object}:${payload.meta.id})`);

    // Check if event is supported
    if (!isSupportedEvent(payload.event)) {
      console.log(`[Pipedrive Webhook] Skipping unsupported event: ${payload.event}`);
      return NextResponse.json({
        success: true,
        action: 'skipped',
        message: `Unsupported event: ${payload.event}`,
      });
    }

    // Deduplication check
    const eventKey = generateEventKey(
      payload.event,
      payload.meta.id,
      payload.meta.timestamp
    );

    if (processedEvents.has(eventKey)) {
      console.log(`[Pipedrive Webhook] Duplicate event skipped: ${eventKey}`);
      return NextResponse.json({
        success: true,
        action: 'skipped',
        message: 'Duplicate event',
      });
    }

    // Mark as processing
    processedEvents.set(eventKey, Date.now());

    // Process the event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await pipedriveWebhookService.processEvent(payload as any);

    const duration = Date.now() - startTime;
    console.log(
      `[Pipedrive Webhook] Processed ${payload.event} in ${duration}ms: ${result.action}`
    );

    // Update sync log with result
    if (!result.success) {
      await db.from('pipedrive_sync_log').insert({
        event_type: 'webhook',
        direction: 'inbound',
        entity_type: payload.meta.object,
        entity_id: String(payload.meta.id),
        pipedrive_id: payload.meta.id,
        payload: payload as unknown as Record<string, unknown>,
        status: 'failed',
        error_message: result.message,
      });
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
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
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
