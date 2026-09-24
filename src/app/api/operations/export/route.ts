/**
 * Operations Dashboard XLSX Export API
 *
 * Server-side route that generates XLSX with native Excel charts.
 * Uses xlsx-chart library which requires Node.js environment.
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import type { OperationsData, OperationsFilters, ShipmentStatus } from '@/features/operations-dashboard/types';
import { getOperationsData } from '@/features/operations-dashboard/services';

// ============================================
// STYLE DEFINITIONS
// ============================================

const COLORS = {
  darkBlue: 'FF1E3A5F',
  lightBlue: 'FFD6EAF8',
  mediumBlue: 'FF2E86AB',
  green: 'FF27AE60',
  orange: 'FFF39C12',
  gold: 'FFBF9000',       // Gold/mustard color like in screenshot
  red: 'FFCB4335',
  white: 'FFFFFFFF',
  lightGray: 'FFF5F5F5',
  borderGray: 'FFD5D8DC',
  textDark: 'FF2C3E50',
  textLight: 'FFFFFFFF',
};

const FONTS = {
  headerTitle: { name: 'Calibri', size: 18, bold: true, color: { argb: COLORS.textLight } },
  sectionHeader: { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.textLight } },
  kpiLabel: { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } },
  kpiValue: { name: 'Calibri', size: 24, bold: true, color: { argb: COLORS.textDark } },
  tableHeader: { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textLight } },
  tableCell: { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } },
  storyText: { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } },
};

const BORDERS: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.borderGray } },
  left: { style: 'thin', color: { argb: COLORS.borderGray } },
  bottom: { style: 'thin', color: { argb: COLORS.borderGray } },
  right: { style: 'thin', color: { argb: COLORS.borderGray } },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) { return ''; }
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function setColumnWidths(worksheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
}

function applyFill(cell: ExcelJS.Cell, color: string): void {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color },
  };
}

function mergeAndStyle(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  value: string | number,
  font: Partial<ExcelJS.Font>,
  fillColor: string,
  alignment?: Partial<ExcelJS.Alignment>
): void {
  worksheet.mergeCells(startRow, startCol, endRow, endCol);
  const cell = worksheet.getCell(startRow, startCol);
  cell.value = value;
  cell.font = font;
  applyFill(cell, fillColor);
  cell.alignment = alignment || { vertical: 'middle', horizontal: 'center' };
  cell.border = BORDERS;
}

// ============================================
// EXECUTIVE SUMMARY SHEET
// ============================================

function createExecutiveSummarySheet(
  workbook: ExcelJS.Workbook,
  data: OperationsData
): {
  skuDataRange: { start: number; end: number };
  statusDataRange: { start: number; end: number };
} {
  const ws = workbook.addWorksheet('Executive Summary');

  // Set column widths: A-H for data
  // A-D: Customer Commitments, E: gap, F-H: Shipment Status Mix
  setColumnWidths(ws, [22, 15, 15, 10, 3, 15, 10, 12]);

  let currentRow = 1;

  // ============================================
  // MAIN HEADER (spans 8 columns to match KPI section)
  // ============================================
  mergeAndStyle(
    ws, currentRow, 1, currentRow, 8,
    'Executive Summary - Galileo / GDC Inventory & Shipments',
    FONTS.headerTitle,
    COLORS.darkBlue
  );
  ws.getRow(currentRow).height = 35;
  currentRow++;

  // ============================================
  // KPI CARDS ROW (4 KPIs x 2 columns each = 8 columns)
  // ============================================
  const kpis = [
    { label: 'Available inventory qty', value: formatNumber(data.stats.availableInventoryQty) },
    { label: 'Available loads', value: formatNumber(data.stats.availableLoads) },
    { label: 'Available inventory value', value: formatCurrency(data.stats.availableInventoryValue) },
    { label: 'Committed customer qty', value: formatNumber(data.stats.committedCustomerQty) },
  ];

  // KPI Labels row - each KPI spans 2 columns
  ws.getRow(currentRow).height = 20;
  kpis.forEach((kpi, index) => {
    const col = (index * 2) + 1; // 1, 3, 5, 7
    const cell = ws.getCell(currentRow, col);
    cell.value = kpi.label;
    cell.font = FONTS.kpiLabel;
    applyFill(cell, COLORS.lightBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    ws.mergeCells(currentRow, col, currentRow, col + 1);
    // Style the second cell in merge
    const cell2 = ws.getCell(currentRow, col + 1);
    cell2.border = BORDERS;
  });
  currentRow++;

  // KPI Values row - each KPI spans 2 columns
  ws.getRow(currentRow).height = 40;
  kpis.forEach((kpi, index) => {
    const col = (index * 2) + 1; // 1, 3, 5, 7
    const cell = ws.getCell(currentRow, col);
    cell.value = kpi.value;
    cell.font = FONTS.kpiValue;
    applyFill(cell, COLORS.lightBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    ws.mergeCells(currentRow, col, currentRow, col + 1);
    // Style the second cell in merge
    const cell2 = ws.getCell(currentRow, col + 1);
    cell2.border = BORDERS;
  });
  currentRow += 2;

  // ============================================
  // SKU QUANTITY BREAKDOWN
  // ============================================

  // Section header
  mergeAndStyle(
    ws, currentRow, 1, currentRow, 5,
    'SKU QUANTITY BREAKDOWN - SUPPLIER + GDC INVENTORY',
    FONTS.sectionHeader,
    COLORS.green
  );
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const skuHeaders = ['SKU', 'Supplier Outstanding Qty', 'GDC Available Inventory', 'Combined Qty', 'Share of Combined'];
  skuHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.green);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  const skuDataStartRow = currentRow;
  data.skuBreakdown.forEach((sku, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    // Calculate total GDC inventory across all series
    const gdcTotal = Object.values(sku.gdcInventory).reduce((sum, qty) => sum + qty, 0);
    const row = [
      sku.skuName || sku.sku,
      sku.supplierOutstandingQty,
      gdcTotal,
      sku.combinedQty,
      formatPercent(sku.shareOfCombined),
    ];
    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
      cell.border = BORDERS;
      if (colIndex >= 1 && colIndex <= 3 && typeof value === 'number') {
        cell.numFmt = '#,##0';
      }
    });
    currentRow++;
  });
  const skuDataEndRow = currentRow - 1;

  currentRow += 2;

  // ============================================
  // CUSTOMER COMMITMENTS (Left side: columns 1-4)
  // SHIPMENT STATUS MIX (Right side: columns 6-8)
  // Both sections rendered side by side
  // ============================================
  const customerCommitments = data.customerCommitments || [];
  const sectionStartRow = currentRow;

  // --- LEFT SIDE: Customer Commitments (columns 1-4) ---
  mergeAndStyle(
    ws, currentRow, 1, currentRow, 4,
    'CUSTOMER COMMITMENTS / OUTSTANDING',
    FONTS.sectionHeader,
    COLORS.mediumBlue
  );
  ws.getRow(currentRow).height = 22;

  let customerEndRow = currentRow + 1;
  const customerHeaders = ['Customer', 'Outstanding Qty', 'Invoice Amount', 'Loads'];
  customerHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow + 1, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.mediumBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow + 1).height = 20;
  customerEndRow++;

  if (customerCommitments.length > 0) {
    customerCommitments.forEach((customer, index) => {
      const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
      const row = [customer.customer, customer.outstandingQty, customer.invoiceAmount, customer.loads];
      row.forEach((value, colIndex) => {
        const cell = ws.getCell(customerEndRow, colIndex + 1);
        cell.value = value;
        cell.font = FONTS.tableCell;
        applyFill(cell, rowColor);
        cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
        cell.border = BORDERS;
        if (colIndex === 1 || colIndex === 3) {
          cell.numFmt = '#,##0';
        } else if (colIndex === 2) {
          cell.numFmt = '$#,##0';
        }
      });
      customerEndRow++;
    });
  } else {
    const cell = ws.getCell(customerEndRow, 1);
    ws.mergeCells(customerEndRow, 1, customerEndRow, 4);
    cell.value = 'No customer commitments';
    cell.font = FONTS.tableCell;
    applyFill(cell, COLORS.white);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    customerEndRow++;
  }

  // --- RIGHT SIDE: Shipment Status Mix (columns 6-8) ---
  const statusColStart = 6; // Start at column F

  mergeAndStyle(
    ws, sectionStartRow, statusColStart, sectionStartRow, statusColStart + 2,
    'SHIPMENT / INVENTORY STATUS MIX',
    FONTS.sectionHeader,
    COLORS.gold
  );

  const statusHeaders = ['Status', 'Loads', 'Units'];
  statusHeaders.forEach((header, index) => {
    const cell = ws.getCell(sectionStartRow + 1, statusColStart + index);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.gold);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });

  let statusEndRow = sectionStartRow + 2;
  const statusDataStartRow = statusEndRow;
  data.shipmentStatusMix.forEach((status, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const row = [status.status.replace('_', ' '), status.loads, status.qty];
    row.forEach((value, colIndex) => {
      const cell = ws.getCell(statusEndRow, statusColStart + colIndex);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
      cell.border = BORDERS;
      if (colIndex >= 1) {
        cell.numFmt = '#,##0';
      }
    });
    statusEndRow++;
  });
  const statusDataEndRow = statusEndRow - 1;

  // Move to the next row after both sections
  currentRow = Math.max(customerEndRow, statusEndRow) + 2;

  // ============================================
  // IMMEDIATE ATTENTION - IN TRANSIT / NEXT 7 DAYS (8 columns)
  // ============================================
  const attentionItems = data.immediateAttention || [];

  mergeAndStyle(
    ws, currentRow, 1, currentRow, 8,
    'IMMEDIATE ATTENTION - IN TRANSIT / NEXT 7 DAYS',
    FONTS.sectionHeader,
    COLORS.red
  );
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const attentionHeaders = ['Load #', 'Customer', 'PO', 'Qty', 'ETA Port', 'Customer Due', 'Status', 'Action Required'];
  attentionHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.red);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  if (attentionItems.length > 0) {
    attentionItems.forEach((item, index) => {
      const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
      const row = [
        item.loadNumber,
        item.customer,
        item.po || '-',
        item.qty,
        formatDate(item.etaPort),
        formatDate(item.customerEtaDue),
        item.status.replace('_', ' '),
        item.actionRequired || '-',
      ];
      row.forEach((value, colIndex) => {
        const cell = ws.getCell(currentRow, colIndex + 1);
        cell.value = value;
        cell.font = FONTS.tableCell;
        applyFill(cell, rowColor);
        cell.alignment = { horizontal: colIndex === 3 ? 'right' : 'left', vertical: 'middle', wrapText: colIndex === 7 };
        cell.border = BORDERS;
        if (colIndex === 3) { cell.numFmt = '#,##0'; }
      });
      currentRow++;
    });
  } else {
    const cell = ws.getCell(currentRow, 1);
    ws.mergeCells(currentRow, 1, currentRow, 8);
    cell.value = 'No immediate attention items';
    cell.font = FONTS.tableCell;
    applyFill(cell, COLORS.white);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    currentRow++;
  }

  currentRow += 2;

  // ============================================
  // RIM INSTALLATION REQUIRED (Dynamic SKU columns)
  // ============================================
  if (data.rimInstallationRequired && data.rimInstallationRequired.length > 0) {
    const rimSkus = data.rimInstallationSkus || [];
    const totalColumns = Math.max(8, 4 + rimSkus.length); // Min 8 columns for consistency

    mergeAndStyle(
      ws, currentRow, 1, currentRow, totalColumns,
      'RIM INSTALLATION REQUIRED - TWS MANUFACTURER',
      FONTS.sectionHeader,
      COLORS.orange
    );
    ws.getRow(currentRow).height = 22;
    currentRow++;

    // Build dynamic headers
    const rimHeaders = ['GDC 1 No.', 'Load #', ...rimSkus.map(s => s.productName), 'Total Qty', 'Status'];
    rimHeaders.forEach((header, index) => {
      const cell = ws.getCell(currentRow, index + 1);
      cell.value = header;
      cell.font = FONTS.tableHeader;
      applyFill(cell, COLORS.orange);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = BORDERS;
    });
    ws.getRow(currentRow).height = 20;
    currentRow++;

    // Helper to get SKU quantity
    const getSkuQty = (items: { sku: string; qty: number }[], sku: string): number | string => {
      const total = items?.filter(i => i.sku === sku).reduce((sum, i) => sum + i.qty, 0) || 0;
      return total > 0 ? total : '-';
    };

    data.rimInstallationRequired.forEach((item, index) => {
      const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
      const skuQtys = rimSkus.map(s => getSkuQty(item.items, s.sku));
      const row = [
        item.gdc1No,
        item.loadNumber,
        ...skuQtys,
        item.totalQty,
        item.status.replace('_', ' '),
      ];
      row.forEach((value, colIndex) => {
        const cell = ws.getCell(currentRow, colIndex + 1);
        cell.value = value;
        cell.font = FONTS.tableCell;
        applyFill(cell, rowColor);
        const isNumeric = colIndex >= 2 && colIndex < rimHeaders.length - 1;
        cell.alignment = { horizontal: isNumeric ? 'right' : 'left', vertical: 'middle' };
        cell.border = BORDERS;
        if (isNumeric && typeof value === 'number') { cell.numFmt = '#,##0'; }
      });
      currentRow++;
    });
  }

  return {
    skuDataRange: { start: skuDataStartRow, end: skuDataEndRow },
    statusDataRange: { start: statusDataStartRow, end: statusDataEndRow },
  };
}

// ============================================
// SHIPMENT OVERVIEW SHEET
// ============================================

function createShipmentOverviewSheet(workbook: ExcelJS.Workbook, data: OperationsData): void {
  const ws = workbook.addWorksheet('Shipment Overview');
  setColumnWidths(ws, [15, 15, 15, 12, 15, 18, 15, 35]);

  let currentRow = 1;

  mergeAndStyle(ws, currentRow, 1, currentRow, 8, 'Shipment Overview', FONTS.headerTitle, COLORS.darkBlue);
  ws.getRow(currentRow).height = 35;
  currentRow++;

  // ============================================
  // FILTER FOR DROPSHIP ONLY (same as UI)
  // ============================================
  const filteredItems = (data.immediateAttention || []).filter(
    item => item.productSource === 'direct'
  );

  // Split into sections like UI
  const immediateAttentionItems = filteredItems.filter(
    item => item.status === 'IN_TRANSIT' || item.isThisWeek
  );
  const inTransitToPortItems = filteredItems.filter(
    item => item.status === 'OPEN' && !item.isThisWeek
  );

  // Calculate KPIs from filtered items (same as UI)
  const inTransitNext7Days = filteredItems.filter(
    item => item.isThisWeek || item.status === 'IN_TRANSIT'
  ).length;
  const openLoads = filteredItems.filter(item => item.status === 'OPEN').length;
  const outstandingQty = filteredItems.reduce((sum, item) => sum + item.qty, 0);

  // Derive customer summary from filtered items (same as UI)
  const customerMap = new Map<string, { customer: string; loads: number; outstandingQty: number; invoiceAmount: number; inTransitNext7Days: number }>();
  filteredItems.forEach(item => {
    const existing = customerMap.get(item.customer);
    if (existing) {
      existing.loads += 1;
      existing.outstandingQty += item.qty;
      existing.inTransitNext7Days += item.isThisWeek ? 1 : 0;
    } else {
      customerMap.set(item.customer, {
        customer: item.customer,
        loads: 1,
        outstandingQty: item.qty,
        invoiceAmount: 0,
        inTransitNext7Days: item.isThisWeek ? 1 : 0,
      });
    }
  });
  const filteredCustomerSummary = Array.from(customerMap.values()).sort((a, b) => b.loads - a.loads);

  // KPI Stats Row
  const summaryKpis = [
    { label: 'In transit / next 7 days', value: inTransitNext7Days },
    { label: 'Open loads', value: openLoads },
    { label: 'Outstanding Qty', value: outstandingQty },
    { label: 'Invoice amount', value: formatCurrency(outstandingQty * 1000) }, // Estimate like UI
  ];

  let col = 1;
  summaryKpis.forEach((kpi) => {
    ws.getCell(currentRow, col).value = kpi.label;
    ws.getCell(currentRow, col).font = FONTS.kpiLabel;
    applyFill(ws.getCell(currentRow, col), COLORS.lightBlue);
    ws.getCell(currentRow, col + 1).value = typeof kpi.value === 'number' ? kpi.value : kpi.value;
    ws.getCell(currentRow, col + 1).font = { ...FONTS.kpiValue, size: 16 };
    applyFill(ws.getCell(currentRow, col + 1), COLORS.lightBlue);
    ws.getCell(currentRow, col + 1).alignment = { horizontal: 'right' };
    col += 2;
  });
  ws.getRow(currentRow).height = 30;
  currentRow += 2;

  // ============================================
  // IMMEDIATE ATTENTION: IN TRANSIT / NEXT 7 DAYS
  // ============================================
  mergeAndStyle(ws, currentRow, 1, currentRow, 8, 'IMMEDIATE ATTENTION: IN TRANSIT / NEXT 7 DAYS', FONTS.sectionHeader, COLORS.red);
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const overviewAttentionHeaders = ['Load #', 'Customer', 'PO', 'Qty', 'ETA Port', 'Customer ETA/Due', 'Status', 'Action Required / Notes'];
  overviewAttentionHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.red);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  if (immediateAttentionItems.length > 0) {
    immediateAttentionItems.forEach((item, index) => {
      const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
      const row = [item.loadNumber, item.customer, item.po || '-', item.qty, formatDate(item.etaPort), formatDate(item.customerEtaDue), item.status.replace('_', ' '), item.actionRequired || '-'];
      row.forEach((value, colIndex) => {
        const cell = ws.getCell(currentRow, colIndex + 1);
        cell.value = value;
        cell.font = FONTS.tableCell;
        applyFill(cell, rowColor);
        cell.alignment = { horizontal: colIndex === 3 ? 'right' : 'left', vertical: 'middle', wrapText: colIndex === 7 };
        cell.border = BORDERS;
        if (colIndex === 3) { cell.numFmt = '#,##0'; }
      });
      currentRow++;
    });
  } else {
    const cell = ws.getCell(currentRow, 1);
    ws.mergeCells(currentRow, 1, currentRow, 8);
    cell.value = 'No immediate attention items';
    cell.font = FONTS.tableCell;
    applyFill(cell, COLORS.white);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    currentRow++;
  }

  currentRow += 2;

  // ============================================
  // IN TRANSIT TO PORT
  // ============================================
  mergeAndStyle(ws, currentRow, 1, currentRow, 8, 'IN TRANSIT TO PORT', FONTS.sectionHeader, COLORS.orange);
  ws.getRow(currentRow).height = 22;
  currentRow++;

  overviewAttentionHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.orange);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  if (inTransitToPortItems.length > 0) {
    inTransitToPortItems.forEach((item, index) => {
      const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
      const row = [item.loadNumber, item.customer, item.po || '-', item.qty, formatDate(item.etaPort), formatDate(item.customerEtaDue), item.status.replace('_', ' '), item.actionRequired || '-'];
      row.forEach((value, colIndex) => {
        const cell = ws.getCell(currentRow, colIndex + 1);
        cell.value = value;
        cell.font = FONTS.tableCell;
        applyFill(cell, rowColor);
        cell.alignment = { horizontal: colIndex === 3 ? 'right' : 'left', vertical: 'middle', wrapText: colIndex === 7 };
        cell.border = BORDERS;
        if (colIndex === 3) { cell.numFmt = '#,##0'; }
      });
      currentRow++;
    });
  } else {
    const cell = ws.getCell(currentRow, 1);
    ws.mergeCells(currentRow, 1, currentRow, 8);
    cell.value = 'No items in transit to port';
    cell.font = FONTS.tableCell;
    applyFill(cell, COLORS.white);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    currentRow++;
  }

  currentRow += 2;

  // ============================================
  // CUSTOMER SUMMARY (from filtered items)
  // ============================================
  mergeAndStyle(ws, currentRow, 1, currentRow, 5, 'CUSTOMER SUMMARY', FONTS.sectionHeader, COLORS.mediumBlue);
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const customerSummaryHeaders = ['Customer', 'Loads', 'Outstanding Qty', 'Invoice Amount', 'In Transit / Next 7 Days'];
  customerSummaryHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.mediumBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  if (filteredCustomerSummary.length > 0) {
    filteredCustomerSummary.forEach((customer, index) => {
      const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
      const row = [customer.customer, customer.loads, customer.outstandingQty, customer.invoiceAmount, customer.inTransitNext7Days];
      row.forEach((value, colIndex) => {
        const cell = ws.getCell(currentRow, colIndex + 1);
        cell.value = value;
        cell.font = FONTS.tableCell;
        applyFill(cell, rowColor);
        cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
        cell.border = BORDERS;
        if (colIndex === 1 || colIndex === 2 || colIndex === 4) { cell.numFmt = '#,##0'; }
        else if (colIndex === 3) { cell.numFmt = '$#,##0'; }
      });
      currentRow++;
    });

    // Total row
    const totalRow = [
      'Total',
      filteredCustomerSummary.reduce((sum, c) => sum + c.loads, 0),
      filteredCustomerSummary.reduce((sum, c) => sum + c.outstandingQty, 0),
      filteredCustomerSummary.reduce((sum, c) => sum + c.invoiceAmount, 0),
      filteredCustomerSummary.reduce((sum, c) => sum + c.inTransitNext7Days, 0),
    ];
    totalRow.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = { ...FONTS.tableCell, bold: true };
      applyFill(cell, COLORS.lightGray);
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
      cell.border = BORDERS;
      if (colIndex === 1 || colIndex === 2 || colIndex === 4) { cell.numFmt = '#,##0'; }
      else if (colIndex === 3) { cell.numFmt = '$#,##0'; }
    });
    currentRow++;
  } else {
    const cell = ws.getCell(currentRow, 1);
    ws.mergeCells(currentRow, 1, currentRow, 5);
    cell.value = 'No customer data';
    cell.font = FONTS.tableCell;
    applyFill(cell, COLORS.white);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    currentRow++;
  }
}

// ============================================
// HIDDEN: SUPPLIER SCHEDULE SHEET - per Ankur/Jenny feedback Aug 26, 2025
// ============================================

/*
function createSupplierScheduleSheet(workbook: ExcelJS.Workbook, data: OperationsData): void {
  const ws = workbook.addWorksheet('Shipment Schedule Galileo');

  // Get unique SKUs for dynamic columns
  const uniqueSkus = data.supplierScheduleSkus || [];

  // Calculate column widths dynamically
  const baseWidths = [8, 15]; // No., Load Number
  const skuQtyWidths = uniqueSkus.map(() => 12); // SKU Qty columns
  const midWidths = [10, 15, 12, 15, 20, 15, 15, 15, 12, 12, 12, 12]; // Total Qty to Invoice Amt
  const skuPriceWidths = uniqueSkus.map(() => 12); // SKU Price columns
  const endWidths = [12, 12, 12, 25, 25]; // 50% Payment, 50% Due, Status, Action, Ankur Comments
  const allWidths = [...baseWidths, ...skuQtyWidths, ...midWidths, ...skuPriceWidths, ...endWidths];
  setColumnWidths(ws, allWidths);

  let currentRow = 1;
  const totalColumns = allWidths.length;

  mergeAndStyle(ws, currentRow, 1, currentRow, totalColumns, 'Supplier Shipment Schedule - Galileo', FONTS.headerTitle, COLORS.darkBlue);
  ws.getRow(currentRow).height = 35;
  currentRow++;

  // Build headers dynamically
  const baseHeaders = ['No.', 'Load #'];
  const skuQtyHeaders = uniqueSkus.map(sku => `${sku.productName} Qty`);
  const midHeaders = ['Total Qty', 'Customer', 'PO', 'ETA to US Port', 'Delivery Address', 'Confirmed ETA', 'Customer Expected', 'Actual Delivery', 'Qty Delivered', 'Outstanding', 'Invoice #', 'Invoice Amt'];
  const skuPriceHeaders = uniqueSkus.map(sku => `${sku.productName} Price`);
  const endHeaders = ['50% Payment', '50% Due', 'Status', 'Action / Notes', 'Ankur Comments'];
  const headers = [...baseHeaders, ...skuQtyHeaders, ...midHeaders, ...skuPriceHeaders, ...endHeaders];

  headers.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.darkBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 25;
  currentRow++;

  // Helper to get quantity for a specific SKU
  const getSkuQty = (items: { sku: string; qty: number }[], sku: string): number | string => {
    const total = items?.filter(i => i.sku === sku).reduce((sum, i) => sum + i.qty, 0) || 0;
    return total > 0 ? total : '-';
  };

  // Helper to get price for a specific SKU
  const getSkuPrice = (items: { sku: string; unitPrice?: number }[], sku: string): number | string => {
    const item = items?.find(i => i.sku === sku && i.unitPrice && i.unitPrice > 0);
    return item?.unitPrice || '-';
  };

  data.supplierShipmentSchedule.forEach((item, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;

    // Build row data dynamically
    const baseRow = [item.no, item.loadNumber];
    const skuQtyRow = uniqueSkus.map(sku => getSkuQty(item.items, sku.sku));
    const midRow = [
      item.totalQty,
      item.customer || '-',
      item.po || '-',
      formatDate(item.etaToUsPort),
      item.deliveryAddress || '-',
      formatDate(item.confirmedEta),
      formatDate(item.customerExpectedDelivery),
      formatDate(item.actualDeliveryDate),
      item.qtyDelivered > 0 ? item.qtyDelivered : '-',
      item.outstandingQtyForPO > 0 ? item.outstandingQtyForPO : '-',
      item.invoiceNumber || '-',
      item.invoiceAmount || '-'
    ];
    const skuPriceRow = uniqueSkus.map(sku => getSkuPrice(item.items, sku.sku));
    const endRow = [
      formatDate(item.payment50PercentDate),
      formatDate(item.remaining50DueDate),
      item.status.replace('_', ' '),
      item.actionRequired || '-',
      item.ankurNotes || '-'
    ];
    const row = [...baseRow, ...skuQtyRow, ...midRow, ...skuPriceRow, ...endRow];

    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);

      // Calculate column positions
      const skuQtyStart = 2;
      const skuQtyEnd = skuQtyStart + uniqueSkus.length;
      const midStart = skuQtyEnd;
      const midEnd = midStart + 12;
      const skuPriceStart = midEnd;
      const skuPriceEnd = skuPriceStart + uniqueSkus.length;

      // Determine alignment
      const isNumeric = colIndex === 0 || (colIndex >= skuQtyStart && colIndex < skuQtyEnd) ||
                        colIndex === midStart || // Total Qty
                        colIndex === midStart + 8 || // Qty Delivered
                        colIndex === midStart + 9; // Outstanding
      const isCurrency = colIndex === midStart + 11 || (colIndex >= skuPriceStart && colIndex < skuPriceEnd);
      const isWrap = colIndex === midStart + 4 || colIndex >= skuPriceEnd + 3; // Delivery Address, Action/Notes, Ankur Comments

      cell.alignment = { horizontal: isNumeric || isCurrency ? 'right' : 'left', vertical: 'middle', wrapText: isWrap };
      cell.border = BORDERS;

      if (isNumeric && typeof value === 'number') { cell.numFmt = '#,##0'; }
      else if (isCurrency && typeof value === 'number') { cell.numFmt = '$#,##0'; }
    });
    currentRow++;
  });
}
*/

