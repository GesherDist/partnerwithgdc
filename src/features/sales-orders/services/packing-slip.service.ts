/**
 * Packing Slip Service (Nov 19 2026)
 *
 * Builds and renders the packing slip of one sales order (Jenny / Ankur,
 * Nov 19 2026): Gesher header, ship-to, customer PO, container numbers,
 * products with quantity and net weight, signature boxes. No prices.
 *
 * - Lines: the order's products; services and non-inventory lines without a
 *   tire size (e.g. sales commission) are left out ("-DIRECT" tires stay).
 *   Quantity = customer quantity.
 * - Net weight: products.weight_lbs per unit (blank when not set).
 * - Pallets (Jenny's table, Nov 19 2026): per line ceil(quantity / units per
 *   pallet); gross weight = net weight + pallets x pallet weight
 *   (products.units_per_pallet / pallet_weight_lbs, migration 176).
 * - Containers: shipments linked to the order, plus shipments of the POs its
 *   items are allocated to (manufacturer direct).
 * - Allocations: where each line is fulfilled from (GDC inventory + warehouse,
 *   dealer, manufacturer + PO, container). Shown when no container is found
 *   (e.g. warehouse orders), so the slip still says where the goods come from.
 *
 * The caller checks the user's access to the order first. Read-only.
 */

import { db } from '@/shared/lib/supabase/database';
import { htmlToPdfBase64 } from '@/shared/lib/pdf';

import { FULFILLMENT_SOURCE_LABELS, type FulfillmentSource, type SalesOrderWithItems } from '../types';
import { generatePackingSlipHtml, type PackingSlipPdfData } from './packing-slip-template';

/**
 * Lines left off the slip: services (e.g. sales commission), and non-inventory
 * products without a tire size. The manufacturer-direct tires ("-DIRECT" SKUs)
 * are non-inventory but have a tire size, so they stay on the slip.
 */
function isPackedProduct(product: PackingProduct | undefined): boolean {
  if (!product?.itemType) {
    return true;
  }
  if (product.itemType === 'service') {
    return false;
  }
  if (product.itemType === 'non_inventory') {
    return Boolean(product.tireSize);
  }
  return true;
}

