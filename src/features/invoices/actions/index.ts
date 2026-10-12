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

// ============================================
// GET MASTER DATA FOR INVOICE FORM
// ============================================

export async function getInvoiceMasterData(): Promise<{
  success: boolean;
  data?: {
    customers: Array<{
      id: string;
      name: string;
      address1: string | null;
      address2: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      country: string | null;
    }>;
    suppliers: Array<{
      id: string;
      name: string;
      address1: string | null;
      address2: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      country: string | null;
    }>;
    products: Array<{
      id: string;
      sku: string;
      name: string;
      itemType: string;
      unitPrice: number;
    }>;
    users: Array<{
      id: string;
      firstName: string;
      lastName: string;
    }>;
    currentUserId?: string;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get current user's internal ID
    const { data: currentUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    // Fetch customers with address fields
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, address_1, address_2, city, state, zip, country')
      .is('deleted_at', null)
      .order('name');

    if (customersError) {
      console.error('Failed to load customers:', customersError);
      return { success: false, error: 'Failed to load customers' };
    }

    // Fetch suppliers with address fields (for commission invoices)
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id, name, address_street, address_city, address_state, address_postal_code, address_country')
      .is('deleted_at', null)
      .order('name');

    if (suppliersError) {
      console.error('Failed to load suppliers:', suppliersError);
      return { success: false, error: 'Failed to load suppliers' };
    }

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku, name, item_type, base_price')
      .is('deleted_at', null)
      .order('name');

    if (productsError) {
      console.error('Failed to load products:', productsError);
      return { success: false, error: 'Failed to load products' };
    }

    // Fetch users (for sales rep selection)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .is('deleted_at', null)
      .order('first_name');

    if (usersError) {
      console.error('Failed to load users:', usersError);
      return { success: false, error: 'Failed to load users' };
    }

    return {
      success: true,
      data: {
        customers: (customers || []).map(c => ({
          id: c.id,
          name: c.name,
          address1: c.address_1,
          address2: c.address_2,
          city: c.city,
          state: c.state,
          zip: c.zip,
          country: c.country,
        })),
        suppliers: (suppliers || []).map(s => ({
          id: s.id,
          name: s.name,
          address1: s.address_street,
          address2: null, // Suppliers table doesn't have address_2
          city: s.address_city,
          state: s.address_state,
          zip: s.address_postal_code,
          country: s.address_country,
        })),
        products: (products || []).map(p => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          itemType: p.item_type || 'inventory',
          unitPrice: p.base_price || 0,
        })),
        users: (users || []).map(u => ({
          id: u.id,
          firstName: u.first_name,
          lastName: u.last_name,
        })),
        currentUserId: currentUser?.id,
      },
    };
  } catch (error) {
    console.error('getInvoiceMasterData error:', error);
    return { success: false, error: 'Failed to load master data' };
  }
}

// ============================================
// GET CUSTOMER SALES ORDERS (for invoice creation)
// ============================================

export async function getCustomerSalesOrders(customerId: string): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    orderNumber: string;
    customerPoNumber: string | null;
    orderDate: string;
    status: string;
    grandTotal: number;
    hasInvoice: boolean;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Fetch sales orders for this customer
    const { data: salesOrders, error } = await supabase
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_po_number,
        order_date,
        status,
        grand_total,
        invoices:invoices(id)
      `)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .in('status', ['confirmed', 'processing', 'shipped', 'delivered'])
      .order('order_date', { ascending: false });

    if (error) {
      console.error('Failed to load sales orders:', error);
      return { success: false, error: 'Failed to load sales orders' };
    }

    return {
      success: true,
      data: (salesOrders || []).map(so => ({
        id: so.id,
        orderNumber: so.order_number,
        customerPoNumber: so.customer_po_number || null,
        orderDate: so.order_date,
        status: so.status,
        grandTotal: so.grand_total || 0,
        hasInvoice: Array.isArray(so.invoices) && so.invoices.length > 0,
      })),
    };
  } catch (error) {
    console.error('getCustomerSalesOrders error:', error);
    return { success: false, error: 'Failed to load sales orders' };
  }
}

// ============================================
// GET SALES ORDER WITH ITEMS (for auto-population)
// ============================================

export async function getSalesOrderWithItems(salesOrderId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    items: Array<{
      id: string;
      productId: string;
      sku: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent: number;
      taxRate: number;
    }>;
    billingAddress: {
      street: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
    };
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Fetch sales order with items
    const { data: salesOrder, error } = await supabase
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_id,
        billing_address_street,
        billing_address_city,
        billing_address_state,
        billing_address_postal_code,
        billing_address_country,
        customers:customer_id(name),
        sales_order_items(
          id,
          product_id,
          sku,
          description,
          quantity,
          unit_price,
          discount_percent,
          tax_rate
        )
      `)
      .eq('id', salesOrderId)
      .single();

    if (error || !salesOrder) {
      console.error('Failed to load sales order:', error);
      return { success: false, error: 'Failed to load sales order' };
    }

    return {
      success: true,
      data: {
        id: salesOrder.id,
        orderNumber: salesOrder.order_number,
        customerId: salesOrder.customer_id,
        customerName: (salesOrder.customers as unknown as { name: string } | null)?.name || '',
        items: (salesOrder.sales_order_items || []).map((item: {
          id: string;
          product_id: string;
          sku: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          discount_percent: number | null;
          tax_rate: number | null;
        }) => ({
          id: item.id,
          productId: item.product_id,
          sku: item.sku,
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          discountPercent: item.discount_percent || 0,
          taxRate: item.tax_rate || 0,
        })),
        billingAddress: {
          street: salesOrder.billing_address_street,
          city: salesOrder.billing_address_city,
          state: salesOrder.billing_address_state,
          postalCode: salesOrder.billing_address_postal_code,
          country: salesOrder.billing_address_country,
        },
      },
    };
  } catch (error) {
    console.error('getSalesOrderWithItems error:', error);
    return { success: false, error: 'Failed to load sales order' };
  }
}

// ============================================
// QUICKBOOKS INTEGRATION
// ============================================

/**
 * Push invoice to QuickBooks
 */
export async function pushInvoiceToQuickBooks(invoiceId: string): Promise<{
  success: boolean;
  qboInvoiceId?: string;
  error?: string;
}> {
  try {
    // Dynamically import to avoid circular dependencies
    const { pushInvoiceToQbo } = await import(
      '@/modules/integrations/quickbooks/services/qbo-invoice-sync.service'
    );

    const result = await pushInvoiceToQbo(invoiceId);

    if (result.success) {
      revalidatePath('/invoices');
      revalidatePath(`/invoices/${invoiceId}`);
    }

    return result;
  } catch (error) {
    console.error('pushInvoiceToQuickBooks error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to push invoice to QuickBooks',
    };
  }
}

/**
 * Check if QuickBooks is connected
 */
export async function checkQuickBooksConnection(): Promise<{
  success: boolean;
  connected: boolean;
  error?: string;
}> {
  try {
    const { isQuickBooksConnected } = await import(
      '@/modules/integrations/quickbooks/services/qbo-invoice-sync.service'
    );

    const connected = await isQuickBooksConnected();

    return {
      success: true,
      connected,
    };
  } catch (error) {
    console.error('checkQuickBooksConnection error:', error);
    return {
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Failed to check QuickBooks connection',
    };
  }
}