// ============================================
// GDC 1 INVENTORY SHEET
// ============================================

function createGDC1InventorySheet(workbook: ExcelJS.Workbook, data: OperationsData): void {
  const ws = workbook.addWorksheet('GDC 1');

  // Get unique SKUs with product names for dynamic columns
  const uniqueSkus = data.gdc1InventorySkus || [];

  // Calculate dynamic column widths
  // Base: No., Load #
  const startWidths = [8, 15];
  // SKU quantity columns (dynamic based on unique SKUs)
  const qtyWidths = uniqueSkus.map(() => 18);
  // Total Qty and rest of columns
  const midWidths = [10, 15, 12, 12, 18, 12, 12, 12, 10, 10, 12, 12];
  // Price columns for each SKU
  const priceWidths = uniqueSkus.map(() => 14);
  // End columns
  const endWidths = [12, 12, 12, 25, 25];

  setColumnWidths(ws, [...startWidths, ...qtyWidths, ...midWidths, ...priceWidths, ...endWidths]);

  let currentRow = 1;
  const totalColumns = startWidths.length + qtyWidths.length + midWidths.length + priceWidths.length + endWidths.length;

  mergeAndStyle(ws, currentRow, 1, currentRow, totalColumns, 'GDC 1 Inventory', FONTS.headerTitle, COLORS.darkBlue);
  ws.getRow(currentRow).height = 35;
  currentRow++;

  // Build dynamic headers with separate columns for each SKU quantity
  const startHeaders = ['No.', 'Load #'];
  // SKU quantity headers using product name
  const qtyHeaders = uniqueSkus.map(sku => `${sku.productName} Qty`);
  // Mid headers
  const midHeaders = ['Total Qty', 'Customer', 'PO', 'ETA Port', 'Delivery Address', 'Confirmed ETA', 'Customer Expected', 'Actual Delivery', 'Qty Del.', 'Outstanding', 'Invoice #', 'Invoice Amt'];
  // Price headers
  const priceHeaders = uniqueSkus.map(sku => `${sku.productName} Price`);
  // End headers
  const endHeaders = ['50% Payment', '50% Due', 'Status', 'Action / Notes', 'Ankur Comments'];

  const headers = [...startHeaders, ...qtyHeaders, ...midHeaders, ...priceHeaders, ...endHeaders];

  headers.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.darkBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 25;
  currentRow++;

  // Calculate column index ranges for formatting
  const qtyColStart = startHeaders.length;
  const qtyColEnd = qtyColStart + uniqueSkus.length;
  const totalQtyColIndex = qtyColEnd;
  const priceColStart = startHeaders.length + qtyHeaders.length + midHeaders.length;
  const priceColEnd = priceColStart + uniqueSkus.length;
  const deliveryAddressColIndex = qtyColEnd + 4; // Delivery Address column
  const notesColStart = priceColEnd + 3; // Action/Notes and Ankur Comments

  data.gdc1Inventory.forEach((item, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;

    // Build start columns
    const startRow = [
      item.no,
      item.loadNumber,
    ];

    // Build dynamic SKU quantity columns
    const qtyRow = uniqueSkus.map(skuInfo => {
      const skuItem = item.items.find(i => i.sku === skuInfo.sku);
      return skuItem?.qty || '-';
    });

    // Build mid columns
    const midRow = [
      item.totalQty,
      item.customer || '',
      item.po || '',
      formatDate(item.etaToUsPort),
      item.deliveryAddress || '',
      formatDate(item.confirmedEta),
      formatDate(item.customerExpectedDelivery),
      formatDate(item.actualDelivery),
      item.qtyDelivered,
      item.outstandingPoQty,
      item.invoiceNumber || '',
      item.invoiceAmount
    ];

    // Build dynamic price columns
    const priceRow = uniqueSkus.map(skuInfo => {
      const skuItem = item.items.find(i => i.sku === skuInfo.sku);
      return skuItem?.unitPrice || '';
    });

    // Build end columns
    const endRow = [
      formatDate(item.payment50PercentDate),
      formatDate(item.remaining50DueDate),
      item.status.replace('_', ' '),
      item.actionRequired,
      item.ankurNotes
    ];

    const row = [...startRow, ...qtyRow, ...midRow, ...priceRow, ...endRow];

    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);

      // Determine formatting based on column type
      const isQtyCol = colIndex >= qtyColStart && colIndex < qtyColEnd;
      const isTotalQtyCol = colIndex === totalQtyColIndex;
      const isNumericCol = colIndex === 0 || isQtyCol || isTotalQtyCol || colIndex === qtyColEnd + 8 || colIndex === qtyColEnd + 9; // No., Qty cols, Qty Del., Outstanding
      const isCurrencyCol = colIndex === qtyColEnd + 11 || (colIndex >= priceColStart && colIndex < priceColEnd); // Invoice Amt, Price cols
      const isWrapCol = colIndex === deliveryAddressColIndex || colIndex >= notesColStart;

      cell.alignment = {
        horizontal: isNumericCol || isCurrencyCol ? 'right' : 'left',
        vertical: 'middle',
        wrapText: isWrapCol
      };
      cell.border = BORDERS;

      if (isNumericCol && value !== '-') { cell.numFmt = '#,##0'; }
      else if (isCurrencyCol) { cell.numFmt = '$#,##0'; }
    });
    currentRow++;
  });
}

