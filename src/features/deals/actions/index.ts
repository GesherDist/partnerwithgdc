'use server';

/**
 * Deals Server Actions
 *
 * Server actions for the Deals module.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import type { AppUser } from '@/shared/stores/auth.store';
import { dealsService } from '../services/deals.service';
import { pipedrivePushService } from '@/features/pipedrive/services/pipedrive-push.service';
import { dealsRepository } from '../repositories/deals.repository';
import { customerService } from '@/features/customers/services/customer.service';
import { customerRepository } from '@/features/customers/repositories/customer.repository';
import { GDC_LOST_REASONS, isGdcLostReason } from '@/features/pipedrive/gdc/config';
import { findLiveQuoteForDeal as findLiveQuoteForPipedriveDeal } from '@/features/pipedrive/gdc/deal-erp.service';
import { MigrationRequiredError } from '@/features/pipedrive/gdc/schema-guard';
import { db } from '@/shared/lib/supabase/database';
import { quoteService } from '@/features/quotes/services/quote.service';
import type {
  Deal,
  DealNote,
  DealListParams,
  PaginatedDealResult,
  CreateDealDTO,
  UpdateDealDTO,
} from '../types';
import type { CreateQuoteInput } from '@/features/quotes/lib/schemas';

// ============================================
// ACTION RESULT TYPE
// ============================================

export type ActionResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  errors?: Record<string, string[]>;
};

// ============================================
// AUTHORIZATION HELPERS
// ============================================

/**
 * Same permission that gates the /deals page. Server actions are callable
 * directly, so they must enforce it themselves.
 */
const DEALS_PERMISSION = 'customers.view_module';

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: { success: false; error: string } };

/**
 * Resolve the current application user and verify a permission.
 */
async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

// ============================================
// READ ACTIONS
// ============================================

/**
 * Get a deal by ID
 */
export async function getDeal(id: string): Promise<ActionResult<Deal>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const deal = await dealsService.getDeal(id);

    if (!deal) {
      return { success: false, error: 'Deal not found' };
    }

    return { success: true, data: deal };
  } catch (error) {
    console.error('Error fetching deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch deal',
    };
  }
}

/**
 * Get paginated list of deals
 */
export async function getDeals(
  params: DealListParams = {}
): Promise<ActionResult<PaginatedDealResult>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await dealsService.getDeals(params);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error fetching deals:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch deals',
    };
  }
}

/**
 * Get deal statistics
 */
export async function getDealStats(): Promise<
  ActionResult<{
    countByStatus: Record<string, number>;
    valueByStatus: Array<{ status: string; totalValue: number; count: number }>;
    valueByPipeline: Array<{ pipeline: string; totalValue: number; count: number }>;
  }>
> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const stats = await dealsService.getDealStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching deal stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch deal stats',
    };
  }
}

// ============================================
// WRITE ACTIONS
// ============================================

/**
 * Create a new deal
 */
export async function createDeal(dto: CreateDealDTO): Promise<ActionResult<Deal>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const user = auth.user;
    const deal = await dealsService.createDeal(dto, user.id);

    revalidatePath('/deals');
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error creating deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create deal',
    };
  }
}

/**
 * Update a deal
 */
