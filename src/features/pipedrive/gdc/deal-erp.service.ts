/**
 * Pipedrive deals <-> Gesher ERP.
 *
 * Won deal -> ERP quote:
 *   When a GDC deal transitions to Won, Gesher creates ONE draft quote from the
 *   deal's products (24s/38s, quantities, prices, discounts) for the ERP
 *   customer linked to the deal's organization, and submits it for approval.
 *   The existing ERP workflow then applies: quote approval, customer PO, credit
 *   check / hold and permissions for converting the quote to a sales order.
 *   Gesher never inserts sales orders directly here.
 *
 * Stage milestone: the deal moves to "Won – Order Placed" only after the ERP
 * quote exists (the order has been entered into the ERP). When the quote
 * cannot be created, the deal stays in its stage and a note explains why.
 *
 * Sales order -> Pipedrive:
 *   When that quote is converted, the ERP sales order number is written to the
 *   deal's "ERP Sales Order #" field. Failed write-backs are retried by
 *   reconcileSalesOrderWriteBacks (daily cron) or manually from the quote.
 *
 * Idempotency: the quote is inserted already linked to the deal
 * (quotes.pipedrive_deal_id, unique among live quotes, migration 155), so a
 * retry, a duplicate webhook or a concurrent run can never leave a second or
 * an unlinked quote behind. Notes are added to the deal only once.
 */

import { db } from '@/shared/lib/supabase/database';
import { pipedriveProvider, isPipedriveNotFound } from '@/modules/integrations/providers/crm/pipedrive';
import { quoteService } from '@/features/quotes/services/quote.service';
import type { CreateQuoteInput } from '@/features/quotes/lib/schemas';
import { calculateLineTotal } from '@/features/quotes/lib/schemas';
import { runPipedriveRequest, runPipedriveWrite } from '../lib/rate-limiter';
import { ERP_NOTE_MARKER, GDC_STAGE_ORDER, GDC_STAGES, type GdcStageKey } from './config';
import { getGdcConfig } from './setup.service';
import { getActivePipedriveConnectionId, type GdcResolvedConfig } from './settings';
import { classifyTireSize } from './purchase-history.service';
import { isMissingColumnError, MigrationRequiredError } from './schema-guard';

/** Marks quotes created by this integration (only these are auto-submitted) */
export const WON_DEAL_QUOTE_MARKER = 'Created from Pipedrive deal #';

// ============================================
// TYPES
// ============================================

export type WonDealStatus =
  | 'quote_created'
  | 'already_processed'
  | 'incomplete_quote'
  | 'not_won'
  | 'not_gdc_pipeline'
  | 'customer_not_linked'
  | 'customer_ambiguous'
  | 'no_products'
  | 'invalid_products'
  | 'unmapped_products'
  | 'currency_mismatch'
  | 'quote_failed'
  | 'migration_required'
  | 'not_connected';

export interface WonDealResult {
  status: WonDealStatus;
  message: string;
  quoteId?: string;
  quoteNumber?: string;
}

interface DealRecord {
  id: number;
  status: string;
  pipelineId: number | null;
  stageId: number | null;
  orgId: number | null;
  ownerId: number | null;
  currency: string | null;
  value: number | null;
  title: string;
  customFields: Record<string, unknown>;
}

export interface DealProductLine {
  productId: number;
  name: string;
  /** Whole units */
  quantity: number;
  /** ERP unit price in cents (before the line discount) */
  unitPriceCents: number;
  /** ERP line discount percent (0-100, 2 decimals) */
  discountPercent: number;
  /** Net line total in cents, as Pipedrive calculates it (discount applied, no tax) */
  lineTotalCents: number;
}

export interface ParsedDealProducts {
  lines: DealProductLine[];
  /** Lines that cannot be converted exactly; the quote is not created while any exist */
  issues: string[];
}

// ============================================
// PARSING
// ============================================