// ============================================
// API ROUTE HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const exportType = searchParams.get('type') || 'all';

    // Extract filters from query params
    const filters: OperationsFilters = {};
    const customerId = searchParams.get('customerId');
    const productId = searchParams.get('productId');
    const status = searchParams.get('status');
    const salesOrderId = searchParams.get('salesOrderId');
    const customerPoNumber = searchParams.get('customerPoNumber');

    if (customerId) filters.customerId = customerId;
    if (productId) filters.productId = productId;
    if (status) filters.status = status as ShipmentStatus;
    if (salesOrderId) filters.salesOrderId = salesOrderId;
    if (customerPoNumber) filters.customerPoNumber = customerPoNumber;

    // Fetch operations data with filters
    const data = await getOperationsData(Object.keys(filters).length > 0 ? filters : undefined);

    // Debug: Log all data for verification
    console.log('=== EXPORT DEBUG ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('');
    console.log('--- Immediate Attention ---');
    console.log('Total items:', data.immediateAttention?.length || 0);
    data.immediateAttention?.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.loadNumber} | ${item.customer} | ${item.status} | productSource: ${item.productSource} | isThisWeek: ${item.isThisWeek}`);
    });
    console.log('');
    console.log('--- Supplier Schedule (Dropship) ---');
    console.log('Total items:', data.supplierShipmentSchedule?.length || 0);
    data.supplierShipmentSchedule?.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.loadNumber} | ${item.customer} | ${item.status}`);
    });
    console.log('');
    console.log('--- GDC 1 Inventory (Warehouse) ---');
    console.log('Total items:', data.gdc1Inventory?.length || 0);
    data.gdc1Inventory?.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.loadNumber} | ${item.customer} | ${item.status}`);
    });
    console.log('===================');

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gesher Distribution';
    workbook.created = new Date();

    // Create sheets based on export type
    if (exportType === 'all' || exportType === 'executive-summary') {
      createExecutiveSummarySheet(workbook, data);
    }

    if (exportType === 'all' || exportType === 'shipment-overview') {
      createShipmentOverviewSheet(workbook, data);
    }

    // HIDDEN: Supplier Schedule sheet - per Ankur/Jenny feedback Aug 26, 2025
    // if (exportType === 'all' || exportType === 'supplier-schedule') {
    //   createSupplierScheduleSheet(workbook, data);
    // }

    if (exportType === 'all' || exportType === 'gdc1-inventory') {
      createGDC1InventorySheet(workbook, data);
    }

    // Generate buffer
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // Note: Chart injection is disabled because Google Sheets has limited support
    // for OOXML embedded charts. Users can create charts manually from the data tables.

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = exportType === 'all'
      ? `operations-dashboard-${dateStr}.xlsx`
      : `${exportType}-${dateStr}.xlsx`;

    // Return response with XLSX file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}