type PackingProduct = {
  itemType: string | null;
  tireSize: string | null;
  /** Packing slip line description (e.g. "290/85R38CW Assembled tire - 8 Holes") */
  shortDescription: string | null;
  weightLbs: number | null;
  unitsPerPallet: number | null;
  palletWeightLbs: number | null;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

async function loadProducts(productIds: string[]) {
  const products = new Map<string, PackingProduct>();
  if (productIds.length === 0) {
    return products;
  }
  // Pallet columns come with migration 176; without them the slip still prints (no pallets)
  let result = await db
    .from('products')
    .select('id, item_type, tire_size, short_description, weight_lbs, units_per_pallet, pallet_weight_lbs')
    .in('id', productIds);
  if (result.error && /units_per_pallet|pallet_weight_lbs/.test(`${result.error.message ?? ''} ${result.error.details ?? ''}`)) {
    console.warn('[PackingSlip] Pallet columns missing (run migration 176); pallets left blank');
    result = (await db
      .from('products')
      .select('id, item_type, tire_size, short_description, weight_lbs')
      .in('id', productIds)) as typeof result;
  }
  if (result.error) {
    throw new Error(`Failed to load products: ${result.error.message}`);
  }
  for (const row of (result.data ?? []) as Array<Record<string, unknown>>) {
    const weight = toNumber(row.weight_lbs);
    const units = toNumber(row.units_per_pallet);
    const palletWeight = toNumber(row.pallet_weight_lbs);
    products.set(String(row.id), {
      itemType: row.item_type ? String(row.item_type) : null,
      tireSize: row.tire_size && String(row.tire_size).trim() ? String(row.tire_size).trim() : null,
      shortDescription: row.short_description && String(row.short_description).trim() ? String(row.short_description).trim() : null,
      weightLbs: weight !== null && weight > 0 ? weight : null,
      unitsPerPallet: units !== null && units > 0 ? Math.floor(units) : null,
      palletWeightLbs: palletWeight !== null && palletWeight >= 0 ? palletWeight : null,
    });
  }
  return products;
}

/** Container numbers and shipping numbers of the order's shipments */
async function loadShipments(orderId: string, itemIds: string[]): Promise<{ containers: string[]; shippingNumbers: string[] }> {
  // POs the order's items are allocated to (manufacturer direct)
  let poIds: string[] = [];
  if (itemIds.length > 0) {
    const { data, error } = await db
      .from('fulfillment_allocations')
      .select('purchase_order_id')
      .in('sales_order_item_id', itemIds)
      .neq('status', 'cancelled')
      .not('purchase_order_id', 'is', null);
    if (error) {
      throw new Error(`Failed to load allocations: ${error.message}`);
    }
    poIds = [...new Set((data ?? []).map((row) => String(row.purchase_order_id)))];
  }

  // Shipments whose lines point at the order's items
  let itemShipmentIds: string[] = [];
  if (itemIds.length > 0) {
    const { data, error } = await db
      .from('shipment_items')
      .select('shipment_id')
      .in('sales_order_item_id', itemIds);
    if (error) {
      throw new Error(`Failed to load shipment items: ${error.message}`);
    }
    itemShipmentIds = [...new Set((data ?? []).map((row) => String(row.shipment_id)).filter(Boolean))];
  }

  const filters = [`sales_order_id.eq.${orderId}`];
  if (poIds.length > 0) {
    filters.push(`purchase_order_id.in.(${poIds.join(',')})`);
  }
  if (itemShipmentIds.length > 0) {
    filters.push(`id.in.(${itemShipmentIds.join(',')})`);
  }
  const filter = filters.join(',');
  const { data: shipments, error } = await db
    .from('shipments')
    .select('container_number, supplier_reference_number, shipment_number')
    .is('deleted_at', null)
    .or(filter);
  if (error) {
    throw new Error(`Failed to load shipments: ${error.message}`);
  }

  const containers = new Set<string>();
  const shippingNumbers = new Set<string>();
  for (const row of shipments ?? []) {
    const container = row.container_number ? String(row.container_number).trim() : '';
    if (container) {
      containers.add(container.toUpperCase());
    }
    // Shipment SO number (Operations Dashboard "Load #"), else the shipment number
    const shippingNumber = String(row.supplier_reference_number || row.shipment_number || '').trim();
    if (shippingNumber) {
      shippingNumbers.add(shippingNumber);
    }
  }
  return { containers: [...containers].sort(), shippingNumbers: [...shippingNumbers].sort() };
}

/**
 * "Shipped from" text per order item, from its active allocations, e.g.
 * "GDC Inventory - MWI Warehouse" or "Manufacturer/Supplier - PO-2600039 - container ABCU1234567".
 * Optional on the slip: on a load error the slip prints without it.
 */
async function loadAllocationSources(itemIds: string[]): Promise<Map<string, string[]>> {
  const sources = new Map<string, string[]>();
  if (itemIds.length === 0) {
    return sources;
  }
  try {
    const { data: rows, error } = await db
      .from('fulfillment_allocations')
      .select('sales_order_item_id, fulfillment_source, quantity, container_id, location_id, platinum_dealer_id, dealer_location_id, purchase_order_id')
      .in('sales_order_item_id', itemIds)
      .neq('status', 'cancelled');
    if (error) {
      throw new Error(error.message);
    }
    const allocations = rows ?? [];
    const idsOf = (key: string) => [...new Set(allocations.map((row) => row[key as keyof typeof row]).filter(Boolean).map(String))];

    const nameMap = async (table: string, column: string, ids: string[]): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      if (ids.length === 0) {
        return map;
      }
      const { data } = await db.from(table).select(`id, ${column}`).in('id', ids);
      for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        if (row[column]) {
          map.set(String(row.id), String(row[column]));
        }
      }
      return map;
    };
    const [locations, dealers, dealerLocations, pos] = await Promise.all([
      nameMap('locations', 'name', idsOf('location_id')),
      nameMap('platinum_dealers', 'dealer_name', idsOf('platinum_dealer_id')),
      nameMap('platinum_dealer_locations', 'location_name', idsOf('dealer_location_id')),
      nameMap('purchase_orders', 'po_number', idsOf('purchase_order_id')),
    ]);

    for (const row of allocations) {
      const label = FULFILLMENT_SOURCE_LABELS[row.fulfillment_source as FulfillmentSource] || String(row.fulfillment_source || '');
      const parts = [
        label,
        row.location_id ? locations.get(String(row.location_id)) : null,
        row.platinum_dealer_id ? dealers.get(String(row.platinum_dealer_id)) : null,
        row.dealer_location_id ? dealerLocations.get(String(row.dealer_location_id)) : null,
        row.purchase_order_id ? pos.get(String(row.purchase_order_id)) : null,
        row.container_id ? `container ${String(row.container_id).trim().toUpperCase()}` : null,
      ].filter((part): part is string => Boolean(part && part.trim()));
      const text = `${parts.join(' - ')} (${Number(row.quantity || 0)} units)`;
      const key = String(row.sales_order_item_id);
      sources.set(key, [...(sources.get(key) ?? []), text]);
    }
  } catch (error) {
    console.error('[PackingSlip] Failed to load allocations:', error);
  }
  return sources;
}

/** Customer's payment terms (customers.credit_terms, e.g. "Net 30"); null if not set */
async function loadPaymentTerms(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) {
    return null;
  }
  const { data, error } = await db
    .from('customers')
    .select('credit_terms')
    .eq('id', customerId)
    .maybeSingle();
  if (error) {
    // Optional line on the slip: print without it
    console.error('[PackingSlip] Failed to load payment terms:', error.message);
    return null;
  }
  const terms = data?.credit_terms ? String(data.credit_terms).trim() : '';
  return terms || null;
}

/**
 * Sales Rep line: name of the user who created the quote the order came from,
 * else of the user who created the order. Null when neither is known.
 */
