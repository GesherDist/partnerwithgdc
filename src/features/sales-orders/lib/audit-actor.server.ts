/**
 * Registers the signed-in user as the audit actor of allocation changes
 * (Nov 12 2026, see audit-actor.ts). Imported only by server-actions modules
 * ('use server'), so the auth code (next/headers) stays out of client bundles.
 */

import { getCurrentUser } from '@/shared/lib/auth';
import { setAuditActorResolver } from './audit-actor';

setAuditActorResolver(async () => {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return { id: user.id, email: user.email ?? undefined, name: name || undefined };
});
