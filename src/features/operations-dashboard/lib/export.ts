/**
 * Operations Dashboard Export Utilities
 *
 * Export dashboard data to Excel/CSV format.
 */

import type {
  OperationsData,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  CustomerCommitment,
  ImmediateAttentionItem,
  SKUBreakdown,
} from '../types';

// ============================================
// CSV HELPER FUNCTIONS
// ============================================

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert array of objects to CSV string
 */
function toCSV<T extends Record<string, unknown>>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  const headerRow = headers.map((h) => escapeCSV(h.label)).join(',');
  const dataRows = data.map((row) =>
    headers.map((h) => escapeCSV(row[h.key] as string | number | null)).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Format items array as a readable string for CSV export
 */
function formatItemsForExport(items: { sku: string; qty: number }[] | undefined): string {
  if (!items || items.length === 0) {
    return '';
  }
  return items.map(item => `${item.sku}: ${item.qty}`).join('; ');
}

/**
 * Export Supplier Shipment Schedule to CSV
 */
export function exportSupplierSchedule(data: ShipmentScheduleItem[]): void {
  // Transform data to include items as a string
  const transformedData = data.map(item => ({
    ...item,
    itemsDisplay: formatItemsForExport(item.items),
  }));

  const headers: { key: keyof typeof transformedData[0]; label: string }[] = [
    { key: 'no', label: 'No.' },
    { key: 'loadNumber', label: 'Load Number' },
    { key: 'itemsDisplay', label: 'Items' },
    { key: 'totalQty', label: 'Total Qty' },
    { key: 'customer', label: 'Customer' },
    { key: 'po', label: 'PO' },
    { key: 'etaToUsPort', label: 'ETA to US Port' },
    { key: 'confirmedEta', label: 'Confirmed ETA' },
    { key: 'customerExpectedDelivery', label: 'Customer Expected Delivery' },
    { key: 'actualDeliveryDate', label: 'Actual Delivery Date' },
    { key: 'qtyDelivered', label: 'Qty Delivered' },
    { key: 'outstandingQtyForPO', label: 'Outstanding Qty' },
    { key: 'deliveryAddress', label: 'Delivery Address' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required' },
  ];

  const csv = toCSV(transformedData, headers);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `supplier-shipment-schedule-${date}.csv`);
}

/**
 * Export GDC1 Inventory to CSV
 */
export function exportGDC1Inventory(data: GDC1InventoryItem[]): void {
  // Transform data to include items as a string
  const transformedData = data.map(item => ({
    ...item,
    itemsDisplay: formatItemsForExport(item.items),
  }));

  const headers: { key: keyof typeof transformedData[0]; label: string }[] = [
    { key: 'no', label: 'No.' },
    { key: 'loadNumber', label: 'Load Number' },
    { key: 'itemsDisplay', label: 'Items' },
    { key: 'totalQty', label: 'Total Qty' },
    { key: 'customer', label: 'Customer' },
    { key: 'po', label: 'PO' },
    { key: 'etaToUsPort', label: 'ETA to US Port' },
    { key: 'deliveryAddress', label: 'Delivery Address' },
    { key: 'confirmedEta', label: 'Confirmed ETA' },
    { key: 'customerExpectedDelivery', label: 'Customer Expected Delivery' },
    { key: 'actualDelivery', label: 'Actual Delivery' },
    { key: 'qtyDelivered', label: 'Qty Delivered' },
    { key: 'outstandingPoQty', label: 'Outstanding Qty' },
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'invoiceAmount', label: 'Invoice Amount' },
    { key: 'payment50PercentDate', label: '50% Payment Date' },
    { key: 'remaining50DueDate', label: 'Remaining 50% Due' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required' },
    { key: 'ankurNotes', label: 'Ankur Comments' },
  ];

  const csv = toCSV(transformedData, headers);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `gdc1-inventory-${date}.csv`);
}

/**
 * Export Customer Commitments to CSV
 */
export function exportCustomerCommitments(data: CustomerCommitment[]): void {
  const headers: { key: keyof CustomerCommitment; label: string }[] = [
    { key: 'customer', label: 'Customer' },
    { key: 'loads', label: 'Loads' },
    { key: 'outstandingQty', label: 'Outstanding Qty' },
    { key: 'invoiceAmount', label: 'Invoice Amount' },
    { key: 'inTransitNext7Days', label: 'In Transit Next 7 Days' },
  ];

  const csv = toCSV(data as unknown as Record<string, unknown>[], headers as { key: string; label: string }[]);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `customer-commitments-${date}.csv`);
}

/**
 * Export Immediate Attention Items to CSV
 */
export function exportImmediateAttention(data: ImmediateAttentionItem[]): void {
  const headers: { key: keyof ImmediateAttentionItem; label: string }[] = [
    { key: 'loadNumber', label: 'Load Number' },
    { key: 'customer', label: 'Customer' },
    { key: 'po', label: 'PO' },
    { key: 'qty', label: 'Qty' },
    { key: 'etaPort', label: 'ETA Port' },
    { key: 'customerEtaDue', label: 'Customer ETA Due' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required' },
    { key: 'isOverdue', label: 'Overdue' },
    { key: 'isThisWeek', label: 'This Week' },
  ];

  const csv = toCSV(data as unknown as Record<string, unknown>[], headers as { key: string; label: string }[]);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `immediate-attention-${date}.csv`);
}

