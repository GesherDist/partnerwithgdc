/**
 * Pipedrive Webhook Verification
 *
 * Utilities for verifying Pipedrive webhook signatures and payloads.
 * Pipedrive uses HTTP Basic Auth for webhook authentication.
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

// ============================================
// VERIFICATION FUNCTIONS
// ============================================

/**
 * Verify Pipedrive webhook request using Basic Auth
 *
 * Pipedrive webhooks use HTTP Basic Authentication.
 * The username and password are configured when setting up the webhook in Pipedrive.
 */
export function verifyWebhookAuth(
  authHeader: string | null,
  expectedUsername: string,
  expectedPassword: string
): WebhookVerificationResult {
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  // Check if it's Basic auth
  if (!authHeader.startsWith('Basic ')) {
    return { valid: false, error: 'Invalid Authorization type' };
  }

  try {
    // Decode Base64 credentials
    const base64Credentials = authHeader.slice(6); // Remove 'Basic '
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');

    // Split on the first ':' only - passwords may contain ':'
    const separatorIndex = credentials.indexOf(':');
    if (separatorIndex === -1) {
      return { valid: false, error: 'Invalid credentials' };
    }
    const username = credentials.slice(0, separatorIndex);
    const password = credentials.slice(separatorIndex + 1);

    // Compare both parts in constant time (no short-circuit between them)
    const usernameMatches = safeEqual(username, expectedUsername);
    const passwordMatches = safeEqual(password, expectedPassword);

    if (usernameMatches && passwordMatches) {
      return { valid: true };
    }

    return { valid: false, error: 'Invalid credentials' };
  } catch {
    return { valid: false, error: 'Failed to decode credentials' };
  }
}

/**
 * Constant-time string comparison. Hashing first gives equal-length buffers,
 * so the comparison does not leak the expected value's length either.
 */
function safeEqual(actual: string, expected: string): boolean {
  const actualHash = createHash('sha256').update(actual, 'utf8').digest();
  const expectedHash = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(actualHash, expectedHash);
}

/**
 * Verify webhook signature using HMAC-SHA256
 *
 * Some Pipedrive webhook configurations use HMAC signatures.
 * The signature is passed in the X-Pipedrive-Signature header.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): WebhookVerificationResult {
  if (!signature) {
    return { valid: false, error: 'Missing signature header' };
  }

  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: 'Signature length mismatch' };
    }

    let result = 0;
    for (let i = 0; i < signatureBuffer.length; i++) {
      result |= signatureBuffer[i]! ^ expectedBuffer[i]!;
    }

    if (result === 0) {
      return { valid: true };
    }

    return { valid: false, error: 'Invalid signature' };
  } catch (error) {
    return { valid: false, error: 'Signature verification failed' };
  }
}

/**
 * Parse and validate webhook payload
 */
export function parseWebhookPayload<T>(
  body: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(body) as T;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Invalid JSON payload' };
  }
}

/**
 * Check if webhook event is a duplicate (idempotency)
 *
 * Uses the event ID or timestamp to detect duplicate events.
 */
export function generateEventKey(
  eventType: string,
  entityId: string | number,
  timestamp: string | number
): string {
  return `pipedrive:${eventType}:${entityId}:${timestamp}`;
}

// ============================================
// WEBHOOK EVENT TYPES
// ============================================

export type PipedriveWebhookEvent =
  | 'added.person'
  | 'updated.person'
  | 'deleted.person'
  | 'merged.person'
  | 'added.deal'
  | 'updated.deal'
  | 'deleted.deal'
  | 'merged.deal'
  | 'added.organization'
  | 'updated.organization'
  | 'deleted.organization'
  | 'added.note'
  | 'updated.note'
  | 'deleted.note'
  | 'added.activity'
  | 'updated.activity'
  | 'deleted.activity';

/**
 * Check if event type is supported
 */
export function isSupportedEvent(event: string): event is PipedriveWebhookEvent {
  const supportedEvents: PipedriveWebhookEvent[] = [
    'added.person',
    'updated.person',
    'deleted.person',
    'added.deal',
    'updated.deal',
    'deleted.deal',
    'added.note',
    'updated.note',
    'added.activity',
    'updated.activity',
  ];
  return supportedEvents.includes(event as PipedriveWebhookEvent);
}

// ============================================
// ENVIRONMENT CONFIG
// ============================================

export function getWebhookConfig() {
  return {
    username: process.env.PIPEDRIVE_WEBHOOK_USERNAME || 'gesher',
    password: process.env.PIPEDRIVE_WEBHOOK_PASSWORD || '',
    secret: process.env.PIPEDRIVE_WEBHOOK_SECRET || '',
  };
}

/**
 * Webhook auth is mandatory: without a password every request is rejected.
 * (Pipedrive webhooks authenticate with HTTP Basic Auth; they do not sign payloads.)
 */
export function isWebhookAuthConfigured(config: ReturnType<typeof getWebhookConfig>): boolean {
  return config.username.length > 0 && config.password.length > 0;
}

/**
 * Pick the most precise timestamp Pipedrive sends, so two different changes to
 * the same record within one second are not treated as duplicates. Redeliveries
 * of the same event carry the same value.
 */
export function getEventTimestamp(meta: {
  timestamp?: number | string;
  timestamp_micro?: number | string;
}): string | number {
  return meta.timestamp_micro ?? meta.timestamp ?? 'unknown';
}

// ============================================
// WEBHOOK VERSION NORMALIZATION
// ============================================

const V2_ACTIONS: Record<string, string> = {
  create: 'added',
  change: 'updated',
  delete: 'deleted',
};

/**
 * Convert a Pipedrive webhooks v2 payload ({ meta: { action, entity, entity_id,
 * id }, data, previous }) into the v1 shape the handlers use ({ event: 'updated.deal',
 * meta: { action, object, id }, current, previous }). v1 payloads pass through.
 *
 * The v2 event id (meta.id, stable across redeliveries) becomes timestamp_micro
 * so deduplication keys stay unique per event.
 */
export function normalizeWebhookPayload<T>(raw: T): T {
  const payload = raw as unknown as {
    event?: string;
    meta?: Record<string, unknown>;
    data?: unknown;
    previous?: unknown;
  };
  const meta = payload.meta ?? {};
  const isV2 = meta.version === '2.0' || (typeof meta.entity === 'string' && 'data' in payload);
  if (!isV2) {
    return raw;
  }

  const action = V2_ACTIONS[String(meta.action)] ?? String(meta.action ?? '');
  const object = String(meta.entity ?? '');
  const entityId = Number(meta.entity_id);

  return {
    v: 2,
    event: `${action}.${object}`,
    meta: {
      ...meta,
      action,
      object,
      id: Number.isFinite(entityId) ? entityId : meta.entity_id,
      timestamp: meta.timestamp,
      timestamp_micro: meta.id ?? meta.timestamp,
    },
    // Deletes carry the removed record in `previous`
    current: payload.data ?? (action === 'deleted' ? payload.previous : undefined),
    previous: payload.previous ?? undefined,
  } as unknown as T;
}
