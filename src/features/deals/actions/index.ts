'use server';

/**
 * Deals Server Actions
 *
 * Server actions for the Deals module.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/shared/lib/auth/check-permission';
import { dealsService } from '../services/deals.service';
import { pipedrivePushService } from '@/features/pipedrive/services/pipedrive-push.service';
import { dealsRepository } from '../repositories/deals.repository';
import { customerService } from '@/features/customers/services/customer.service';
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
// READ ACTIONS
// ============================================

/**
 * Get a deal by ID
 */
export async function getDeal(id: string): Promise<ActionResult<Deal>> {
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
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.createDeal(dto, user?.id);

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
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.updateDeal(id, dto, user?.id);

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
  try {
    const user = await getCurrentUser();
    await dealsService.deleteDeal(id, user?.id);

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
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.markAsWon(id, user?.id);

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
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.markAsLost(id, lostReason, user?.id);

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
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.reopenDeal(id, user?.id);

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
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.linkToCustomer(dealId, customerId, user?.id);

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
  try {
    const user = await getCurrentUser();

    // 1. Save note locally first
    const note = await dealsService.addNote(
      { dealId, content },
      user?.id
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

        if (pushResult.success) {
          console.log(`[addDealNote] Note synced to Pipedrive: ${pushResult.pipedriveNoteId}`);
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
  try {
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
): Promise<ActionResult<{ customerId: string; quoteId: string | null }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // 1. Get the deal
    const deal = await dealsService.getDeal(dealId);
    if (!deal) {
      return { success: false, error: 'Deal not found' };
    }

    // 2. Verify deal is won
    if (deal.status !== 'won') {
      return { success: false, error: 'Only won deals can be converted to customers' };
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
    console.log('[convertDealToCustomer] Customer created:', customer.id);

    // 4. Create quote if requested
    let quoteId: string | null = null;

    console.log('[convertDealToCustomer] createQuote flag:', data.createQuote);
    console.log('[convertDealToCustomer] products count:', data.products.length);

    if (data.createQuote !== false) {
      console.log('[convertDealToCustomer] Creating quote...');
      console.log('[convertDealToCustomer] Customer ID for quote:', customer.id);

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

        // Quote items
        items: data.products.map((product) => ({
          productId: product.productId || '', // Will need to resolve by SKU on server
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
      };

      const quoteResult = await quoteService.create(quoteData, user.id);

      if (!quoteResult.success || !quoteResult.data) {
        console.error('[convertDealToCustomer] Quote creation failed:', quoteResult.error);
        // Don't fail the whole operation, customer is already created
        // Just log the error
      } else {
        quoteId = quoteResult.data.id;
        console.log('[convertDealToCustomer] Quote created:', quoteId);
      }
    }

    // 5. Update deal to mark as converted
    await dealsService.updateDeal(dealId, { customerId: customer.id }, user.id);

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
