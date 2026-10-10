/**
 * Pipedrive Webhook Deduplication
 *
 * Pipedrive redelivers webhooks on timeouts and errors. Event keys are claimed
 * in the pipedrive_webhook_events table (primary key = event key), which works
 * across serverless instances.
 *
 * Lifecycle (migration 153 adds status/claimed_at):
 * - claim    -> row inserted with status 'processing'
 * - success  -> status 'done'; later deliveries are duplicates
 * - failure  -> row deleted, so a redelivery is processed again
 * - crash    -> row stays 'processing'; once older than STALE_CLAIM_MS a
 *               redelivery may take it over instead of being skipped forever
 *
 * If the table is unavailable, falls back to a per-instance in-memory cache.
 */

import { db } from '@/shared/lib/supabase/database';

const TABLE = 'pipedrive_webhook_events';
const UNIQUE_VIOLATION = '23505';
const RETENTION_DAYS = 30;
const MEMORY_WINDOW_MS = 5 * 60 * 1000;

/** A 'processing' claim older than this is assumed abandoned (crash/timeout) */
export const STALE_CLAIM_MS = 5 * 60 * 1000;

// Per-instance fallback, used only when the table cannot be reached
const memoryCache = new Map<string, number>();

/**
 * - claimed:     process the event
 * - duplicate:   already processed successfully; acknowledge and skip
 * - in_progress: another delivery is processing it right now; ask Pipedrive to retry later
 */
export type ClaimResult = 'claimed' | 'duplicate' | 'in_progress';

interface ExistingClaim {
  status: string | null;
  claimed_at: string | null;
}

/**
 * Claim an event key before processing it.
 */
export async function claimWebhookEvent(
  eventKey: string,
  event: string,
  pipedriveId: number | null,
  now: number = Date.now()
): Promise<ClaimResult> {
  const claimedAt = new Date(now).toISOString();
  const { error } = await db.from(TABLE).insert({
    event_key: eventKey,
    event,
    pipedrive_id: pipedriveId,
    status: 'processing',
    claimed_at: claimedAt,
  });

  if (!error) {
    pruneOldEvents();
    return 'claimed';
  }

  if (error.code !== UNIQUE_VIOLATION) {
    console.error('[Pipedrive Webhook] Dedup table unavailable, using in-memory fallback:', error.message);
    return claimInMemory(eventKey, now);
  }

  // Key already exists - decide between duplicate, in-progress and stale takeover
  const { data: existing, error: readError } = await db
    .from(TABLE)
    .select('status, claimed_at')
    .eq('event_key', eventKey)
    .maybeSingle();

  if (readError || !existing) {
    // Row vanished (released between our insert and read) or read failed: let Pipedrive retry
    return 'in_progress';
  }

  return resolveExistingClaim(eventKey, existing as ExistingClaim, now);
}

async function resolveExistingClaim(
  eventKey: string,
  existing: ExistingClaim,
  now: number
): Promise<ClaimResult> {
  if (existing.status !== 'processing') {
    // 'done' (or legacy rows without status) - already handled
    return 'duplicate';
  }

  const claimedAtMs = existing.claimed_at ? Date.parse(existing.claimed_at) : NaN;
  if (Number.isFinite(claimedAtMs) && now - claimedAtMs < STALE_CLAIM_MS) {
    return 'in_progress';
  }

  // Stale claim: take it over atomically. Matching on the old claimed_at means
  // only one of several concurrent redeliveries can win.
  let takeover = db
    .from(TABLE)
    .update({ claimed_at: new Date(now).toISOString() })
    .eq('event_key', eventKey)
    .eq('status', 'processing');
  takeover = existing.claimed_at
    ? takeover.eq('claimed_at', existing.claimed_at)
    : takeover.is('claimed_at', null);

  const { data: updated, error } = await takeover.select('event_key');

  if (error) {
    console.error('[Pipedrive Webhook] Failed to take over stale event claim:', error.message);
    return 'in_progress';
  }

  if ((updated?.length ?? 0) > 0) {
    console.warn(`[Pipedrive Webhook] Reprocessing event left unfinished by an earlier delivery: ${eventKey}`);
    return 'claimed';
  }

  return 'in_progress';
}

/**
 * Mark a claimed event as successfully processed.
 */
export async function completeWebhookEvent(eventKey: string): Promise<void> {
  const { error } = await db
    .from(TABLE)
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('event_key', eventKey);

  if (error) {
    console.error('[Pipedrive Webhook] Failed to mark event as done:', error.message);
  }
}

/**
 * Release a claimed key after a failed processing attempt, so Pipedrive's
 * redelivery of the same event is processed instead of skipped.
 */
export async function releaseWebhookEvent(eventKey: string): Promise<void> {
  memoryCache.delete(eventKey);

  const { error } = await db.from(TABLE).delete().eq('event_key', eventKey);
  if (error) {
    console.error('[Pipedrive Webhook] Failed to release event key:', error.message);
  }
}

function claimInMemory(eventKey: string, now: number): ClaimResult {
  for (const [key, timestamp] of memoryCache) {
    if (now - timestamp > MEMORY_WINDOW_MS) {
      memoryCache.delete(key);
    }
  }

  if (memoryCache.has(eventKey)) {
    return 'duplicate';
  }

  memoryCache.set(eventKey, now);
  return 'claimed';
}

/**
 * Occasionally delete old keys so the table stays small. Fire-and-forget:
 * a failed prune has no effect on webhook handling.
 */
function pruneOldEvents(): void {
  if (Math.random() > 0.01) {
    return;
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  void db
    .from(TABLE)
    .delete()
    .lt('received_at', cutoff)
    .then(({ error }) => {
      if (error) {
        console.error('[Pipedrive Webhook] Failed to prune old event keys:', error.message);
      }
    });
}
