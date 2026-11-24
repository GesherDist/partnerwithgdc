/**
 * Customer overdue invoices (warning only) – Nov 20 2026
 *
 * Ankur, Nov 19 call: "I think it's just a warning we need to display. I don't
 * think we need to manually release … overdue invoices is more important."
 *
 * Read from the latest QuickBooks snapshot (open invoices), never from the ERP
 * invoices table. QuickBooks invoices carry only the customer name, so the ERP
 * customer is matched by name (case, punctuation and Inc/LLC ignored). No
 * snapshot, no match or no overdue invoice → null, and nothing is shown.
 */

'use server';

import { getCurrentUser } from '@/shared/lib/auth';

// Same rule as normalizeCompanyName (pipedrive/gdc/customer-mapping.service), kept
// here so this action does not load the Pipedrive modules
const COMPANY_SUFFIXES = new Set(['llc', 'inc', 'incorporated', 'co', 'corp', 'corporation', 'company', 'ltd', 'limited', 'lp', 'llp', 'pllc', 'the']);

/** "Valmont Industries, Inc." → "valmont industries" */
function normalizeCompanyName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !COMPANY_SUFFIXES.has(word))
    .join(' ');
}

export interface CustomerOverdueInvoices {
  count: number;
  /** Dollars */
  amount: number;
  /** Days past due of the oldest overdue invoice */
  oldestDays: number;
  invoices: Array<{ doc: string; dueDate: string | null; balance: number }>;
  /** Date of the QuickBooks snapshot the figures come from */
  asOf: string;
}

/** Today in the business time zone (YYYY-MM-DD) */
function businessToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/** customerName when known (C-SO drawer); otherwise the name is read for customerId (forms) */
export async function getCustomerOverdueInvoices(customer: {
  customerId?: string | null;
  customerName?: string | null;
}): Promise<{ success: boolean; data?: CustomerOverdueInvoices | null; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    let name = customer.customerName ?? null;
    if (!name && customer.customerId) {
      const { db } = await import('@/shared/lib/supabase/database');
      const { data } = await db.from('customers').select('name').eq('id', customer.customerId).maybeSingle();
      name = (data?.name as string | undefined) ?? null;
    }
    const key = normalizeCompanyName(name);
    if (!key) {
      return { success: true, data: null };
    }

    const [{ getConnectionByProvider }, { getLatestSnapshot }] = await Promise.all([
      import('@/modules/integrations/core'),
      import('@/modules/integrations/quickbooks/services/qbo-financials.service'),
    ]);
    const connection = await getConnectionByProvider('quickbooks');
    if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
      return { success: true, data: null };
    }
    const { financials } = await getLatestSnapshot(connection.external_account_id);
    const open = financials?.periods?.openInvoices;
    if (!financials || !open) {
      return { success: true, data: null };
    }

    const today = businessToday();
    // Same rule as the dashboard: past due, or no due date
    const overdue = open.invoices.filter(
      (i) => normalizeCompanyName(i.customer) === key && i.balance > 0 && (!i.dueDate || i.dueDate < today)
    );
    if (overdue.length === 0) {
      return { success: true, data: null };
    }

    const oldestDue = overdue.map((i) => i.dueDate ?? i.txnDate).filter(Boolean).sort()[0];
    const oldestDays = oldestDue ? Math.max(0, Math.round((Date.parse(today) - Date.parse(oldestDue)) / 86_400_000)) : 0;
    return {
      success: true,
      data: {
        count: overdue.length,
        amount: Math.round(overdue.reduce((n, i) => n + i.balance, 0) * 100) / 100,
        oldestDays,
        invoices: overdue.map((i) => ({ doc: i.doc, dueDate: i.dueDate, balance: i.balance })),
        asOf: financials.asOf,
      },
    };
  } catch (error) {
    // A warning must never break the page
    console.error('getCustomerOverdueInvoices error:', error);
    return { success: true, data: null };
  }
}