export async function updateDeal(
  id: string,
  dto: UpdateDealDTO
): Promise<ActionResult<Deal>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const user = auth.user;
    const deal = await dealsService.updateDeal(id, dto, user.id);

    // Push update to Pipedrive (non-blocking)
    try {
      const pushResult = await pipedrivePushService.pushDealUpdate(id);
      if (pushResult.success) {
        console.log(`[updateDeal] Deal synced to Pipedrive`);
      } else {
        console.warn(`[updateDeal] Pipedrive push warning: ${pushResult.error}`);
      }
    } catch (pipedriveError) {
      // Log but don't fail - deal is updated locally
      console.warn('[updateDeal] Pipedrive push failed (non-blocking):', pipedriveError);
    }

    revalidatePath('/deals');
    revalidatePath(`/deals/${id}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error updating deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update deal',
    };
  }
}

/**
 * Delete a deal
 */
export async function deleteDeal(id: string): Promise<ActionResult<void>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const user = auth.user;
    await dealsService.deleteDeal(id, user.id);

    revalidatePath('/deals');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete deal',
    };
  }
}

/**
 * Mark deal as won
 */
export async function markDealAsWon(id: string): Promise<ActionResult<Deal>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const user = auth.user;
    const deal = await dealsService.markAsWon(id, user.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${id}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error marking deal as won:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark deal as won',
    };
  }
}

/**
 * Mark deal as lost
 */
export async function markDealAsLost(
  id: string,
  lostReason?: string
): Promise<ActionResult<Deal>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  // GDC spec: one of the predefined lost reasons is required (same list as Pipedrive)
  if (!isGdcLostReason(lostReason)) {
    return { success: false, error: `A lost reason is required: ${GDC_LOST_REASONS.join(', ')}` };
  }

  try {
    const user = auth.user;
    const deal = await dealsService.markAsLost(id, lostReason, user.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${id}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error marking deal as lost:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark deal as lost',
    };
  }
}

/**
 * Reopen a deal
 */
export async function reopenDeal(id: string): Promise<ActionResult<Deal>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const user = auth.user;
    const deal = await dealsService.reopenDeal(id, user.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${id}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error reopening deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reopen deal',
    };
  }
}

/**
 * Link deal to customer
 */
export async function linkDealToCustomer(
  dealId: string,
  customerId: string
): Promise<ActionResult<Deal>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const user = auth.user;
    const deal = await dealsService.linkToCustomer(dealId, customerId, user.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${dealId}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error linking deal to customer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link deal to customer',
    };
  }
}

// ============================================
// NOTES ACTIONS
// ============================================

/**
 * Get notes for a deal
 */
export async function getDealNotes(dealId: string): Promise<ActionResult<DealNote[]>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const notes = await dealsService.getNotes(dealId);
    return { success: true, data: notes };
  } catch (error) {
    console.error('Error fetching deal notes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch deal notes',
    };
  }
}

/**
 * Add a note to a deal
 * Saves locally and pushes to Pipedrive if connected
 */
export async function addDealNote(
  dealId: string,
  content: string
): Promise<ActionResult<DealNote>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const user = auth.user;

    // 1. Save note locally first
    const note = await dealsService.addNote(
      { dealId, content },
      user.id
    );

    // 2. Push to Pipedrive if deal is linked (non-blocking)
    try {
      const deal = await dealsRepository.getById(dealId);
      if (deal?.pipedriveDealId) {
        const pushResult = await pipedrivePushService.pushNote(content, {
          dealId: deal.pipedriveDealId,
          personId: deal.pipedrivePersonId || undefined,
          orgId: deal.pipedriveOrgId || undefined,
        });

        if (pushResult.success && pushResult.pipedriveNoteId) {
          // Link the local note to its Pipedrive copy; without this the next
          // deals sync imports the same note again as a duplicate.
          await dealsRepository.markNoteSynced(note.id, pushResult.pipedriveNoteId);
          note.pipedriveNoteId = pushResult.pipedriveNoteId;
          note.syncedToPipedrive = true;
        } else {
          console.warn(`[addDealNote] Pipedrive push warning: ${pushResult.error}`);
        }
      }
    } catch (pipedriveError) {
      // Log but don't fail - note is saved locally
      console.warn('[addDealNote] Pipedrive push failed (non-blocking):', pipedriveError);
    }

    revalidatePath(`/deals/${dealId}`);
    return { success: true, data: note };
  } catch (error) {
    console.error('Error adding deal note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add deal note',
    };
  }
}

/**
 * Delete a deal note
 */
export async function deleteDealNote(noteId: string, dealId: string): Promise<ActionResult<void>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Delete the Pipedrive copy first. If that fails, keep the local note:
    // deleting only locally would let the next sync bring the note back.
    const note = await dealsRepository.getNoteById(noteId);
    if (note?.pipedriveNoteId) {
      const pipedriveResult = await pipedrivePushService.deleteNoteFromPipedrive(note.pipedriveNoteId);
      if (!pipedriveResult.success && !pipedriveResult.notConnected) {
        return {
          success: false,
          error: `Could not delete the note in Pipedrive, so it was kept. Please try again. (${pipedriveResult.error})`,
        };
      }
    }

    await dealsService.deleteNote(noteId);

    revalidatePath(`/deals/${dealId}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting deal note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete deal note',
    };
  }
}

// ============================================
// CONVERSION ACTIONS
// ============================================

interface ConvertDealToCustomerData {
  customerName: string;
  email: string | null;
  phone: string | null;
  channel: 'oem' | 'dealer';
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  useSameBilling: boolean;
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  createQuote?: boolean;
  quoteNumber?: string;
  quoteDate?: Date;
  customerPoNumber?: string | null;
  products: Array<{
    productId?: string;
    sku: string;
    description: string;
    quantity: number;
    unitPrice: number; // in cents
  }>;
  customerNotes: string | null;
  internalNotes?: string | null;
  termsAndConditions?: string | null;
}

