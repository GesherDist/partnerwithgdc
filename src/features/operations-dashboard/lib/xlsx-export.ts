/**
 * Operations Dashboard XLSX Export Utility
 *
 * Client-side wrapper that calls the server API to generate
 * professional Excel workbooks with native Excel charts.
 */

import type { OperationsData, OperationsFilters } from '../types';

// ============================================
// TYPES
// ============================================

export interface XLSXExportOptions {
  filename?: string;
  includeTimestamp?: boolean;
}

export type XLSXExportType =
  | 'executive-summary'
  | 'shipment-overview'
  | 'supplier-schedule'
  | 'gdc1-inventory'
  | 'all';

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

/**
 * Export operations data to XLSX with native Excel charts.
 * Uses server-side API for chart generation.
 * Accepts optional filters to export filtered data.
 */
export async function exportToXLSX(type: XLSXExportType, _data: OperationsData, filters?: OperationsFilters): Promise<void> {
  try {
    // Build query params with filters
    const params = new URLSearchParams({ type });
    if (filters?.customerId) params.append('customerId', filters.customerId);
    if (filters?.productId) params.append('productId', filters.productId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.salesOrderId) params.append('salesOrderId', filters.salesOrderId);
    if (filters?.customerPoNumber) params.append('customerPoNumber', filters.customerPoNumber);

    const response = await fetch(`/api/operations/export?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Export failed');
    }

    // Get the blob from response
    const blob = await response.blob();

    // Get filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `operations-${type}-${new Date().toISOString().split('T')[0]}.xlsx`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    // Download the file
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}
