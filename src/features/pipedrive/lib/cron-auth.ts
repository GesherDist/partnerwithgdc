/**
 * Shared authentication for Pipedrive cron endpoints.
 *
 * Requires `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it; any
 * other scheduler, e.g. AWS EventBridge, must send the same header).
 * Fails closed: without CRON_SECRET configured every request is rejected.
 */

import { timingSafeEqual, createHash } from 'crypto';
import type { NextRequest } from 'next/server';

export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(token), digest(secret));
}