/**
 * Convert a won deal to a customer with optional initial quote
 */
export async function convertDealToCustomer(
  dealId: string,
  data: ConvertDealToCustomerData
): Promise<ActionResult<{ customerId: string; quoteId: string | null; quoteError?: string }>> {
  const auth = await authorize(DEALS_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const user = auth.user;

    // 1. Get the deal
    const deal = await dealsService.getDeal(dealId);
    if (!deal) {
      return { success: false, error: 'Deal not found' };
    }

    // 2. Verify deal is won
    if (deal.status !== 'won') {
      return { success: false, error: 'Only won deals can be converted to customers' };
    }

    // Idempotency: a deal converts to exactly one customer. The UI hides the
    // button once converted, but a double submit or second tab can still call this.
    if (deal.customerId) {
      return { success: false, error: 'This deal has already been converted to a customer' };
    }

    // Validate quote lines before creating anything, so a bad line cannot leave
    // a customer behind with a silently missing quote.
    const wantsQuote = data.createQuote !== false;
    if (wantsQuote) {
      if (data.products.length === 0) {
        return { success: false, error: 'Add at least one product for the quote, or turn off quote creation' };
      }
      const unmatched = data.products.filter((product) => !product.productId);
      if (unmatched.length > 0) {
        return {
          success: false,
          error: `Select a catalog product for: ${unmatched.map((p) => p.sku || p.description).join(', ')}`,
        };
      }
    }

    // A won Pipedrive deal may already have its ERP quote (created by the webhook
    // flow); never create a second one for the same deal. Checked before anything
    // is created so a failure here leaves no partial records behind.
    // Without migration 155 the deal link is unavailable: the quote is created
    // the legacy way (not linked to the deal) and the user is told.
    let existingDealQuote: { quote_number: string } | null = null;
    let dealLinkUnavailable = false;
    if (wantsQuote && deal.pipedriveDealId) {
      try {
        existingDealQuote = await findLiveQuoteForPipedriveDeal(deal.pipedriveDealId);
      } catch (error) {
        if (!(error instanceof MigrationRequiredError)) {
          throw error;
        }
        console.warn('[convertDealToCustomer] Migration 155 not applied; quote will not be linked to the Pipedrive deal');
        dealLinkUnavailable = true;
      }
    }

    // 3. Create customer using createFromForm (auto-generates customerCode)
    const customerFormData = {
      customerCode: '', // Will be auto-generated by createFromForm
      name: data.customerName,
      legalName: data.customerName,
      channel: data.channel,
      email: data.email || '',
      phone: data.phone || '',

      // Billing Address (always from billingAddress)
      address1: data.billingAddress?.street || '',
      address2: '',
      city: data.billingAddress?.city || '',
      state: data.billingAddress?.state || '',
      zip: data.billingAddress?.postalCode || '',
      country: data.billingAddress?.country || '',

      // Shipping Address (same as billing if useSameBilling is true)
      shippingAddress1: data.shippingAddress.street || '',
      shippingAddress2: '',
      shippingCity: data.shippingAddress.city || '',
      shippingState: data.shippingAddress.state || '',
      shippingZip: data.shippingAddress.postalCode || '',
      shippingCountry: data.shippingAddress.country || '',
      useSeparateShipping: !data.useSameBilling,

      // Contact
      website: '',

      // Tax
      taxId: '',
      taxExempt: false,
      taxExemptNumber: '',
      taxExemptExpiryAt: '',

      // Credit
      creditStatus: 'pending' as const,
      creditLimit: '0',
      openBalance: '0',
      creditTerms: 'Net 30',

      // Settings
      preferredLocationId: '',
      defaultPaymentMethod: '',
      status: 'active' as const,
      internalNotes: '',
    };

    const customerResult = await customerService.createFromForm(customerFormData, user.id);

    if (!customerResult.success || !customerResult.data) {
      return {
        success: false,
        error: customerResult.error || 'Failed to create customer',
        errors: customerResult.errors,
      };
    }

    const customer = customerResult.data;

    // 4. Link the deal to the customer right away, atomically. If another
    // request linked it first, undo this customer instead of keeping a duplicate.
    const linked = await dealsRepository.linkCustomerIfUnlinked(dealId, customer.id, user.id);
    if (!linked) {
      await customerRepository.softDelete(customer.id, user.id);
      return { success: false, error: 'This deal has already been converted to a customer' };
    }

    // Link the new customer to the deal's Pipedrive organization so won deals
    // and purchase history resolve it. Only when no other customer holds that
    // organization; a failure here never undoes the conversion.
    if (deal.pipedriveOrgId) {
      await linkCustomerToPipedriveOrg(customer.id, deal.pipedriveOrgId);
    }

    // 5. Create quote if requested
    let quoteId: string | null = null;
    let quoteError: string | undefined;

    if (wantsQuote && existingDealQuote) {
      quoteError = `Quote ${existingDealQuote.quote_number} already exists for this Pipedrive deal; no new quote was created`;
    }

    if (wantsQuote && !existingDealQuote) {
      const quoteData: CreateQuoteInput = {
        quoteNumber: data.quoteNumber || undefined,
        quoteDate: data.quoteDate || new Date(),
        customerId: customer.id,
        salesRepId: user.id,
        currencyCode: 'USD',
        status: 'draft',
        customerPoNumber: data.customerPoNumber || null,

        // Billing Address (always from billingAddress)
        billingAddress: {
          street: data.billingAddress?.street || null,
          city: data.billingAddress?.city || null,
          state: data.billingAddress?.state || null,
          postalCode: data.billingAddress?.postalCode || null,
          country: data.billingAddress?.country || null,
        },

        // Shipping Address (from shippingAddress, which is same as billing when checkbox is checked)
        shippingAddress: {
          street: data.shippingAddress.street,
          city: data.shippingAddress.city,
          state: data.shippingAddress.state,
          postalCode: data.shippingAddress.postalCode,
          country: data.shippingAddress.country,
        },

        // Quote items (productId presence validated above)
        items: data.products.map((product) => ({
          productId: product.productId || '',
          sku: product.sku,
          description: product.description,
          quantity: product.quantity,
          unitCode: 'EA',
          unitPrice: product.unitPrice, // already in cents
          discountPercent: 0,
          taxRate: 0,
        })),

        customerNotes: data.customerNotes,
        internalNotes: data.internalNotes || null,
        termsAndConditions: data.termsAndConditions || null,
        // Linked at insert time: a concurrent won-deal run cannot add a second quote
        pipedriveDealId: deal.pipedriveDealId && !dealLinkUnavailable ? deal.pipedriveDealId : null,
      };

      const quoteResult = await quoteService.create(quoteData, user.id);

      if (!quoteResult.success || !quoteResult.data) {
        // The customer is created and linked; report the quote failure instead
        // of claiming success, so the user can create the quote manually.
        console.error('[convertDealToCustomer] Quote creation failed:', quoteResult.error);
        const winner =
          deal.pipedriveDealId && !dealLinkUnavailable
            ? await findLiveQuoteForPipedriveDeal(deal.pipedriveDealId).catch(() => null)
            : null;
        quoteError = winner
          ? `Quote ${winner.quote_number} already exists for this Pipedrive deal; no new quote was created`
          : quoteResult.error || 'Quote could not be created';
      } else {
        quoteId = quoteResult.data.id;
        if (dealLinkUnavailable) {
          quoteError = 'Quote created but not linked to the Pipedrive deal (database migration 155 pending); the SO number will not be written back automatically';
        }
      }
    }

    revalidatePath('/deals');
    revalidatePath('/customers');
    if (quoteId) {
      revalidatePath('/quotes');
    }

    return {
      success: true,
      data: {
        customerId: customer.id,
        quoteId,
        quoteError,
      },
    };
  } catch (error) {
    console.error('Error converting deal to customer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert deal to customer',
    };
  }
}

/**
 * Set customers.pipedrive_org_id for a newly converted customer, unless another
 * live customer already holds that organization or the customer is linked.
 */
async function linkCustomerToPipedriveOrg(customerId: string, orgId: number): Promise<void> {
  try {
    const { data: holders, error } = await db
      .from('customers')
      .select('id')
      .eq('pipedrive_org_id', orgId)
      .is('deleted_at', null)
      .limit(1);
    if (error || (holders ?? []).length > 0) {
      return;
    }
    const { error: updateError } = await db
      .from('customers')
      .update({ pipedrive_org_id: orgId })
      .eq('id', customerId)
      .is('pipedrive_org_id', null);
    if (updateError) {
      console.warn('[convertDealToCustomer] Could not link customer to the Pipedrive organization:', updateError.message);
    }
  } catch (error) {
    console.warn('[convertDealToCustomer] Could not link customer to the Pipedrive organization:', error);
  }
}