function toId(value: unknown): number | null {
  const raw = value && typeof value === 'object' ? (value as { value?: unknown }).value : value;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {return null;}
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export function parseDeal(raw: unknown): DealRecord | null {
  const r = raw as Record<string, unknown> | null;
  const id = toId(r?.id);
  if (!r || id === null) {return null;}
  return {
    id,
    status: String(r.status ?? ''),
    pipelineId: toId(r.pipeline_id),
    stageId: toId(r.stage_id),
    orgId: toId(r.org_id),
    ownerId: toId(r.owner_id ?? r.user_id),
    currency: typeof r.currency === 'string' ? r.currency : null,
    value: toNumber(r.value),
    title: String(r.title ?? ''),
    customFields: (r.custom_fields as Record<string, unknown>) ?? {},
  };
}

/**
 * Convert Pipedrive deal products into ERP quote lines.
 *
 * - Quantities must be whole units (fractional quantities are rejected, never rounded).
 * - Discounts are kept as an ERP line discount percent (ERP calculates
 *   line total = qty x unit price - round(subtotal x discount%)).
 *   Percentage discounts map directly; amount discounts are converted and must
 *   reproduce Pipedrive's line total to the cent, otherwise the net unit price
 *   is used when it is a whole number of cents, otherwise the line is rejected.
 * - Lines with tax are rejected: ERP quotes from Pipedrive are created without
 *   tax and finance applies the ERP tax rules.
 * - When Pipedrive returns `sum`, it must equal the calculated net line total.
 * - Disabled lines (is_enabled: false) are ignored.
 */
export function parseDealProducts(data: unknown): ParsedDealProducts {
  const lines: DealProductLine[] = [];
  const issues: string[] = [];

  for (const raw of Array.isArray(data) ? data : []) {
    const r = raw as Record<string, unknown>;
    if (r.is_enabled === false || r.enabled_flag === false) {continue;}

    const productId = toId(r.product_id);
    const name = String(r.name ?? (productId ? `#${productId}` : 'product'));
    const quantity = toNumber(r.quantity);
    const itemPrice = toNumber(r.item_price);
    if (productId === null) {
      issues.push(`${name}: not linked to a Pipedrive product`);
      continue;
    }
    if (quantity === null || quantity <= 0) {
      issues.push(`${name}: quantity must be greater than zero`);
      continue;
    }
    if (!Number.isInteger(quantity)) {
      issues.push(`${name}: quantity ${quantity} is not a whole number of tires`);
      continue;
    }
    if (itemPrice === null || itemPrice < 0) {
      issues.push(`${name}: unit price is missing`);
      continue;
    }
    const tax = toNumber(r.tax) ?? 0;
    if (tax !== 0) {
      issues.push(`${name}: has ${tax}% tax; remove tax from the deal product (ERP applies tax rules)`);
      continue;
    }

    const unitPriceCents = Math.round(itemPrice * 100);
    if (Math.abs(unitPriceCents - itemPrice * 100) > 1e-6) {
      issues.push(`${name}: unit price ${itemPrice} has fractions of a cent`);
      continue;
    }
    const grossCents = unitPriceCents * quantity;

    // Discount: v2 uses discount + discount_type; older v1 lines use discount_percentage
    const discount = toNumber(r.discount) ?? 0;
    const discountType = typeof r.discount_type === 'string' ? r.discount_type : null;
    const legacyPercent = toNumber(r.discount_percentage);
    let netCents: number;
    let percent: number;
    if (discountType === 'amount') {
      netCents = grossCents - Math.round(discount * 100);
      percent = grossCents > 0 ? Math.round(((grossCents - netCents) / grossCents) * 10000) / 100 : 0;
    } else {
      const pct = discountType === 'percentage' ? discount : (legacyPercent ?? discount);
      percent = Math.round(pct * 100) / 100;
      netCents = grossCents - Math.round(grossCents * (pct / 100));
    }
    if (netCents < 0 || percent < 0 || percent > 100) {
      issues.push(`${name}: discount is larger than the line value`);
      continue;
    }

    // Pipedrive's own line total must agree with ours (detects tax/discount we do not understand)
    const sum = toNumber(r.sum);
    if (sum !== null && Math.abs(Math.round(sum * 100) - netCents) > 1) {
      issues.push(`${name}: Pipedrive line total ${sum} does not match ${quantity} x ${itemPrice} less discount (${netCents / 100})`);
      continue;
    }

    let line: DealProductLine = { productId, name, quantity, unitPriceCents, discountPercent: percent, lineTotalCents: netCents };
    if (calculateLineTotal(quantity, unitPriceCents, percent) !== netCents) {
      // Amount discounts that are not an exact 2-decimal percent: use the net unit price
      if (netCents % quantity === 0) {
        line = { ...line, unitPriceCents: netCents / quantity, discountPercent: 0 };
      } else {
        issues.push(`${name}: discount of ${(grossCents - netCents) / 100} cannot be represented exactly in the ERP; use a percentage discount`);
        continue;
      }
    }
    lines.push(line);
  }
  return { lines, issues };
}

// ============================================
// PIPEDRIVE HELPERS
// ============================================

async function getDeal(connectionId: string, dealId: number): Promise<DealRecord | null> {
  try {
    const response = await runPipedriveRequest(() =>
      pipedriveProvider.request<unknown>(connectionId, 'GET', `deals/${dealId}`)
    );
    return parseDeal(response.data);
  } catch (error) {
    if (isPipedriveNotFound(error)) {return null;}
    throw error;
  }
}

async function patchDeal(connectionId: string, dealId: number, body: Record<string, unknown>): Promise<void> {
  await runPipedriveWrite(() => pipedriveProvider.request(connectionId, 'PATCH', `deals/${dealId}`, body));
}

/**
 * Add an integration note to a deal unless the same text is already there
 * (retries and duplicate webhooks must not stack identical notes).
 */
export async function addDealNoteOnce(connectionId: string, dealId: number, text: string): Promise<void> {
  const content = `${ERP_NOTE_MARKER} ${text}`;
  const notes = await pipedriveProvider.fetchAllV1<{ content?: string }>(
    connectionId,
    'notes',
    new URLSearchParams({ deal_id: String(dealId) }),
    runPipedriveRequest
  );
  if (notes.items.some((note) => note.content?.includes(content))) {
    return;
  }
  await runPipedriveWrite(() =>
    pipedriveProvider.request(connectionId, 'POST', 'notes', { content, deal_id: dealId }, 'v1')
  );
}

/**
 * Move a GDC deal forward to `target`. Never moves a deal backwards, never
 * touches deals outside the GDC Sales pipeline. Returns true when moved.
 */
export async function advanceDealStage(
  connectionId: string,
  config: GdcResolvedConfig,
  deal: DealRecord,
  target: GdcStageKey
): Promise<boolean> {
  if (deal.pipelineId !== config.pipelineId || deal.stageId === null) {
    return false;
  }
  const currentKey = GDC_STAGES.find((stage) => config.stageIds[stage.key] === deal.stageId)?.key;
  if (!currentKey || GDC_STAGE_ORDER[currentKey] >= GDC_STAGE_ORDER[target]) {
    return false;
  }
  await patchDeal(connectionId, deal.id, { stage_id: config.stageIds[target] });
  return true;
}

// ============================================
// ERP LOOKUPS
// ============================================

interface LinkedQuote {
  id: string;
  quote_number: string;
  status: string;
  internal_notes: string | null;
}

/**
 * The live ERP quote linked to a Pipedrive deal, if any.
 * Throws MigrationRequiredError when migration 155 has not been applied.
 */
export async function findLiveQuoteForDeal(dealId: number): Promise<LinkedQuote | null> {
  const { data, error } = await db
    .from('quotes')
    .select('id, quote_number, status, internal_notes')
    .eq('pipedrive_deal_id', dealId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error, 'pipedrive_deal_id')) {
      throw new MigrationRequiredError('155', 'quotes.pipedrive_deal_id does not exist');
    }
    throw new Error(`Failed to check quotes for deal ${dealId}: ${error.message}`);
  }
  return data as LinkedQuote | null;
}

