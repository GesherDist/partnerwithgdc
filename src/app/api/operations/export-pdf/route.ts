/**
 * Operations Dashboard PDF Export API
 *
 * Server-side route that generates professional PDF reports
 * matching the web dashboard UI styling exactly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OperationsData, OperationsFilters, ShipmentStatus } from '@/features/operations-dashboard/types';
import { getOperationsData } from '@/features/operations-dashboard/services';

// ============================================
// COLOR DEFINITIONS - Exact Tailwind Colors
// ============================================

const COLORS = {
  // Icon Colors
  teal500: [20, 184, 166] as [number, number, number],
  emerald500: [16, 185, 129] as [number, number, number],
  violet500: [139, 92, 246] as [number, number, number],
  amber500: [245, 158, 11] as [number, number, number],
  red500: [239, 68, 68] as [number, number, number],

  // Status Colors
  orange400: [251, 146, 60] as [number, number, number],
  red400: [248, 113, 113] as [number, number, number],
  purple500: [168, 85, 247] as [number, number, number],
  green400: [74, 222, 128] as [number, number, number],

  // UI Colors
  white: [255, 255, 255] as [number, number, number],
  gray50: [249, 250, 251] as [number, number, number],
  gray100: [243, 244, 246] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray300: [209, 213, 219] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray700: [55, 65, 81] as [number, number, number],
  gray900: [17, 24, 39] as [number, number, number],

  // Alert Colors
  blue50: [239, 246, 255] as [number, number, number],
  blue200: [191, 219, 254] as [number, number, number],
  blue600: [37, 99, 235] as [number, number, number],
  blue700: [29, 78, 216] as [number, number, number],

  // Text Colors
  emerald600: [5, 150, 105] as [number, number, number],
  teal600: [13, 148, 136] as [number, number, number],
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
  if (!dateStr) { return '-'; }
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ============================================
// PDF GENERATION
// ============================================

async function generatePDF(data: OperationsData): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // ============================================
  // PAGE 1: EXECUTIVE SUMMARY
  // ============================================

  // White background
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  let currentY = margin;

  // === HEADER ===
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text('Operations Dashboard', margin, currentY + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray500);
  doc.text('Supplier & GDC Inventory & Shipments', margin, currentY + 11);

  doc.setFontSize(7);
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  doc.text(`Last updated: ${dateStr}`, margin, currentY + 16);

  currentY += 22;

  // === KPI CARDS ===
  const kpiGap = 5;
  const kpiWidth = (contentWidth - kpiGap * 4) / 5;
  const kpiHeight = 28;

  const kpis = [
    { title: 'Available Inventory', value: formatNumber(data.stats.availableInventoryQty), subtitle: 'units', color: COLORS.teal500 },
    { title: 'Available Loads', value: formatNumber(data.stats.availableLoads), subtitle: 'loads', color: COLORS.emerald500 },
    { title: 'Inventory Value', value: formatCurrency(data.stats.availableInventoryValue), subtitle: '', color: COLORS.violet500 },
    { title: 'Customer Committed', value: formatNumber(data.stats.committedCustomerQty), subtitle: 'units', color: COLORS.amber500 },
    { title: 'In Transit / Next 7 Days', value: formatNumber(data.stats.inTransitNext7Days), subtitle: 'loads', color: COLORS.red500, highlight: true },
  ];

  kpis.forEach((kpi, index) => {
    const x = margin + index * (kpiWidth + kpiGap);

    // Highlight border for last card
    if (kpi.highlight && data.stats.inTransitNext7Days > 0) {
      doc.setDrawColor(...COLORS.amber500);
      doc.setLineWidth(1.2);
      doc.roundedRect(x - 1, currentY - 1, kpiWidth + 2, kpiHeight + 2, 3, 3, 'S');
    }

    // Card
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.gray200);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, kpiWidth, kpiHeight, 2, 2, 'FD');

    // Title
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray500);
    doc.text(kpi.title, x + 5, currentY + 8);

    // Value
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.gray900);
    doc.text(kpi.value, x + 5, currentY + 19);

    // Subtitle
    if (kpi.subtitle) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray500);
      doc.text(kpi.subtitle, x + 5, currentY + 24);
    }
  });

  currentY += kpiHeight + 8;

  // === STORY IN BRIEF ===
  doc.setFontSize(8);
  const storyLines = doc.splitTextToSize(data.storyInBrief || 'No story available.', contentWidth - 20);
  const storyHeight = Math.max(18, 12 + storyLines.length * 4);

  // Blue alert box
  doc.setFillColor(...COLORS.blue50);
  doc.setDrawColor(...COLORS.blue200);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, currentY, contentWidth, storyHeight, 2, 2, 'FD');

  // Title
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.blue700);
  doc.text('Story in Brief', margin + 5, currentY + 9);

  // Content
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.blue600);
  doc.text(storyLines, margin + 5, currentY + 15);

  currentY += storyHeight + 6;

  // === IMMEDIATE ATTENTION ===
  // Show ALL immediate attention items (same as UI and XLSX export)
  const immediateAttentionItems = data.immediateAttention || [];
  const thisWeekCount = immediateAttentionItems.filter(i => i.isThisWeek).length;

  if (immediateAttentionItems.length > 0) {
    // Title
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.gray900);
    doc.text('Immediate Attention - In Transit / Next 7 Days', margin, currentY + 6);

    // Subtitle
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray500);
    const subtitleText = `${immediateAttentionItems.length} shipments requiring attention`;
    doc.text(subtitleText, margin, currentY + 11);

    if (thisWeekCount > 0) {
      const sw = doc.getTextWidth(subtitleText);
      doc.setTextColor(...COLORS.amber500);
      doc.text(` (${thisWeekCount} this week)`, margin + 11 + sw, currentY + 11);
    }

    currentY += 13;

    // Table - show ALL items (no .slice() limit)
    autoTable(doc, {
      startY: currentY,
      head: [['Load #', 'Customer', 'PO', 'Qty', 'ETA Port', 'Customer Due', 'Status', 'Action Required']],
      body: immediateAttentionItems.map(item => [
        item.loadNumber,
        item.customer,
        item.po || 'N/A',
        item.qty.toString(),
        formatDate(item.etaPort),
        formatDate(item.customerEtaDue),
        item.status.replace('_', ' '),
        (item.actionRequired || '-').substring(0, 30),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 6.5, cellPadding: 1.5, textColor: COLORS.gray700 },
      headStyles: { fillColor: COLORS.red500, textColor: COLORS.white, fontStyle: 'bold', fontSize: 6.5 },
      bodyStyles: { fillColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.gray50 },
      columnStyles: { 7: { cellWidth: 40 } },
      // Highlight overdue and this week rows
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          const rowIndex = hookData.row.index;
          const item = immediateAttentionItems[rowIndex];
          if (item?.isOverdue) {
            hookData.cell.styles.fillColor = [254, 226, 226]; // red-100
          } else if (item?.isThisWeek) {
            hookData.cell.styles.fillColor = [254, 243, 199]; // amber-100
          }
        }
      },
    });

    // @ts-expect-error - autoTable adds lastAutoTable
    currentY = doc.lastAutoTable.finalY + 5;
  }

  // === TWO COLUMN LAYOUT ===
  // Check if we need a new page for two-column section (need at least 70mm)
  const twoColHeight = 70; // Estimated height for two-column section
  if (currentY + twoColHeight > pageHeight - 15) {
    doc.addPage();
    doc.setFillColor(...COLORS.white);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    currentY = margin;
  }

  const leftColWidth = contentWidth * 0.54;
  const rightColWidth = contentWidth * 0.44;
  const rightColX = margin + leftColWidth + 4;
  const twoColStartY = currentY;

  // === LEFT: SKU QUANTITY BREAKDOWN ===
  const skuTotal = data.skuBreakdown.reduce((sum, s) => sum + s.combinedQty, 0);

  // Draw border box for SKU section
  doc.setDrawColor(...COLORS.blue600);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, leftColWidth, 55, 2, 2, 'S');

  // Title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text('SKU Quantity Breakdown - Supplier + GDC1 Inventory', margin + 5, currentY + 8);

  // Subtitle + Total
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray500);
  doc.text('Combined inventory across locations', margin + 5, currentY + 13);
  doc.text('Total:', margin + leftColWidth - 30, currentY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text(formatNumber(skuTotal), margin + leftColWidth - 12, currentY + 8);

  // SKU Table - inside the box
  autoTable(doc, {
    startY: currentY + 16,
    head: [['Product/SKU', 'Supplier', 'GDC Inv', 'Combined', 'Share']],
    body: [
      ...data.skuBreakdown.map(sku => {
        // Calculate total GDC inventory across all series
        const gdcTotal = Object.values(sku.gdcInventory).reduce((sum, qty) => sum + qty, 0);
        return [
          (sku.skuName || sku.sku).substring(0, 22),
          formatNumber(sku.supplierOutstandingQty),
          formatNumber(gdcTotal),
          formatNumber(sku.combinedQty),
          formatPercent(sku.shareOfCombined),
        ];
      }),
      [
        'Total',
        formatNumber(data.skuBreakdown.reduce((sum, s) => sum + s.supplierOutstandingQty, 0)),
        formatNumber(data.skuBreakdown.reduce((sum, s) => {
          return sum + Object.values(s.gdcInventory).reduce((gdcSum, qty) => gdcSum + qty, 0);
        }, 0)),
        formatNumber(skuTotal),
        '100%',
      ],
    ],
    margin: { left: margin + 3, right: pageWidth - margin - leftColWidth + 5 },
    tableWidth: leftColWidth - 10,
    styles: { fontSize: 6.5, cellPadding: 1.5, textColor: COLORS.gray700 },
    headStyles: { fillColor: COLORS.gray100, textColor: COLORS.gray500, fontStyle: 'bold', fontSize: 6.5 },
    bodyStyles: { fillColor: COLORS.white },
    showHead: 'firstPage',
    pageBreak: 'avoid',
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        if (hookData.column.index === 1) { hookData.cell.styles.textColor = COLORS.blue600; }
        if (hookData.column.index === 2) { hookData.cell.styles.textColor = COLORS.teal600; }
        if (hookData.row.index === data.skuBreakdown.length) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = COLORS.gray100;
        }
      }
    },
  });

  // === RIGHT: STATUS CHART ===
  const statusData = data.shipmentStatusMix;
  const totalQty = statusData.reduce((sum, d) => sum + d.qty, 0);
  const totalLoads = statusData.reduce((sum, d) => sum + d.loads, 0);
  const maxQty = Math.max(...statusData.map(d => d.qty), 1);

  // Title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text('Shipment / Inventory Status Mix', rightColX + 3, twoColStartY + 8);

  // Subtitle
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray500);
  doc.text(`${formatNumber(totalQty)} units across ${totalLoads} loads`, rightColX + 3, twoColStartY + 13);

  let chartY = twoColStartY + 18;

  const statusColors: Record<string, [number, number, number]> = {
    'SOLD': COLORS.gray500,
    'OPEN': COLORS.orange400,
    'HOLD': COLORS.red400,
    'IN_TRANSIT': COLORS.purple500,
    'DELIVERED': COLORS.gray300,
    'AVAILABLE': COLORS.green400,
  };

  // Draw status rows
  statusData.forEach((item) => {
    const color = statusColors[item.status] || COLORS.gray300;
    const percent = totalQty > 0 ? (item.qty / totalQty * 100).toFixed(1) : '0.0';
    const barFillWidth = (item.qty / maxQty) * 45;

    // Status name
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray700);
    doc.text(item.status.replace('_', ' '), rightColX + 3, chartY + 3.5);

    // Loads count
    doc.setTextColor(...COLORS.gray500);
    doc.text(item.loads.toString(), rightColX + 35, chartY + 3.5, { align: 'right' });

    // Bar background
    const barX = rightColX + 38;
    doc.setFillColor(...COLORS.gray200);
    doc.roundedRect(barX, chartY, 45, 6, 1.5, 1.5, 'F');

    // Bar fill
    doc.setFillColor(...color);
    doc.roundedRect(barX, chartY, Math.max(barFillWidth, 3), 6, 1.5, 1.5, 'F');

    // Value inside bar (if wide enough)
    if (barFillWidth > 15) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.white);
      doc.text(formatNumber(item.qty), barX + barFillWidth / 2, chartY + 4, { align: 'center' });
    }

    // Qty + Percentage (right of bar)
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray700);
    doc.text(`${formatNumber(item.qty)} ${percent}%`, rightColX + rightColWidth - 5, chartY + 3.5, { align: 'right' });

    chartY += 8;
  });

  // Update currentY to after both columns
  currentY = twoColStartY + 58;

  // Legend (compact, single row)
  let legendX = rightColX + 3;
  const legendItems = [
    { label: 'OPEN', color: COLORS.orange400 },
    { label: 'HOLD', color: COLORS.red400 },
    { label: 'IN TRANSIT', color: COLORS.purple500 },
    { label: 'AVAILABLE', color: COLORS.green400 },
  ];

  legendItems.forEach((item) => {
    doc.setFillColor(...item.color);
    doc.circle(legendX + 1.5, chartY + 1.5, 1.2, 'F');
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray500);
    doc.text(item.label, legendX + 4, chartY + 2);
    legendX += 22;
  });

  // ============================================
  // PAGE 2: CUSTOMER COMMITMENTS + DETAILS
  // ============================================
  doc.addPage();

  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  currentY = margin;

  // === CUSTOMER COMMITMENTS ===
  const totalInvoice = data.customerCommitments.reduce((sum, c) => sum + c.invoiceAmount, 0);
  const totalCustomerQty = data.customerCommitments.reduce((sum, c) => sum + c.outstandingQty, 0);

  // Title
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text('Customer Commitments / Outstanding', margin, currentY + 6);

  // Subtitle + Total Value
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray500);
  doc.text(`${formatNumber(totalCustomerQty)} units committed across ${data.customerCommitments.length} customers`, margin, currentY + 11);
  doc.text('Total Value:', margin + contentWidth - 40, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.emerald600);
  doc.text(formatCurrency(totalInvoice), margin + contentWidth - 15, currentY + 6);

  currentY += 14;

  autoTable(doc, {
    startY: currentY,
    head: [['Customer', 'Loads', 'Outstanding Qty', 'Invoice Amount', 'In Transit / 7 Days']],
    body: [
      ...data.customerCommitments.map(c => [
        c.customer,
        c.loads.toString(),
        formatNumber(c.outstandingQty),
        formatCurrency(c.invoiceAmount),
        c.inTransitNext7Days > 0 ? c.inTransitNext7Days.toString() : '0',
      ]),
      [
        'Total',
        data.customerCommitments.reduce((sum, c) => sum + c.loads, 0).toString(),
        formatNumber(totalCustomerQty),
        formatCurrency(totalInvoice),
        data.customerCommitments.reduce((sum, c) => sum + c.inTransitNext7Days, 0).toString(),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 2, textColor: COLORS.gray700 },
    headStyles: { fillColor: COLORS.gray50, textColor: COLORS.gray500, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fillColor: COLORS.white },
    pageBreak: 'avoid',
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        if (hookData.column.index === 3) {
          hookData.cell.styles.textColor = COLORS.emerald600;
          hookData.cell.styles.fontStyle = 'bold';
        }
        if (hookData.column.index === 4 && hookData.cell.raw !== '0') {
          hookData.cell.styles.textColor = COLORS.teal600;
        }
        if (hookData.row.index === data.customerCommitments.length) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = COLORS.gray50;
        }
      }
    },
  });

  // @ts-expect-error - autoTable adds lastAutoTable
  currentY = doc.lastAutoTable.finalY + 10;

  // HIDDEN: SUPPLIER SHIPMENT SCHEDULE - per Ankur/Jenny feedback Aug 26, 2025
  // Entire section commented out to exclude from PDF export
  /*
  // === SUPPLIER SHIPMENT SCHEDULE (continues on same page if space available) ===
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text('Supplier Shipment Schedule - Galileo Orders', margin, currentY + 6);

  // Calculate totals
  const supplierTotals = data.supplierShipmentSchedule.reduce(
    (acc, item) => ({
      total: acc.total + item.totalQty,
      delivered: acc.delivered + item.qtyDelivered,
      outstanding: acc.outstanding + item.outstandingQtyForPO,
      invoiceTotal: acc.invoiceTotal + (item.invoiceAmount || 0),
    }),
    { total: 0, delivered: 0, outstanding: 0, invoiceTotal: 0 }
  );

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray500);
  doc.text(
    `${data.supplierShipmentSchedule.length} shipments | Total: ${formatNumber(supplierTotals.total)} units | Outstanding: ${formatNumber(supplierTotals.outstanding)} | Invoice Total: ${formatCurrency(supplierTotals.invoiceTotal)}`,
    margin, currentY + 11
  );

  currentY += 15;

  // Supplier Schedule Table with more columns
  autoTable(doc, {
    startY: currentY,
    head: [['No.', 'Load #', 'Products', 'Qty', 'Customer', 'PO', 'ETA Port', 'Confirmed', 'Delivered', 'Dlvd Qty', 'Outs.', 'Invoice #', 'Amount', 'Status', 'Action']],
    body: data.supplierShipmentSchedule.map(item => [
      item.no.toString(),
      item.loadNumber,
      item.items.map(i => `${i.productName || i.sku}: ${i.qty}`).join(', ').substring(0, 35),
      formatNumber(item.totalQty),
      item.customer.substring(0, 18),
      item.po || '-',
      formatDate(item.etaToUsPort),
      formatDate(item.confirmedEta),
      formatDate(item.actualDeliveryDate),
      item.qtyDelivered > 0 ? item.qtyDelivered.toString() : '-',
      item.outstandingQtyForPO > 0 ? item.outstandingQtyForPO.toString() : '0',
      item.invoiceNumber || '-',
      formatCurrency(item.invoiceAmount),
      item.status.replace('_', ' '),
      (item.actionRequired || '-').substring(0, 25),
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 5.5, cellPadding: 1.2, textColor: COLORS.gray700 },
    headStyles: { fillColor: COLORS.teal500, textColor: COLORS.white, fontStyle: 'bold', fontSize: 5.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { cellWidth: 40 },
      4: { cellWidth: 20 },
      12: { halign: 'right' },
      14: { cellWidth: 22 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        if (hookData.column.index === 12) {
          hookData.cell.styles.textColor = COLORS.emerald600;
          hookData.cell.styles.fontStyle = 'bold';
        }
        if (hookData.column.index === 10 && hookData.cell.raw !== '0') {
          hookData.cell.styles.textColor = [234, 88, 12];
        }
        if (hookData.column.index === 13) {
          const status = hookData.cell.raw as string;
          if (status === 'AVAILABLE') { hookData.cell.styles.textColor = [22, 163, 74]; }
          if (status === 'IN TRANSIT') { hookData.cell.styles.textColor = COLORS.purple500; }
          if (status === 'HOLD') { hookData.cell.styles.textColor = COLORS.red400; }
          if (status === 'DELIVERED') { hookData.cell.styles.textColor = COLORS.gray500; }
          if (status === 'OPEN') { hookData.cell.styles.textColor = COLORS.orange400; }
          if (status === 'SOLD') { hookData.cell.styles.textColor = [234, 88, 12]; }
        }
      }
    },
  });

  // @ts-expect-error - autoTable adds lastAutoTable
  currentY = doc.lastAutoTable.finalY + 5;

  // Totals row for Supplier Schedule
  doc.setFillColor(...COLORS.gray100);
  doc.roundedRect(margin, currentY, contentWidth, 8, 1, 1, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray700);
  doc.text('TOTALS:', margin + 5, currentY + 5);
  doc.text(`${formatNumber(supplierTotals.total)} units`, margin + 50, currentY + 5);
  doc.text(`Delivered: ${formatNumber(supplierTotals.delivered)}`, margin + 85, currentY + 5);
  doc.setTextColor(234, 88, 12);
  doc.text(`Outstanding: ${formatNumber(supplierTotals.outstanding)}`, margin + 125, currentY + 5);
  doc.setTextColor(...COLORS.emerald600);
  doc.text(`Invoice Total: ${formatCurrency(supplierTotals.invoiceTotal)}`, margin + 175, currentY + 5);
  */

  currentY += 15;

  // Check if we need a new page for GDC1 (if less than 50mm space remaining)
  if (currentY > pageHeight - 60) {
    doc.addPage();
    doc.setFillColor(...COLORS.white);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    currentY = margin;
  }

  // === GDC1 INVENTORY HEADER ===
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray900);
  doc.text('GDC1 Warehouse Inventory', margin, currentY + 6);

  // Calculate GDC1 totals
  const gdc1Totals = data.gdc1Inventory.reduce(
    (acc, item) => ({
      total: acc.total + item.totalQty,
      outstanding: acc.outstanding + item.outstandingPoQty,
      qtyDelivered: acc.qtyDelivered + item.qtyDelivered,
      invoiceTotal: acc.invoiceTotal + (item.invoiceAmount || 0),
    }),
    { total: 0, outstanding: 0, qtyDelivered: 0, invoiceTotal: 0 }
  );

  // Status summary
  const gdc1StatusSummary = data.gdc1Inventory.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray500);
  doc.text(
    `${data.gdc1Inventory.length} loads | Total: ${formatNumber(gdc1Totals.total)} units | Available: ${gdc1StatusSummary['AVAILABLE'] || 0} | Sold: ${gdc1StatusSummary['SOLD'] || 0} | Invoice Total: ${formatCurrency(gdc1Totals.invoiceTotal)}`,
    margin, currentY + 11
  );

  currentY += 15;

  // GDC1 Inventory Table with more columns
  autoTable(doc, {
    startY: currentY,
    head: [['No.', 'Load #', 'Products', 'Qty', 'Customer', 'PO', 'ETA Port', 'Confirmed', 'Delivered', 'Dlvd Qty', 'Outs.', 'Invoice #', 'Amount', 'Status', 'Action']],
    body: data.gdc1Inventory.map(item => [
      item.no.toString(),
      item.loadNumber,
      // Use product name if available, otherwise use SKU
      item.items.map(i => `${i.productName || i.sku}: ${i.qty}`).join(', ').substring(0, 35),
      formatNumber(item.totalQty),
      (item.customer || '-').substring(0, 18),
      item.po || '-',
      formatDate(item.etaToUsPort),
      formatDate(item.confirmedEta),
      formatDate(item.actualDelivery),
      item.qtyDelivered > 0 ? item.qtyDelivered.toString() : '-',
      item.outstandingPoQty > 0 ? item.outstandingPoQty.toString() : '0',
      item.invoiceNumber || '-',
      formatCurrency(item.invoiceAmount),
      item.status.replace('_', ' '),
      (item.actionRequired || '-').substring(0, 25),
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 5.5, cellPadding: 1.2, textColor: COLORS.gray700 },
    headStyles: { fillColor: COLORS.emerald500, textColor: COLORS.white, fontStyle: 'bold', fontSize: 5.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { cellWidth: 40 },  // Products column - wider for product names
      4: { cellWidth: 20 },
      12: { halign: 'right' },
      14: { cellWidth: 22 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        // Color invoice amount green
        if (hookData.column.index === 12) {
          hookData.cell.styles.textColor = COLORS.emerald600;
          hookData.cell.styles.fontStyle = 'bold';
        }
        // Color outstanding orange if > 0
        if (hookData.column.index === 10 && hookData.cell.raw !== '0') {
          hookData.cell.styles.textColor = [234, 88, 12];
        }
        // Row background color based on status
        const rowData = hookData.row.raw as string[];
        if (rowData && hookData.section === 'body') {
          const status = rowData[13];
          if (status === 'AVAILABLE') {
            hookData.cell.styles.fillColor = [240, 253, 244];
          } else if (status === 'SOLD') {
            hookData.cell.styles.fillColor = [255, 247, 237];
          } else if (status === 'HOLD') {
            hookData.cell.styles.fillColor = [254, 249, 195];
          }
        }
        // Color status text
        if (hookData.column.index === 13) {
          const status = hookData.cell.raw as string;
          if (status === 'AVAILABLE') { hookData.cell.styles.textColor = [22, 163, 74]; }
          if (status === 'SOLD') { hookData.cell.styles.textColor = [234, 88, 12]; }
          if (status === 'HOLD') { hookData.cell.styles.textColor = [202, 138, 4]; }
        }
      }
    },
  });

  // @ts-expect-error - autoTable adds lastAutoTable
  currentY = doc.lastAutoTable.finalY + 5;

  // Totals row for GDC1
  doc.setFillColor(...COLORS.gray100);
  doc.roundedRect(margin, currentY, contentWidth, 8, 1, 1, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gray700);
  doc.text('TOTALS:', margin + 5, currentY + 5);
  doc.text(`${formatNumber(gdc1Totals.total)} units`, margin + 50, currentY + 5);
  doc.text(`Delivered: ${formatNumber(gdc1Totals.qtyDelivered)}`, margin + 85, currentY + 5);
  doc.setTextColor(234, 88, 12);
  doc.text(`Outstanding: ${formatNumber(gdc1Totals.outstanding)}`, margin + 125, currentY + 5);
  doc.setTextColor(...COLORS.emerald600);
  doc.text(`Invoice Total: ${formatCurrency(gdc1Totals.invoiceTotal)}`, margin + 175, currentY + 5);

  // === FOOTER ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray500);
    doc.text('Gesher Distribution - Operations Dashboard', margin, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  return doc.output('arraybuffer');
}

// ============================================
// API ROUTE HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Extract filters from query params
    const searchParams = request.nextUrl.searchParams;
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
    const pdfBuffer = await generatePDF(data);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `operations-dashboard-${dateStr}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('PDF Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF export' },
      { status: 500 }
    );
  }
}
