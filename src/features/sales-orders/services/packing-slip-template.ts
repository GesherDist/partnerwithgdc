/**
 * Packing Slip PDF Template (Nov 19-20 2026)
 *
 * Jenny (email "Packslip", Nov 19 2026): download a packing slip from the system
 * before the order is delivered, laid out like Galileo's shipping document
 * ("BL - Q454878.pdf"). Ankur (reply, Nov 19 2026): Gesher name and logo, one
 * packing slip per sales order covering all of its containers, downloaded from
 * the sales order.
 *
 * Same blocks as Galileo's document: company header, "To:" block, document
 * title, line table (Ln / Order / Your Order / Part Number / Part Description /
 * Quantity), details (payment terms, sales rep, customer number), customer /
 * PO / container lines, "Packing slip:" per size, authorization boxes.
 * No prices. No barcode.
 *
 * Calculation (Jenny's table, Nov 19 2026), per line:
 *   pallets      = ceil(quantity / units per pallet)   e.g. 72 x 38" / 8 = 9
 *   net weight   = quantity x unit weight               e.g. 72 x 510 = 36,720 lbs
 *   gross weight = net weight + pallets x pallet weight e.g. 36,720 + 9 x 25 = 36,945 lbs
 * A figure is shown only when the product has what it needs, else left out.
 */

import { getGesherLogoBase64 } from '@/shared/lib/logo-utils';

export interface PackingSlipPdfData {
  /** Shipping number(s) in the title: shipment SO number(s), e.g. "SO2600042" */
  shippingNumber: string;
  /** Document No. line: the customer sales order number, e.g. "C-SO2600042" */
  documentNumber: string;
  salesOrderNumber: string;
  customerName: string;
  customerCode: string | null;
  customerPhone: string | null;
  /** Customer company's phone number, else the primary contact's */
  companyNumber: string | null;
  customerPoNumber: string | null;
  /** Ship-to address, one line per entry */
  shipToLines: string[];
  paymentTerms: string | null;
  salesRepName: string | null;
  /** Container numbers of the order's shipments */
  containers: string[];
  items: Array<{
    rowNum: number;
    sku: string;
    description: string;
    /** Short size label for the "Packing slip:" block (tire size, else SKU) */
    sizeLabel: string;
    /** Where the line is fulfilled from (allocations), e.g. "GDC Inventory - MWI Warehouse (48 units)" */
    shippedFrom: string[];
    quantity: number;
    /** Net weight of one unit (product weight), null when not set */
    unitWeight: number | null;
    /** Units per pallet (product), null when not set */
    unitsPerPallet: number | null;
    /** Weight of one empty pallet (product), null when not set */
    palletWeight: number | null;
  }>;
  weightUnit: string;
  printedAt: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) {
    return '-';
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

const formatNumber = (n: number, decimals = 0): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 1) });