/**
 * Export SKU Breakdown to CSV
 */
export function exportSKUBreakdown(data: SKUBreakdown[]): void {
  // Transform data to include calculated GDC total
  const transformedData = data.map((sku) => ({
    skuName: sku.skuName,
    supplierOutstandingQty: sku.supplierOutstandingQty,
    gdcTotal: Object.values(sku.gdcInventory).reduce((sum, qty) => sum + qty, 0),
    combinedQty: sku.combinedQty,
    shareOfCombined: sku.shareOfCombined,
  }));

  const headers: { key: keyof typeof transformedData[0]; label: string }[] = [
    { key: 'skuName', label: 'SKU' },
    { key: 'supplierOutstandingQty', label: 'Supplier Outstanding' },
    { key: 'gdcTotal', label: 'GDC Total Available' },
    { key: 'combinedQty', label: 'Combined Qty' },
    { key: 'shareOfCombined', label: 'Share %' },
  ];

  const csv = toCSV(transformedData as unknown as Record<string, unknown>[], headers as { key: string; label: string }[]);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `sku-breakdown-${date}.csv`);
}

/**
 * Export Executive Summary to CSV
 * Includes: Immediate Attention, SKU Breakdown, Customer Commitments
 */
export function exportExecutiveSummary(data: OperationsData): void {
  // Export immediate attention first
  exportImmediateAttention(data.immediateAttention);

  // Slight delays to avoid browser blocking multiple downloads
  setTimeout(() => {
    exportSKUBreakdown(data.skuBreakdown);
  }, 300);

  setTimeout(() => {
    exportCustomerCommitments(data.customerCommitments);
  }, 600);
}

/**
 * Export Shipment Overview to CSV
 * Includes: In-Transit items and Customer Summary
 */
export function exportShipmentOverview(data: OperationsData): void {
  // Transform in-transit items with all relevant fields
  const shipmentOverviewData = data.immediateAttention.map((item, index) => ({
    no: index + 1,
    loadNumber: item.loadNumber,
    customer: item.customer,
    po: item.po,
    qty: item.qty,
    etaPort: item.etaPort,
    customerEtaDue: item.customerEtaDue,
    status: item.status,
    actionRequired: item.actionRequired,
    isOverdue: item.isOverdue ? 'Yes' : 'No',
    isThisWeek: item.isThisWeek ? 'Yes' : 'No',
  }));

  const headers: { key: keyof typeof shipmentOverviewData[0]; label: string }[] = [
    { key: 'no', label: 'No.' },
    { key: 'loadNumber', label: 'Load #' },
    { key: 'customer', label: 'Customer' },
    { key: 'po', label: 'PO' },
    { key: 'qty', label: 'Qty' },
    { key: 'etaPort', label: 'ETA Port' },
    { key: 'customerEtaDue', label: 'Customer ETA/Due' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required / Notes' },
    { key: 'isOverdue', label: 'Overdue' },
    { key: 'isThisWeek', label: 'This Week' },
  ];

  const csv = toCSV(shipmentOverviewData, headers);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `shipment-overview-${date}.csv`);

  // Also export customer commitments
  setTimeout(() => {
    exportCustomerCommitments(data.customerCommitments);
  }, 300);
}

/**
 * Export all data to multiple CSV files
 * Downloads 4 CSVs: Executive Summary components, Shipment Overview, Supplier Schedule, GDC1 Inventory
 */
export function exportAllData(data: OperationsData): void {
  // Export immediate attention
  exportImmediateAttention(data.immediateAttention);

  // Staggered downloads to avoid browser blocking
  setTimeout(() => {
    exportSKUBreakdown(data.skuBreakdown);
  }, 300);

  setTimeout(() => {
    exportCustomerCommitments(data.customerCommitments);
  }, 600);

  setTimeout(() => {
    exportSupplierSchedule(data.supplierShipmentSchedule);
  }, 900);

  setTimeout(() => {
    exportGDC1Inventory(data.gdc1Inventory);
  }, 1200);
}

/**
 * Export options dialog helper
 */
export type ExportType =
  | 'executive-summary'
  | 'shipment-overview'
  | 'supplier-schedule'
  | 'gdc1-inventory'
  | 'customer-commitments'
  | 'immediate-attention'
  | 'sku-breakdown'
  | 'all';

export function exportByType(type: ExportType, data: OperationsData): void {
  switch (type) {
    case 'executive-summary':
      exportExecutiveSummary(data);
      break;
    case 'shipment-overview':
      exportShipmentOverview(data);
      break;
    case 'supplier-schedule':
      exportSupplierSchedule(data.supplierShipmentSchedule);
      break;
    case 'gdc1-inventory':
      exportGDC1Inventory(data.gdc1Inventory);
      break;
    case 'customer-commitments':
      exportCustomerCommitments(data.customerCommitments);
      break;
    case 'immediate-attention':
      exportImmediateAttention(data.immediateAttention);
      break;
    case 'sku-breakdown':
      exportSKUBreakdown(data.skuBreakdown);
      break;
    case 'all':
      exportAllData(data);
      break;
  }
}