async function quoteHasItems(quoteId: string): Promise<boolean> {
  const { data, error } = await db.from('quote_items').select('id').eq('quote_id', quoteId).limit(1);
  if (error) {
    throw new Error(`Failed to load quote items: ${error.message}`);
  }
  return (data ?? []).length > 0;
}

/**
 * Gesher user id of the rep that owns the deal (matched by email), if any.
 */
async function gesherUserForPipedriveUser(connectionId: string, pipedriveUserId: number | null): Promise<string | null> {
  if (!pipedriveUserId) {return null;}
  try {
    const response = await runPipedriveRequest(() =>
      pipedriveProvider.request<{ email?: string }>(connectionId, 'GET', `users/${pipedriveUserId}`, undefined, 'v1')
    );
    const email = response.data?.email;
    if (!email) {return null;}
    const { data } = await db.from('users').select('id').ilike('email', email).is('deleted_at', null).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

// ============================================
// WON DEAL -> ERP QUOTE
// ============================================

/**
 * Bring a deal whose ERP quote already exists to its final state: quote
 * submitted for approval, ERP Quote # on the deal, stage "Won – Order Placed".
 * Every step is idempotent, so this also repairs a run that stopped half way.
 */
async function finalizeExistingQuote(
  connectionId: string,
  config: GdcResolvedConfig,
  deal: DealRecord,
  quote: LinkedQuote
): Promise<WonDealResult> {
  if (!(await quoteHasItems(quote.id))) {
    await addDealNoteOnce(
      connectionId,
      deal.id,
      `ERP quote ${quote.quote_number} has no line items (creation was interrupted). Delete that quote in Gesher, then use "Create ERP quote" again.`
    );
    return {
      status: 'incomplete_quote',
      message: `Quote ${quote.quote_number} has no line items; delete it in Gesher and retry`,
      quoteId: quote.id,
      quoteNumber: quote.quote_number,
    };
  }

  // Only quotes this integration created are submitted automatically; a quote
  // a user created from the deal in Gesher stays under that user's control.
  if (quote.status === 'draft' && quote.internal_notes?.includes(WON_DEAL_QUOTE_MARKER)) {
    await quoteService.submitForApproval(quote.id);
  }

  if (deal.status === 'won' && deal.pipelineId === config.pipelineId) {
    if (deal.customFields[config.fields.deal_erp_quote_number.code] !== quote.quote_number) {
      await patchDeal(connectionId, deal.id, {
        custom_fields: { [config.fields.deal_erp_quote_number.code]: quote.quote_number },
      });
    }
    await advanceDealStage(connectionId, config, deal, 'won_order_placed');
  }

  return {
    status: 'already_processed',
    message: `Quote ${quote.quote_number} already exists for this deal`,
    quoteId: quote.id,
    quoteNumber: quote.quote_number,
  };
}

export async function handleWonDeal(pipedriveDealId: number): Promise<WonDealResult> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    return { status: 'not_connected', message: 'Pipedrive is not connected' };
  }
  const config = await getGdcConfig(connectionId);

  // Idempotency: one live quote per deal (requires migration 155)
  let existingQuote: LinkedQuote | null;
  try {
    existingQuote = await findLiveQuoteForDeal(pipedriveDealId);
  } catch (error) {
    if (error instanceof MigrationRequiredError) {
      // Without the unique link a quote could be duplicated; create nothing
      return { status: 'migration_required', message: error.message };
    }
    throw error;
  }

  const deal = await getDeal(connectionId, pipedriveDealId);
  if (!deal || deal.status !== 'won') {
    return { status: 'not_won', message: 'Deal is not won' };
  }
  if (deal.pipelineId !== config.pipelineId) {
    return { status: 'not_gdc_pipeline', message: 'Deal is not in the GDC Sales pipeline' };
  }
  if (existingQuote) {
    return finalizeExistingQuote(connectionId, config, deal, existingQuote);
  }

  // ERP customer from the deal's organization
  if (!deal.orgId) {
    await addDealNoteOnce(connectionId, deal.id, 'ERP quote not created: the deal has no organization. Add it, then use "Create ERP quote" in Gesher.');
    return { status: 'customer_not_linked', message: 'Deal has no organization' };
  }
  const { data: customers, error: customerError } = await db
    .from('customers')
    .select('id, customer_code, name, address_1, address_2, city, state, zip, country, shipping_address_1, shipping_address_2, shipping_city, shipping_state, shipping_zip, shipping_country, use_separate_shipping')
    .eq('pipedrive_org_id', deal.orgId)
    .is('deleted_at', null);
  if (customerError) {
    throw new Error(`Failed to load customer for organization ${deal.orgId}: ${customerError.message}`);
  }
  if (!customers || customers.length === 0) {
    await addDealNoteOnce(
      connectionId,
      deal.id,
      'ERP quote not created: this organization is not linked to an ERP customer. Link it (customer import or "Sync to Pipedrive" on the customer), then use "Create ERP quote" in Gesher.'
    );
    return { status: 'customer_not_linked', message: 'Organization is not linked to an ERP customer' };
  }
  if (customers.length > 1) {
    await addDealNoteOnce(connectionId, deal.id, 'ERP quote not created: this organization is linked to more than one ERP customer. Fix the links, then use "Create ERP quote" in Gesher.');
    return { status: 'customer_ambiguous', message: 'Organization is linked to more than one ERP customer' };
  }
  const customer = customers[0]!;

  if (deal.currency && deal.currency !== 'USD') {
    await addDealNoteOnce(connectionId, deal.id, `ERP quote not created: deal currency ${deal.currency} is not USD.`);
    return { status: 'currency_mismatch', message: `Deal currency ${deal.currency} is not USD` };
  }

  // Deal products -> ERP lines
  const productsResponse = await runPipedriveRequest(() =>
    pipedriveProvider.request<unknown>(connectionId, 'GET', `deals/${deal.id}/products`)
  );
  const { lines, issues } = parseDealProducts(productsResponse.data);
  if (issues.length > 0) {
    await addDealNoteOnce(connectionId, deal.id, `ERP quote not created: fix these deal products, then use "Create ERP quote" in Gesher: ${issues.join('; ')}.`);
    return { status: 'invalid_products', message: issues.join('; ') };
  }
  if (lines.length === 0) {
    await addDealNoteOnce(connectionId, deal.id, 'ERP quote not created: add the 24s/38s products with quantities and prices to the deal, then use "Create ERP quote" in Gesher.');
    return { status: 'no_products', message: 'Deal has no products' };
  }

  // Pipedrive product code = ERP SKU
  const codes = new Map<number, string>();
  for (const productId of [...new Set(lines.map((line) => line.productId))]) {
    const product = await runPipedriveRequest(() =>
      pipedriveProvider.request<{ code?: string | null }>(connectionId, 'GET', `products/${productId}`)
    );
    if (product.data?.code) {codes.set(productId, product.data.code.trim());}
  }
  const skus = [...new Set(codes.values())];
  const { data: erpProducts, error: productError } = skus.length
    ? await db.from('products').select('id, sku, name, rim_size, tire_size').in('sku', skus).is('deleted_at', null)
    : { data: [], error: null };
  if (productError) {
    throw new Error(`Failed to load ERP products: ${productError.message}`);
  }
  const erpBySku = new Map((erpProducts ?? []).map((p) => [String(p.sku), p]));

  const unmapped = lines.filter((line) => !erpBySku.has(codes.get(line.productId) ?? ''));
  if (unmapped.length > 0) {
    await addDealNoteOnce(
      connectionId,
      deal.id,
      `ERP quote not created: these products have no matching ERP SKU (set the Pipedrive product code to the ERP SKU): ${unmapped.map((l) => l.name).join(', ')}.`
    );
    return { status: 'unmapped_products', message: 'Some deal products have no ERP SKU' };
  }

  // Deal value is informational; a mismatch is reported, the product lines win
  const productTotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const valueWarning =
    deal.value !== null && Math.abs(Math.round(deal.value * 100) - productTotal) > 1
      ? `Deal value ${deal.value} differs from the product total ${productTotal / 100}; the quote uses the products.`
      : null;

  // Build the quote through the normal service (validation, numbering, totals)
  const customerPo = deal.customFields[config.fields.deal_customer_po.code];
  const billing = {
    street: [customer.address_1, customer.address_2].filter(Boolean).join(', ') || null,
    city: customer.city ?? null,
    state: customer.state ?? null,
    postalCode: customer.zip ?? null,
    country: customer.country ?? null,
  };
  const shipping = customer.use_separate_shipping
    ? {
        street: [customer.shipping_address_1, customer.shipping_address_2].filter(Boolean).join(', ') || null,
        city: customer.shipping_city ?? null,
        state: customer.shipping_state ?? null,
        postalCode: customer.shipping_zip ?? null,
        country: customer.shipping_country ?? null,
      }
    : billing;

  const salesRepId = await gesherUserForPipedriveUser(connectionId, deal.ownerId);
  const input: CreateQuoteInput = {
    quoteDate: new Date(),
    customerId: customer.id,
    salesRepId,
    currencyCode: 'USD',
    status: 'draft',
    billingAddress: billing,
    shippingAddress: shipping,
    customerPoNumber: typeof customerPo === 'string' && customerPo.trim() ? customerPo.trim() : null,
    pipedriveDealId: deal.id,
    items: lines.map((line) => {
      const product = erpBySku.get(codes.get(line.productId)!)!;
      return {
        productId: String(product.id),
        sku: String(product.sku),
        description: line.name || String(product.name ?? ''),
        quantity: line.quantity,
        unitCode: 'EA' as const,
        unitPrice: line.unitPriceCents,
        discountPercent: line.discountPercent,
        taxRate: 0,
      };
    }),
    internalNotes: [`${WON_DEAL_QUOTE_MARKER}${deal.id} (${deal.title}) when it was marked Won.`, valueWarning]
      .filter(Boolean)
      .join('\n'),
    customerNotes: null,
    termsAndConditions: null,
  };

  const created = await quoteService.create(input, salesRepId ?? undefined);
  if (!created.success || !created.data) {
    if (isMissingColumnError({ message: created.error }, 'pipedrive_deal_id')) {
      return { status: 'migration_required', message: 'Database migration 155 is required: quotes.pipedrive_deal_id does not exist' };
    }
    // A concurrent run inserted its linked quote first (unique index): use it
    const winner = await findLiveQuoteForDeal(deal.id);
    if (winner) {
      return finalizeExistingQuote(connectionId, config, deal, winner);
    }
    await addDealNoteOnce(connectionId, deal.id, `ERP quote could not be created: ${created.error ?? 'validation failed'}.`);
    return { status: 'quote_failed', message: created.error ?? 'Quote creation failed' };
  }
  const quote = created.data;

  // Normal approval workflow (approver then converts to a sales order)
  const submitted = await quoteService.submitForApproval(quote.id, salesRepId ?? undefined);

  // Tire count for reports (24s + 38s)
  const tireCount = lines.reduce((sum, line) => {
    const product = erpBySku.get(codes.get(line.productId)!)!;
    const size = classifyTireSize({ rimSize: product.rim_size, tireSize: product.tire_size, sku: product.sku, name: product.name });
    return size === 'other' ? sum : sum + line.quantity;
  }, 0);

  await patchDeal(connectionId, deal.id, {
    custom_fields: {
      [config.fields.deal_erp_quote_number.code]: quote.quoteNumber,
      [config.fields.deal_tire_count.code]: tireCount,
    },
  });
  // Milestone reached: the order is in the ERP
  await advanceDealStage(connectionId, config, deal, 'won_order_placed');
  await addDealNoteOnce(
    connectionId,
    deal.id,
    [
      submitted.success
        ? `ERP quote ${quote.quoteNumber} created and submitted for approval. The sales order is created when the approved quote is converted in Gesher.`
        : `ERP quote ${quote.quoteNumber} created as draft; submitting for approval failed: ${submitted.error}.`,
      valueWarning,
    ]
      .filter(Boolean)
      .join(' ')
  );

  return {
    status: 'quote_created',
    message: `Quote ${quote.quoteNumber} created`,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
  };
}