export function generatePackingSlipHtml(data: PackingSlipPdfData): string {
  const logoBase64 = getGesherLogoBase64();
  const unit = data.weightUnit;

  const lines = data.items.map((item) => {
    const pallets = item.unitsPerPallet ? Math.ceil(item.quantity / item.unitsPerPallet) : null;
    const net = item.unitWeight === null ? null : item.quantity * item.unitWeight;
    const gross = net === null || pallets === null || item.palletWeight === null ? null : net + pallets * item.palletWeight;
    return { ...item, pallets, net, gross };
  });

  // Totals only when every line has the figure
  const sumOf = (pick: (line: (typeof lines)[number]) => number | null): number | null =>
    lines.length > 0 && lines.every((line) => pick(line) !== null)
      ? lines.reduce((sum, line) => sum + (pick(line) ?? 0), 0)
      : null;
  const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalPallets = sumOf((line) => line.pallets);
  const totalNet = sumOf((line) => line.net);
  const totalGross = sumOf((line) => line.gross);

  const tableRows = lines
    .map((line) => `
        <tr>
          <td class="c">${line.rowNum}</td>
          <td>${escapeHtml(data.salesOrderNumber)}</td>
          <td>${data.customerPoNumber ? escapeHtml(data.customerPoNumber) : ''}</td>
          <td>${escapeHtml(line.sku)}</td>
          <td>${escapeHtml(line.description)}</td>
          <td class="r">${formatNumber(line.quantity, 2)} U</td>
        </tr>`)
    .join('');

  // "Packing slip:" block, one group per line (Galileo: "290/85R38 - 72 units /
  // 9 packages / 8 units per pallet / Net weight: ...")
  const packingLines = lines
    .map((line) => {
      const parts = [`${escapeHtml(line.sizeLabel)} - ${formatNumber(line.quantity)} units`];
      if (line.pallets !== null) {
        parts.push(`${formatNumber(line.pallets)} packages / ${line.unitsPerPallet} units per pallet`);
      }
      if (lines.length > 1) {
        if (line.net !== null) {
          parts.push(`Net weight: ${formatNumber(line.net)} ${unit}`);
        }
        if (line.gross !== null) {
          parts.push(`Gross weight: ${formatNumber(line.gross)} ${unit}`);
        }
      }
      return `<div class="pack-group">${parts.join('<br>')}</div>`;
    })
    .join('');

  const totalsLines = [
    lines.length > 1 ? `Total: ${formatNumber(totalQty)} units${totalPallets !== null ? ` / ${formatNumber(totalPallets)} packages` : ''}` : null,
    totalNet !== null ? `Net weight: ${formatNumber(totalNet)} ${unit}` : null,
    totalGross !== null ? `Gross weight (with pallets): ${formatNumber(totalGross)} ${unit}` : null,
  ].filter(Boolean).join('<br>');

  // Galileo: "Customer: Valmont — Valley | 28800 Ida Street, Valley, NE 68064."
  const shipToInline = `${escapeHtml(data.customerName)}${data.shipToLines.length > 0 ? ` | ${data.shipToLines.map(escapeHtml).join(', ')}` : ''}`;
  const containerText = data.containers.length > 0 ? data.containers.map(escapeHtml).join(', ') : '-';

  // No container found (e.g. warehouse orders): say where each line is fulfilled from
  const shippedFromHtml = data.containers.length > 0
    ? ''
    : lines
      .filter((line) => line.shippedFrom.length > 0)
      .map((line) => `<br>Shipped from (${escapeHtml(line.sizeLabel)}): ${line.shippedFrom.map(escapeHtml).join('; ')}`)
      .join('');

  // Container numbers are on their own line below, so not repeated here
  const details = [
    data.paymentTerms ? `Payment Terms: ${escapeHtml(data.paymentTerms)}` : null,
    data.salesRepName ? `Sales Rep: ${escapeHtml(data.salesRepName)}` : null,
    data.customerCode ? `Customer Number: ${escapeHtml(data.customerCode)}` : null,
    data.companyNumber ? `Cust. Company Number: ${escapeHtml(data.companyNumber)}` : null,
  ].filter(Boolean).join('<br>');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Packing Slip ${escapeHtml(data.shippingNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; background: white; }
    .page { max-width: 800px; margin: 0 auto; }
    /* Header: same as the Sales Order PDF (pdf-template-new.ts) */
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0 18px; margin-bottom: 15px; }
    .header-left { flex: 0 0 50%; }
    .header-title { font-size: 20px; font-weight: 700; color: #2563eb; margin-bottom: 10px; letter-spacing: 0.5px; }
    .header-cols { display: flex; gap: 20px; }
    .header-cols > div { flex: 1; }
    .company-name { font-weight: 600; color: #111827; margin-bottom: 3px; font-size: 12px; }
    .company-address { color: #374151; font-size: 11px; line-height: 1.5; }
    .contact-info { font-size: 11px; color: #374151; line-height: 1.6; }
    .logo-container { flex: 0 0 auto; width: 280px; }
    .logo-container img { width: 100%; height: auto; display: block; }
    .sheet { background: white; margin: 0 10px; padding: 12px 8px 10px; }
    .to { font-size: 11px; font-weight: 700; line-height: 1.45; margin-bottom: 18px; }
    .title { text-align: center; font-size: 16px; text-decoration: underline; margin-bottom: 10px; }
    table.lines { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    table.lines th { background: #e3ecf8; border: 1px solid #111827; padding: 4px 6px; font-size: 12px; font-weight: 700; text-align: center; }
    table.lines td { border: 1px solid #111827; padding: 4px 6px; font-size: 11px; white-space: nowrap; }
    table.lines td:nth-child(5) { white-space: normal; }
    .c { text-align: center; }
    .r { text-align: right; }
    .details { display: flex; gap: 22px; font-size: 11px; line-height: 1.5; margin-bottom: 28px; }
    .details .label { min-width: 120px; }
    .summary { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; line-height: 1.5; margin-bottom: 14px; }
    .summary .container-no { font-family: Arial, Helvetica, sans-serif; font-size: 14px; }
    .pack-title { font-weight: 700; }
    /* One column per product, side by side (3 per row), totals below */
    .pack-groups { display: flex; flex-wrap: wrap; column-gap: 40px; row-gap: 8px; margin-bottom: 6px; }
    .pack-group { flex: 0 0 calc((100% - 80px) / 3); }
    table.auth { width: 100%; border-collapse: collapse; margin-top: 30px; }
    table.auth th { background: #e3ecf8; border: 1px solid #111827; padding: 4px; font-size: 12px; font-weight: 700; width: 50%; }
    table.auth td { border: 1px solid #111827; padding: 4px 6px; font-size: 11px; height: 22px; }
    .footer { text-align: right; font-size: 11px; margin-top: 26px; padding-right: 30px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <div class="header-title">PACKING SLIP</div>
        <div class="header-cols">
          <div>
            <div class="company-name">Gesher Distribution, Inc</div>
            <div class="company-address">
              11511 E Caley Ave<br>
              Attn: Travis Vap<br>
              Centennial, CO 80111-6935
            </div>
          </div>
          <div class="contact-info">
            accounting@partnerwithgdc.com<br>
            +1 (917) 374-7389<br>
            https://partnerwithgdc.com
          </div>
        </div>
      </div>
      <div class="logo-container">
        ${logoBase64 ? `<img src="${logoBase64}" alt="GDC Logo" />` : '<div style="font-size: 64px; font-weight: 700; color: #1f2937; font-family: Georgia, serif;">GDC</div>'}
      </div>
    </div>

    <div class="sheet">
      <div class="to">
        To:<br>
        ${escapeHtml(data.customerName)}<br>
        ${data.shipToLines.map(escapeHtml).join('<br>')}
        ${data.customerPhone ? `<br>Tel.: ${escapeHtml(data.customerPhone)}` : ''}
      </div>

      <div class="title">Packing Slip ${escapeHtml(data.shippingNumber)}</div>

      <table class="lines">
        <thead>
          <tr>
            <th style="width: 32px;">Ln</th>
            <th style="width: 110px;">Order</th>
            <th style="width: 95px;">Your Order</th>
            <th style="width: 145px;">Part Number</th>
            <th>Part Description</th>
            <th style="width: 85px;">Quantity</th>
          </tr>
        </thead>
        <tbody>${tableRows}
        </tbody>
      </table>

      <div class="details">
        <div class="label">Document No.:</div>
        <div>
          ${escapeHtml(data.documentNumber)}${details ? `<br>${details}` : ''}
        </div>
      </div>

      <div class="summary">
        Customer: ${shipToInline}.<br>
        PO; ${data.customerPoNumber ? escapeHtml(data.customerPoNumber) : '-'}<br>
        Container number: <span class="container-no">${containerText}</span>${shippedFromHtml}
      </div>

      <div class="summary">
        <div class="pack-title">Packing slip:</div>
        <div class="pack-groups">${packingLines}</div>
        ${totalsLines}
      </div>

      <table class="auth">
        <thead>
          <tr><th>Company Authorizat'n</th><th>Cust's Authorization</th></tr>
        </thead>
        <tbody>
          <tr><td>Name of Sender:</td><td>Name of Recipient:</td></tr>
          <tr><td>Date:</td><td>Date:</td></tr>
          <tr><td>Signature:</td><td>Signature:</td></tr>
        </tbody>
      </table>

      <div class="footer">
        Printed ${formatDate(data.printedAt)}<br>
        Gesher Distribution, Inc
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
