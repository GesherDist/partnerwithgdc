/**
 * Pipedrive Webhook Verification
 *
 * Utilities for verifying Pipedrive webhook signatures and payloads.
 * Pipedrive uses HTTP Basic Auth for webhook authentication.
 */

import { createHmac } from 'crypto';

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
    const [username, password] = credentials.split(':');

    // Compare credentials
    if (username === expectedUsername && password === expectedPassword) {
      return { valid: true };
    }

    return { valid: false, error: 'Invalid credentials' };
  } catch (error) {
    return { valid: false, error: 'Failed to decode credentials' };
  }
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
