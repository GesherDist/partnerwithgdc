'use server';

/**
 * Products ↔ QuickBooks items — server actions (Settings > QuickBooks)
 *
 * Links each ERP product to its QuickBooks item (Products and Services) so an
 * invoice push uses that item and its accounts (e.g. 38" Tire → 4100 Sales
 * Revenue - Product / 5000 Cost of Goods Sold - Product / Inventory Asset).
 *
 * QuickBooks is only read. Linking saves the item id and the item's account
 * ids on the product (products.qbo_item_id, qbo_income_account,
 * qbo_expense_account, qbo_inventory_asset_account; migrations 041 + 084).
 * qbo_realm_id is left empty on purpose: with it set, a manual product
 * re-sync would update the item in QuickBooks; without it the re-sync only
 * finds the existing item by name.
 *
 * Matching: exact product name (QuickBooks items share SKUs, e.g. a tire and
 * its Direct version, so SKU is not used). A product is linked only when one
 * active item has the same name and the same item type, and the product is
 * not linked yet.
 *
 * View: settings.view_module. Link / unlink: settings.edit.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/shared/lib/supabase/database';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { auditService } from '@/shared/lib/audit/audit-service';
import { getConnectionByProvider } from '@/modules/integrations/core';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks/quickbooks.provider';

// ============================================
// TYPES
// ============================================

export type ItemLinkStatus = 'linked' | 'match' | 'type_mismatch' | 'ambiguous' | 'no_match' | 'stale';

export interface QboItemSummary {
  id: string;
  name: string;
  type: 'inventory' | 'service' | 'non_inventory';
  sku: string | null;
  incomeAccount: string | null;
  expenseAccount: string | null;
  assetAccount: string | null;
}

export interface ProductItemLink {
  productId: string;
  name: string;
  sku: string;
  itemType: string;
  status: ItemLinkStatus;
  /** The linked item, or the matching item to link */
  item: QboItemSummary | null;
  message: string | null;
}

export interface ProductItemLinksView {
  connected: boolean;
  environment: string | null;
  links: ProductItemLink[];
  /** Active QuickBooks items no product points to */
  unusedItems: QboItemSummary[];
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

interface AccountRef {
  value: string;
  name?: string;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  item_type: string;
  qbo_item_id: string | null;
}

interface QboItem extends QboItemSummary {
  incomeAccountId: string | null;
  expenseAccountId: string | null;
  assetAccountId: string | null;
}

// ============================================
// HELPERS
// ============================================

async function authorize(permission: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, error: 'Authentication required' };
  }
  if (!hasPermission(user, permission)) {
    return { ok: false as const, error: `Permission denied: ${permission}` };
  }
  return { ok: true as const, user };
}

async function activeQuickBooks() {
  const connection = await getConnectionByProvider('quickbooks');
  if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
    return null;
  }
  const metadata = (connection.metadata ?? {}) as { environment?: string };
  return { connectionId: connection.id, environment: metadata.environment ?? null };
}

/** Same name in both systems: case, spacing and curly quotes ignored */
const normalizeName = (name: string) =>
  name
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const ref = (value: unknown) => (value && typeof value === 'object' ? (value as AccountRef) : null);

/** Active QuickBooks items (read only) */
async function loadQboItems(connectionId: string): Promise<QboItem[]> {
  const items: QboItem[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const page = await quickBooksProvider.getProducts(connectionId, { limit: pageSize, offset });
    for (const p of page) {
      if (!p.externalId || p.active === false) {
        continue;
      }
      const income = ref(p.metadata?.incomeAccount);
      const expense = ref(p.metadata?.expenseAccount);
      const asset = ref(p.metadata?.assetAccount);
      items.push({
        id: p.externalId,
        name: p.name,
        type: p.type ?? 'non_inventory',
        sku: p.sku ?? null,
        incomeAccount: income?.name ?? income?.value ?? null,
        expenseAccount: expense?.name ?? expense?.value ?? null,
        assetAccount: asset?.name ?? asset?.value ?? null,
        incomeAccountId: income?.value ?? null,
        expenseAccountId: expense?.value ?? null,
        assetAccountId: asset?.value ?? null,
      });
    }
    if (page.length < pageSize) {
      break;
    }
  }
  return items;
}

const summary = (item: QboItem): QboItemSummary => ({
  id: item.id,
  name: item.name,
  type: item.type,
  sku: item.sku,
  incomeAccount: item.incomeAccount,
  expenseAccount: item.expenseAccount,
  assetAccount: item.assetAccount,
});

