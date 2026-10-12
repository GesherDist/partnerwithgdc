/**
 * QBO Invoice Sync Service
 *
 * Handles syncing invoices between our system and QuickBooks Online.
 * Creates invoices in QBO when invoices are created in our system.
 */

import { getConnectionByProvider } from '@/modules/integrations/core';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { AccountingInvoice, AccountingLineItem } from '@/modules/integrations/core';
import { qboCustomerSyncService } from './qbo-customer-sync.service';
import { qboProductSyncService } from './qbo-product-sync.service';

// ============================================
// TYPES
// ============================================

interface PushInvoiceResult {
  success: boolean;
  qboInvoiceId?: string;
  error?: string;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  customerId: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  customerNotes: string | null;
  items: Array<{
    id: string;
    productId: string;
    sku: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxRate: number;
    lineTotal: number;
    qboItemId?: string;
  }>;
  customer: {
    id: string;
    qboCustomerId: string | null;
  } | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the active QBO connection
 */
async function getQboConnection(): Promise<{
  connectionId: string;
  realmId: string;
} | null> {
  const connection = await getConnectionByProvider('quickbooks');

  if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
    return null;
  }

  return {
    connectionId: connection.id,
    realmId: connection.external_account_id,
  };
}

/**
 * Map our Invoice to QBO AccountingInvoice format
 */
function mapInvoiceToQboFormat(invoice: InvoiceData): AccountingInvoice {
  const lineItems: AccountingLineItem[] = invoice.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productExternalId: item.qboItemId, // QBO Item ID for linking
    description: item.description || item.sku,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.lineTotal,
    taxRate: item.taxRate,
    discountPercent: item.discountPercent,
  }));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerExternalId: invoice.customer?.qboCustomerId || undefined,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate || undefined,
    lineItems,
    subtotal: invoice.subtotal,
    taxTotal: invoice.taxTotal,
    discountTotal: invoice.discountTotal,
    total: invoice.grandTotal,
    memo: invoice.customerNotes || undefined,
  };
}

/**
 * Update invoice with QBO sync data
 * Also updates status to 'sent' when synced to QuickBooks
 */
async function updateInvoiceQboFields(
  invoiceId: string,
  qboInvoiceId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('invoices')
    .update({
      quickbooks_invoice_id: qboInvoiceId,
      quickbooks_sync_status: 'synced',
      quickbooks_last_sync: new Date().toISOString(),
      status: 'sent', // Update status to 'sent' when shared to QuickBooks
    })
    .eq('id', invoiceId);

  if (error) {
    console.error('Failed to update invoice QBO fields:', error);
    throw error;
  }
}

/**
 * Update invoice sync status to error
 */
