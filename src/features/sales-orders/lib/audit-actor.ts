/**
 * Who made an allocation change, for the audit log (Nov 12 2026).
 *
 * The allocation repository is also imported (through sales-order.service and
 * invoice.service) by client components, so it must not import the auth code
 * (check-permission uses next/headers, which breaks the client build).
 * Instead, the server actions that change allocations register how to find
 * the signed-in user here, and the repository only asks this module.
 *
 * No user registered (for example a script): the entry is logged without user.
 */

export interface AuditActor {
  id: string;
  email?: string;
  name?: string;
}

type ActorResolver = () => Promise<AuditActor | null>;

let resolver: ActorResolver | null = null;

/** Called once by each server-actions module that changes allocations */
export function setAuditActorResolver(fn: ActorResolver): void {
  resolver = fn;
}

/** The signed-in user, or null; never throws */
export async function currentAuditActor(): Promise<AuditActor | null> {
  try {
    return resolver ? await resolver() : null;
  } catch {
    return null;
  }
}