async function loadCreatorName(orderId: string): Promise<string | null> {
  try {
    const { data: orderRow } = await db
      .from('sales_orders')
      .select('quote_id, created_by')
      .eq('id', orderId)
      .maybeSingle();

    let userId: string | null = null;
    if (orderRow?.quote_id) {
      const { data: quoteRow } = await db
        .from('quotes')
        .select('created_by')
        .eq('id', orderRow.quote_id)
        .maybeSingle();
      userId = quoteRow?.created_by ?? null;
    }
    userId = userId ?? orderRow?.created_by ?? null;
    if (!userId) {
      return null;
    }

    const { data: user } = await db
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .maybeSingle();
    if (!user) {
      return null;
    }
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || null;
  } catch (error) {
    // Optional line on the slip: print without it
    console.error('[PackingSlip] Failed to load creator name:', error);
    return null;
  }
}

/**
 * Cust. Company Number line: the customer company's phone number, else the
 * phone (or mobile) of the customer's primary contact. Null when none is set.
 */
async function loadCompanyNumber(customerId: string | null | undefined, companyPhone: string | null): Promise<string | null> {
  if (companyPhone && companyPhone.trim()) {
    return companyPhone.trim();
  }
  if (!customerId) {
    return null;
  }
  // select('*'): the live table has no is_primary column (Nov 20 2026), so the
  // primary contact is found from whichever flag the row has
  const { data, error } = await db
    .from('customer_contacts')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[PackingSlip] Failed to load customer contacts:', error.message);
    return null;
  }
  const contacts = (data ?? []) as Array<Record<string, unknown>>;
  const isPrimary = (contact: Record<string, unknown>) => contact.is_primary === true || contact.contact_type === 'primary';
  const ordered = [...contacts.filter(isPrimary), ...contacts.filter((contact) => !isPrimary(contact))];
  for (const contact of ordered) {
    const number = String(contact.phone || contact.mobile || '').trim();
    if (number) {
      return number;
    }
  }
  return null;
}

export async function buildPackingSlipData(order: SalesOrderWithItems): Promise<PackingSlipPdfData> {
  const productIds = [...new Set(order.items.map((item) => item.productId).filter(Boolean))];
  const customerId = order.customer?.id ?? order.customerId;
  const [products, shipmentInfo, paymentTerms, creatorName, companyNumber, allocationSources] = await Promise.all([
    loadProducts(productIds),
    loadShipments(order.id, order.items.map((item) => item.id)),
    loadPaymentTerms(customerId),
    loadCreatorName(order.id),
    loadCompanyNumber(customerId, order.customer?.phone ?? null),
    loadAllocationSources(order.items.map((item) => item.id)),
  ]);

  const packedItems = order.items.filter((item) => isPackedProduct(products.get(item.productId)));

  const shipToLines = [
    order.shippingAddressStreet,
    [order.shippingAddressCity, [order.shippingAddressState, order.shippingAddressPostalCode].filter(Boolean).join(' ')]
      .filter((part) => part && String(part).trim())
      .join(', '),
    order.shippingAddressCountry,
  ].filter((line): line is string => Boolean(line && String(line).trim()));

  // Creator of the quote / order; the assigned sales rep only if no creator is known
  const assignedRep = order.salesRep
    ? `${order.salesRep.firstName || ''} ${order.salesRep.lastName || ''}`.trim() || order.salesRep.email || null
    : null;
  const salesRepName = creatorName ?? assignedRep;

  return {
    shippingNumber: shipmentInfo.shippingNumbers.length > 0 ? shipmentInfo.shippingNumbers.join(', ') : order.orderNumber,
    documentNumber: order.orderNumber,
    salesOrderNumber: order.orderNumber,
    customerName: order.customer?.name || 'Unknown Customer',
    customerCode: order.customer?.customerCode || null,
    customerPhone: order.customer?.phone || null,
    companyNumber,
    customerPoNumber: order.customerPoNumber ?? null,
    shipToLines,
    paymentTerms,
    salesRepName,
    containers: shipmentInfo.containers,
    items: packedItems.map((item, index) => ({
      rowNum: index + 1,
      sku: item.sku,
      description: products.get(item.productId)?.shortDescription || item.description || item.sku,
      sizeLabel: products.get(item.productId)?.tireSize || item.sku,
      shippedFrom: allocationSources.get(item.id) ?? [],
      quantity: Number(item.customerQty || item.quantity || 0),
      unitWeight: products.get(item.productId)?.weightLbs ?? null,
      unitsPerPallet: products.get(item.productId)?.unitsPerPallet ?? null,
      palletWeight: products.get(item.productId)?.palletWeightLbs ?? null,
    })),
    weightUnit: 'lbs',
    printedAt: new Date().toISOString(),
  };
}

/** Packing slip of the order as a base64 PDF */
export async function generatePackingSlipPdf(order: SalesOrderWithItems): Promise<string> {
  const data = await buildPackingSlipData(order);
  return htmlToPdfBase64(generatePackingSlipHtml(data));
}
