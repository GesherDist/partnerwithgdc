/**
 * ERP products -> Pipedrive product catalog (one way), on every product change.
 *
 * Every active ERP product is in the catalog (any size or type), as "Apply
 * setup" adds them. The Pipedrive product code is the ERP SKU, which is how a
 * won deal's products map back to ERP lines (deal-erp.service).
 *
 * - Created / edited in the ERP: name, code (SKU) and USD price are written
 *   when they differ. Other currencies and costs set in Pipedrive are kept.
 * - SKU changed: the Pipedrive product is found by the old SKU and its code
 *   updated, so it stays one product.
 * - Inactive, discontinued or deleted: the Pipedrive product is made
 *   non-linkable (reps can no longer add it to deals); it is not deleted, so
 *   existing deals keep their lines. Restored / active again: linkable again.
 *
 * Reps still set the price per deal; the catalog price is the default.
 */

import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import type { Product } from '@/features/products/types';
import { runPipedriveRequest, runPipedriveWrite } from '../lib/rate-limiter';
import { getActivePipedriveConnectionId } from './settings';

export interface ProductSyncResult {
  status: 'created' | 'updated' | 'unchanged' | 'skipped' | 'conflict' | 'not_connected';
  message: string;
  pipedriveProductId?: number;
}

interface PipedrivePrice {
  currency?: string;
  price?: number | null;
  cost?: number | null;
  direct_cost?: number | null;
  notes?: string | null;
}

interface PipedriveProduct {
  id: number;
  name?: string;
  code?: string | null;
  prices?: PipedrivePrice[];
  is_linkable?: boolean;
  is_deleted?: boolean;
}

/** Product fields this sync reads */
export type CatalogProduct = Pick<Product, 'sku' | 'name' | 'basePrice' | 'status' | 'deletedAt'>;

/** In the Pipedrive catalog (linkable to deals): active and not deleted */
export function isCatalogProduct(product: Pick<Product, 'sku' | 'status' | 'deletedAt'>): boolean {
  return product.status === 'active' && !product.deletedAt && Boolean(product.sku?.trim());
}

/** ERP base price is in cents; Pipedrive prices are in dollars */
const toDollars = (cents: number) => Math.round(cents) / 100;

/** Prices to write (USD replaced, other currencies kept), or null when USD already matches */
function pricesToWrite(product: CatalogProduct, current: PipedrivePrice[] | undefined): PipedrivePrice[] | null {
  const price = toDollars(product.basePrice ?? 0);
  const list = current ?? [];
  const usd = list.find((p) => p.currency === 'USD');
  if (usd && Math.round(Number(usd.price ?? 0) * 100) === Math.round(product.basePrice ?? 0)) {
    return null;
  }
  const keep = (p: PipedrivePrice): PipedrivePrice => ({
    currency: p.currency,
    price: p.price ?? 0,
    ...(p.cost !== undefined && p.cost !== null ? { cost: p.cost } : {}),
    ...(p.direct_cost !== undefined && p.direct_cost !== null ? { direct_cost: p.direct_cost } : {}),
    ...(p.notes ? { notes: p.notes } : {}),
  });
  return [
    ...list.filter((p) => p.currency && p.currency !== 'USD').map(keep),
    { ...(usd ? keep(usd) : { currency: 'USD' }), price },
  ];
}

/**
 * Bring the Pipedrive catalog product of one ERP product up to date.
 * `previousSku`: the SKU before this change, when it changed.
 */
export async function syncProductToPipedrive(product: CatalogProduct, previousSku?: string | null): Promise<ProductSyncResult> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    return { status: 'not_connected', message: 'Pipedrive is not connected' };
  }
  const sku = product.sku.trim();
  const inCatalog = isCatalogProduct(product);

  const listed = await pipedriveProvider.fetchAllV2<PipedriveProduct>(connectionId, 'products', undefined, runPipedriveRequest);
  const live = listed.items.filter((p) => !p.is_deleted);
  const byCode = (code: string) => live.filter((p) => p.code?.trim() === code);

  let matches = byCode(sku);
  if (matches.length === 0 && previousSku && previousSku.trim() !== sku) {
    matches = byCode(previousSku.trim());
  }
  if (matches.length > 1) {
    return { status: 'conflict', message: `${matches.length} Pipedrive products have code ${matches[0]!.code}; keep one` };
  }
  const target = matches[0];

  if (!target) {
    if (!inCatalog) {
      return { status: 'skipped', message: `${sku} is not active; not added to Pipedrive` };
    }
    if (!listed.complete) {
      return { status: 'skipped', message: 'Pipedrive product list incomplete; not created to avoid a duplicate' };
    }
    const created = await runPipedriveWrite(() =>
      pipedriveProvider.request<PipedriveProduct>(connectionId, 'POST', 'products', {
        name: product.name || sku,
        code: sku,
        prices: [{ currency: 'USD', price: toDollars(product.basePrice ?? 0) }],
      })
    );
    return { status: 'created', message: `Pipedrive product ${sku} created`, pipedriveProductId: created.data?.id };
  }

  const body: Record<string, unknown> = {};
  if (inCatalog) {
    const name = product.name || sku;
    if ((target.name ?? '').trim() !== name.trim()) {body.name = name;}
    if (target.code?.trim() !== sku) {body.code = sku;}
    const prices = pricesToWrite(product, target.prices);
    if (prices) {body.prices = prices;}
    if (target.is_linkable === false) {body.is_linkable = true;}
  } else if (target.is_linkable !== false) {
    // Out of the catalog: reps can no longer add it; existing deals keep it
    body.is_linkable = false;
  }

  if (Object.keys(body).length === 0) {
    return { status: 'unchanged', message: `Pipedrive product ${sku} already up to date`, pipedriveProductId: target.id };
  }
  await runPipedriveWrite(() =>
    pipedriveProvider.request<PipedriveProduct>(connectionId, 'PATCH', `products/${target.id}`, body)
  );
  return {
    status: 'updated',
    message: `Pipedrive product ${sku} updated: ${Object.keys(body).join(', ')}`,
    pipedriveProductId: target.id,
  };
}