// ============================================
// SALES ORDER -> PIPEDRIVE
// ============================================

export type WriteBackStatus = 'written' | 'already_written' | 'not_linked' | 'not_connected' | 'failed';

export interface WriteBackResult {
  status: WriteBackStatus;
  message: string;
  orderNumber?: string;
}

/**
 * Write the ERP sales order number to the Pipedrive deal the quote came from.
 * Never throws (the conversion already succeeded); failures are returned and
 * retried later by reconcileSalesOrderWriteBacks or the manual action.
 */
export async function writeBackSalesOrderNumber(quoteId: string, salesOrderId: string): Promise<WriteBackResult> {
  try {
    const [{ data: quote, error: quoteError }, { data: order }] = await Promise.all([
      db.from('quotes').select('pipedrive_deal_id').eq('id', quoteId).maybeSingle(),
      db.from('sales_orders').select('order_number').eq('id', salesOrderId).maybeSingle(),
    ]);
    if (quoteError && isMissingColumnError(quoteError, 'pipedrive_deal_id')) {
      return { status: 'not_linked', message: 'Migration 155 not applied; quotes are not linked to deals' };
    }
    const dealId = quote?.pipedrive_deal_id as number | null | undefined;
    if (!dealId || !order?.order_number) {
      return { status: 'not_linked', message: 'Quote is not linked to a Pipedrive deal' };
    }
    const orderNumber = String(order.order_number);

    const connectionId = await getActivePipedriveConnectionId();
    if (!connectionId) {
      return { status: 'not_connected', message: 'Pipedrive is not connected', orderNumber };
    }
    const config = await getGdcConfig(connectionId);
    const deal = await getDeal(connectionId, dealId);
    if (!deal) {
      return { status: 'failed', message: `Pipedrive deal ${dealId} was not found`, orderNumber };
    }

    const alreadyWritten = deal.customFields[config.fields.deal_erp_order_number.code] === orderNumber;
    if (!alreadyWritten) {
      await patchDeal(connectionId, dealId, {
        custom_fields: { [config.fields.deal_erp_order_number.code]: orderNumber },
      });
    }
    await advanceDealStage(connectionId, config, deal, 'won_order_placed');
    await addDealNoteOnce(connectionId, dealId, `ERP sales order ${orderNumber} created from the approved quote.`);
    return {
      status: alreadyWritten ? 'already_written' : 'written',
      message: `Sales order ${orderNumber} ${alreadyWritten ? 'was already' : 'is now'} on Pipedrive deal ${dealId}`,
      orderNumber,
    };
  } catch (error) {
    console.error('[DealErp] Sales order write-back failed:', error);
    return { status: 'failed', message: error instanceof Error ? error.message : 'Write-back failed' };
  }
}

