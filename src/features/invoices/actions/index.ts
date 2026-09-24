/**
 * Invoices Server Actions
 *
 * Next.js server actions for Invoices feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { invoiceService } from '../services/invoice.service';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  RecordPaymentInput,
} from '../lib/schemas';
import type { InvoiceListParams } from '../types';

// ============================================
// HELPER: Get current user ID
// ============================================

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {return undefined;}

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    return data?.id;
  } catch {
    return undefined;
  }
}

// ============================================
// CREATE INVOICE FROM SALES ORDER
// ============================================

export async function createInvoiceFromSalesOrder(
  salesOrderId: string,
  options: {
    dueDate?: Date;
    paymentTerms?: string;
  } = {}
) {
  const userId = await getCurrentUserId();
  const result = await invoiceService.createFromSalesOrder(salesOrderId, options, userId);

  if (result.success) {
    revalidatePath('/invoices');
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${salesOrderId}`);
  }

  return result;
}

// ============================================
// LIST INVOICES
// ============================================

export async function listInvoices(params: InvoiceListParams = {}) {
  const result = await invoiceService.list(params);
  return result;
}

// ============================================
// GET INVOICE
// ============================================

export async function getInvoice(id: string) {
  const result = await invoiceService.getById(id);
  return result;
}

// ============================================
// CREATE INVOICE
// ============================================

export async function createInvoice(data: CreateInvoiceInput) {
  const userId = await getCurrentUserId();
  const result = await invoiceService.create(data, userId);

  if (result.success) {
    revalidatePath('/invoices');
  }

  return result;
}

// ============================================
// UPDATE INVOICE
// ============================================

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  const userId = await getCurrentUserId();
  const result = await invoiceService.update(id, data, userId);

  if (result.success) {
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
  }

  return result;
}

// ============================================
// DELETE INVOICE
// ============================================

export async function deleteInvoice(id: string) {
  const userId = await getCurrentUserId();
  const result = await invoiceService.delete(id, userId);

  if (result.success) {
    revalidatePath('/invoices');
  }

  return result;
}

// ============================================
// RECORD PAYMENT
// ============================================

export async function recordInvoicePayment(id: string, data: RecordPaymentInput) {
  const userId = await getCurrentUserId();
  const result = await invoiceService.recordPayment(id, data, userId);

  if (result.success) {
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
  }

  return result;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

export async function sendInvoice(id: string) {
  const userId = await getCurrentUserId();
  const result = await invoiceService.send(id, userId);

  if (result.success) {
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
  }

  return result;
}

export async function markInvoiceOverdue(id: string) {
  const userId = await getCurrentUserId();
  const result = await invoiceService.markOverdue(id, userId);

  if (result.success) {
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
  }

  return result;
}

export async function cancelInvoice(id: string) {
  const userId = await getCurrentUserId();
  const result = await invoiceService.cancel(id, userId);

  if (result.success) {
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
  }

  return result;
}