async function updateInvoiceSyncError(
  invoiceId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('invoices')
    .update({
      quickbooks_sync_status: 'error',
      quickbooks_last_sync: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  if (error) {
    console.error('Failed to update invoice sync error:', error);
  }
}

// ============================================
// MAIN SERVICE FUNCTIONS
// ============================================

/**
 * Push a single invoice to QuickBooks
 */
export async function pushInvoiceToQbo(invoiceId: string): Promise<PushInvoiceResult> {
  try {
    // 1. Check QBO connection
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      return {
        success: false,
        error: 'QuickBooks is not connected. Please connect your QuickBooks account first.',
      };
    }

    // 2. Get invoice with items and customer
    const supabase = createAdminClient();
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        invoice_date,
        due_date,
        customer_id,
        subtotal,
        tax_total,
        discount_total,
        grand_total,
        customer_notes,
        quickbooks_invoice_id,
        invoice_items (
          id,
          product_id,
          sku,
          description,
          quantity,
          unit_price,
          discount_percent,
          tax_rate,
          line_total
        ),
        customers:customer_id (
          id,
          qbo_customer_id
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return {
        success: false,
        error: 'Invoice not found',
      };
    }

    // 3. Check if already synced
    if (invoice.quickbooks_invoice_id) {
      return {
        success: false,
        error: 'Invoice is already synced to QuickBooks',
      };
    }

    // 4. Check if customer is synced to QBO, if not - auto-sync
    // Supabase returns the relation as an object for single() queries with FK relations
    let customer = invoice.customers as unknown as { id: string; qbo_customer_id: string | null } | null;

    if (!customer?.qbo_customer_id) {
      // Customer not synced - fetch full customer data and sync to QBO
      const { data: fullCustomer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', invoice.customer_id)
        .single();

      if (customerError || !fullCustomer) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      // Map to Customer type and sync
      const customerData = {
        id: fullCustomer.id,
        customerCode: fullCustomer.customer_code,
        name: fullCustomer.name,
        legalName: fullCustomer.legal_name,
        email: fullCustomer.email,
        phone: fullCustomer.phone,
        address1: fullCustomer.address1,
        address2: fullCustomer.address2,
        city: fullCustomer.city,
        state: fullCustomer.state,
        zip: fullCustomer.zip,
        country: fullCustomer.country,
        useSeparateShipping: fullCustomer.use_separate_shipping,
        shippingAddress1: fullCustomer.shipping_address1,
        shippingAddress2: fullCustomer.shipping_address2,
        shippingCity: fullCustomer.shipping_city,
        shippingState: fullCustomer.shipping_state,
        shippingZip: fullCustomer.shipping_zip,
        shippingCountry: fullCustomer.shipping_country,
        taxExempt: fullCustomer.tax_exempt,
        qboCustomerId: fullCustomer.qbo_customer_id,
        qboRealmId: fullCustomer.qbo_realm_id,
        qboSyncedAt: fullCustomer.qbo_synced_at,
        qboSyncError: fullCustomer.qbo_sync_error,
      };

      console.log(`Customer ${customerData.name} not synced to QBO. Auto-syncing...`);

      const customerSyncResult = await qboCustomerSyncService.syncCustomer({
        customer: customerData as Parameters<typeof qboCustomerSyncService.syncCustomer>[0]['customer'],
      });

      if (!customerSyncResult.success || !customerSyncResult.qboCustomerId) {
        return {
          success: false,
          error: `Failed to sync customer to QuickBooks: ${customerSyncResult.error}`,
        };
      }

      // Update customer reference with new QBO ID
      customer = {
        id: fullCustomer.id,
        qbo_customer_id: customerSyncResult.qboCustomerId,
      };

      console.log(`Customer ${customerData.name} synced to QBO with ID: ${customerSyncResult.qboCustomerId}`);
    }

    // 5. Check and auto-sync products if not synced
    const productIds = Array.from(new Set((invoice.invoice_items || []).map((item: { product_id: string }) => item.product_id)));
    const productQboIds: Record<string, string> = {};

    for (const productId of productIds) {
      // Check if product has QBO ID
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        console.error(`Product ${productId} not found`);
        continue;
      }

      if (product.qbo_item_id) {
        // Product already synced
        productQboIds[productId] = product.qbo_item_id;
      } else {
        // Product not synced - sync to QBO
        console.log(`Product ${product.sku} not synced to QBO. Auto-syncing...`);

        const productData = {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          salesDescription: product.sales_description,
          purchaseDescription: product.purchase_description,
          category: product.category,
          basePrice: product.base_price,
          baseCost: product.base_cost,
          itemType: product.item_type,
          status: product.status,
          isTaxable: product.is_taxable,
          barcode: product.barcode,
          qboIncomeAccount: product.qbo_income_account,
          qboExpenseAccount: product.qbo_expense_account,
          qboInventoryAssetAccount: product.qbo_inventory_asset_account,
          qboItemId: product.qbo_item_id,
          qboRealmId: product.qbo_realm_id,
          qboSyncedAt: product.qbo_synced_at,
          qboSyncError: product.qbo_sync_error,
        };

        const productSyncResult = await qboProductSyncService.syncProduct({
          product: productData as Parameters<typeof qboProductSyncService.syncProduct>[0]['product'],
        });

        if (productSyncResult.success && productSyncResult.qboItemId) {
          productQboIds[productId] = productSyncResult.qboItemId;
          console.log(`Product ${product.sku} synced to QBO with ID: ${productSyncResult.qboItemId}`);
        } else {
          console.error(`Failed to sync product ${product.sku} to QBO: ${productSyncResult.error}`);
          // Continue anyway - product will be created without QBO reference
        }
      }
    }

    // 6. Map invoice to QBO format
    const invoiceData: InvoiceData = {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      customerId: invoice.customer_id,
      subtotal: invoice.subtotal,
      taxTotal: invoice.tax_total,
      discountTotal: invoice.discount_total,
      grandTotal: invoice.grand_total,
      customerNotes: invoice.customer_notes,
      items: (invoice.invoice_items || []).map((item: {
        id: string;
        product_id: string;
        sku: string;
        description: string | null;
        quantity: number;
        unit_price: number;
        discount_percent: number;
        tax_rate: number;
        line_total: number;
      }) => ({
        id: item.id,
        productId: item.product_id,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        discountPercent: item.discount_percent,
        taxRate: item.tax_rate,
        lineTotal: item.line_total,
        qboItemId: productQboIds[item.product_id], // Include QBO Item ID
      })),
      customer: customer ? {
        id: customer.id,
        qboCustomerId: customer.qbo_customer_id,
      } : null,
    };

    const qboInvoice = mapInvoiceToQboFormat(invoiceData);

    // 7. Create invoice in QBO
    const result = await quickBooksProvider.createInvoice(
      qboConnection.connectionId,
      qboInvoice
    );

    if (!result.externalId) {
      await updateInvoiceSyncError(invoiceId);
      return {
        success: false,
        error: 'Failed to create invoice in QuickBooks',
      };
    }

    // 8. Update invoice with QBO data
    await updateInvoiceQboFields(invoiceId, result.externalId);

    return {
      success: true,
      qboInvoiceId: result.externalId,
    };
  } catch (error) {
    console.error('Error pushing invoice to QBO:', error);

    // Update sync error status
    await updateInvoiceSyncError(invoiceId);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to push invoice to QuickBooks',
    };
  }
}

/**
 * Check if QuickBooks is connected
 */
export async function isQuickBooksConnected(): Promise<boolean> {
  const connection = await getQboConnection();
  return connection !== null;
}