export interface WriteBackReconcileResult {
  checked: number;
  written: number;
  failed: Array<{ quoteId: string; message: string }>;
}

/**
 * Retry SO-number write-backs: for quotes linked to a Pipedrive deal and
 * converted in the last `sinceDays` days, make sure the deal shows the order
 * number. Safe to run repeatedly; it only writes when the deal is missing it.
 */
export async function reconcileSalesOrderWriteBacks(
  options: { sinceDays?: number; now?: Date } = {}
): Promise<WriteBackReconcileResult> {
  const since = new Date((options.now ?? new Date()).getTime() - (options.sinceDays ?? 30) * 86_400_000).toISOString();
  const result: WriteBackReconcileResult = { checked: 0, written: 0, failed: [] };

  const { data: quotes, error } = await db
    .from('quotes')
    .select('id')
    .not('pipedrive_deal_id', 'is', null)
    .eq('status', 'converted')
    .is('deleted_at', null)
    .gte('updated_at', since)
    .limit(500);
  if (error) {
    if (isMissingColumnError(error, 'pipedrive_deal_id')) {return result;}
    throw new Error(`Failed to load converted quotes: ${error.message}`);
  }
  const quoteIds = (quotes ?? []).map((q) => String(q.id));
  if (quoteIds.length === 0) {return result;}

  const { data: orders, error: orderError } = await db
    .from('sales_orders')
    .select('id, quote_id')
    .in('quote_id', quoteIds)
    .is('deleted_at', null);
  if (orderError) {
    throw new Error(`Failed to load sales orders: ${orderError.message}`);
  }

  for (const order of orders ?? []) {
    result.checked++;
    const outcome = await writeBackSalesOrderNumber(String(order.quote_id), String(order.id));
    if (outcome.status === 'written') {result.written++;}
    if (outcome.status === 'failed' || outcome.status === 'not_connected') {
      result.failed.push({ quoteId: String(order.quote_id), message: outcome.message });
    }
  }
  return result;
}