async function buildLinks(connectionId: string): Promise<{ links: ProductItemLink[]; items: QboItem[]; unusedItems: QboItemSummary[] }> {
  const [items, productsRes] = await Promise.all([
    loadQboItems(connectionId),
    db.from('products').select('id, name, sku, item_type, qbo_item_id').is('deleted_at', null).order('name', { ascending: true }),
  ]);
  if (productsRes.error) {
    throw new Error(`Failed to load products: ${productsRes.error.message}`);
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const byName = new Map<string, QboItem[]>();
  for (const item of items) {
    const key = normalizeName(item.name);
    byName.set(key, [...(byName.get(key) ?? []), item]);
  }

  const used = new Set<string>();
  const links = ((productsRes.data ?? []) as ProductRow[]).map((p): ProductItemLink => {
    const base = { productId: p.id, name: p.name, sku: p.sku, itemType: p.item_type };
    if (p.qbo_item_id) {
      const linked = byId.get(p.qbo_item_id);
      if (linked) {
        used.add(linked.id);
        return { ...base, status: 'linked', item: summary(linked), message: null };
      }
      return { ...base, status: 'stale', item: null, message: `Linked to QuickBooks item ${p.qbo_item_id}, which is not an active item` };
    }
    const candidates = byName.get(normalizeName(p.name)) ?? [];
    if (candidates.length === 0) {
      return { ...base, status: 'no_match', item: null, message: 'No QuickBooks item with this name' };
    }
    if (candidates.length > 1) {
      return { ...base, status: 'ambiguous', item: null, message: `${candidates.length} QuickBooks items have this name` };
    }
    const item = candidates[0]!;
    used.add(item.id);
    if (item.type !== p.item_type) {
      return { ...base, status: 'type_mismatch', item: summary(item), message: `Type differs: ERP ${p.item_type}, QuickBooks ${item.type}` };
    }
    return { ...base, status: 'match', item: summary(item), message: null };
  });

  return { links, items, unusedItems: items.filter((i) => !used.has(i.id)).map(summary) };
}

// ============================================
// PREVIEW (read only)
// ============================================

export async function getProductItemLinks(): Promise<Result<ProductItemLinksView>> {
  const auth = await authorize('settings.view_module');
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const qbo = await activeQuickBooks();
  if (!qbo) {
    return { success: true, data: { connected: false, environment: null, links: [], unusedItems: [] } };
  }
  try {
    const { links, unusedItems } = await buildLinks(qbo.connectionId);
    return { success: true, data: { connected: true, environment: qbo.environment, links, unusedItems } };
  } catch (error) {
    console.error('[ProductItemLinks] Preview failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to read QuickBooks items' };
  }
}

// ============================================
// LINK (writes the products' QuickBooks columns only)
// ============================================

export async function linkProductsToQboItems(productIds: string[]): Promise<Result<{ linked: number; skipped: string[] }>> {
  const auth = await authorize('settings.edit');
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const qbo = await activeQuickBooks();
  if (!qbo) {
    return { success: false, error: 'QuickBooks is not connected' };
  }

  let built: Awaited<ReturnType<typeof buildLinks>>;
  try {
    built = await buildLinks(qbo.connectionId);
  } catch (error) {
    console.error('[ProductItemLinks] Link failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to read QuickBooks items' };
  }

  const wanted = new Set(productIds);
  const itemById = new Map(built.items.map((i) => [i.id, i]));
  const skipped: string[] = [];
  let linked = 0;

  for (const link of built.links.filter((l) => wanted.has(l.productId))) {
    const item = link.item ? itemById.get(link.item.id) : undefined;
    // Re-checked on the server: only a clear match is linked
    if (link.status !== 'match' || !item) {
      skipped.push(`${link.name}: ${link.message ?? link.status}`);
      continue;
    }
    const { data, error } = await db
      .from('products')
      .update({
        qbo_item_id: item.id,
        qbo_income_account: item.incomeAccountId,
        qbo_expense_account: item.expenseAccountId,
        qbo_inventory_asset_account: item.assetAccountId,
        qbo_synced_at: new Date().toISOString(),
        qbo_sync_error: null,
      })
      .eq('id', link.productId)
      .is('qbo_item_id', null) // never overwrite an existing link
      .select('id');
    if (error || !data?.length) {
      skipped.push(`${link.name}: ${error?.message ?? 'already linked'}`);
      continue;
    }
    linked++;
    auditService
      .log({
        action: 'update',
        module: 'products',
        entityType: 'Product',
        entityId: link.productId,
        oldData: { qbo_item_id: null },
        newData: { qbo_item_id: item.id, qbo_item_name: item.name, income: item.incomeAccount, expense: item.expenseAccount, asset: item.assetAccount },
        userId: auth.user.id,
      })
      .catch((err: unknown) => console.error('[ProductItemLinks] Audit log failed:', err));
  }

  revalidatePath('/settings');
  revalidatePath('/products');
  return { success: true, data: { linked, skipped } };
}

// ============================================
// UNLINK
// ============================================

export async function unlinkProductFromQboItem(productId: string): Promise<Result<null>> {
  const auth = await authorize('settings.edit');
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { data: before } = await db.from('products').select('qbo_item_id').eq('id', productId).maybeSingle();
  const { error } = await db
    .from('products')
    .update({ qbo_item_id: null, qbo_income_account: null, qbo_expense_account: null, qbo_inventory_asset_account: null, qbo_synced_at: null })
    .eq('id', productId);
  if (error) {
    return { success: false, error: error.message };
  }
  auditService
    .log({
      action: 'update',
      module: 'products',
      entityType: 'Product',
      entityId: productId,
      oldData: { qbo_item_id: before?.qbo_item_id ?? null },
      newData: { qbo_item_id: null },
      userId: auth.user.id,
    })
    .catch((err: unknown) => console.error('[ProductItemLinks] Audit log failed:', err));
  revalidatePath('/settings');
  revalidatePath('/products');
  return { success: true, data: null };
}
