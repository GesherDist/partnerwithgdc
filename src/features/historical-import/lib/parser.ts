/**
 * HISTORICAL IMPORT - EXCEL PARSER
 * =================================
 * Parse Excel files and extract order data
 */

import * as XLSX from 'xlsx';
import { RawExcelRow } from '../types';
import { normalizeCustomerName } from './customer-mapping';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Sheet names
  SHEETS: ['GDC 0', 'GDC 1', 'GDC 2'],

  // Data starts from these rows (after header)
  DATA_START_ROW: {
    'GDC 0': 4,
    'GDC 1': 4,
    'GDC 2': 3,
  },

  // Order series mapping
  ORDER_SERIES: {
    'GDC 0': 'GDC 0',
    'GDC 1': 'GDC 1',
    'GDC 2': 'GDC 2',
  },

  // Column positions (0-indexed)
  COLUMNS: {
    LOAD_NUMBER: 1,
    QTY_38: 2,
    QTY_24: 3,
    TOTAL_QTY: 4,
    CUSTOMER: 5,
    PO: 6,
    DELIVERY_ADDRESS: 7,
    ETA_PORT: 8,
    CONFIRMED_ETA: 9,
    CUSTOMER_DUE_DATE: 10,
    ACTUAL_DELIVERY: 11,
    QTY_DELIVERED: 12,
    OUTSTANDING_QTY: 13,
    PRICE_38: 14,
    PRICE_24: 15,
    INVOICE_AMOUNT: 16,
    COST: 17,
    STATUS: 18,
    ACTION_NOTES: 19,
    COMMISSION_ONLY: 20,
    COMMISSION_AMOUNT: 21,
    CONTAINER_NUMBERS: 22,
    ADDITIONAL_NOTES: 23,
  },

  // Internal customers to flag
  INTERNAL_CUSTOMERS: ['GDC', 'Nebraska Warehouse', 'Kansas Warehouse', 'Gesher'],
};

// ============================================================================
// EXCEL DATE CONVERSION
// ============================================================================

function excelDateToISO(excelDate: any): string | null {
  if (!excelDate || typeof excelDate !== 'number') return null;

  try {
    const date = XLSX.SSF.parse_date_code(excelDate);
    if (!date) return null;

    const year = date.y;
    const month = String(date.m).padStart(2, '0');
    const day = String(date.d).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

// ============================================================================
// CHECK IF INTERNAL CUSTOMER
// ============================================================================

export function isInternalCustomer(customerName: string | null): boolean {
  if (!customerName) return false;
  const name = customerName.trim().toLowerCase();
  return CONFIG.INTERNAL_CUSTOMERS.some((internal) =>
    name.includes(internal.toLowerCase())
  );
}

// ============================================================================
// PARSE SINGLE ROW
// ============================================================================

function parseRow(
  row: any[],
  rowIndex: number,
  sheetName: string
): RawExcelRow | null {
  const C = CONFIG.COLUMNS;

  // Check if valid row (has load number starting with SO)
  const loadNumber = row[C.LOAD_NUMBER];
  if (!loadNumber || !loadNumber.toString().startsWith('SO')) {
    return null;
  }

  // Initialize validation arrays first
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  let customer = row[C.CUSTOMER] || '';
  let customerPO = row[C.PO] || '';
  const qty38 = parseInt(row[C.QTY_38]) || 0;
  const qty24 = parseInt(row[C.QTY_24]) || 0;
  const price38 = parseFloat(row[C.PRICE_38]) || 0;
  const price24 = parseFloat(row[C.PRICE_24]) || 0;

  // DEBUG: Log product quantities for troubleshooting
  if (loadNumber) {
    console.log(`[PARSER] ${loadNumber}: Column ${C.QTY_38} (38") = ${row[C.QTY_38]} → qty38=${qty38}, Column ${C.QTY_24} (24") = ${row[C.QTY_24]} → qty24=${qty24}`);
  }

  // Check multiple columns for "SOLD TO" pattern
  const actionNotes = row[C.ACTION_NOTES] || '';
  const additionalNotes = row[C.ADDITIONAL_NOTES] || '';
  const allNotes = `${actionNotes} ${additionalNotes}`.trim();

  // Check if this is internal transfer (GDC/MWI pattern)
  // Extract real customer and PO from notes like "SOLD TO VALLEY PO# Q458003"
  if (customer.toLowerCase().includes('gdc') || customer.toLowerCase().includes('mwi')) {
    const originalCustomer = customer;

    // Try to find "SOLD TO" pattern in any notes column
    const soldToMatch = allNotes.match(/SOLD TO\s+([A-Z\s]+?)\s+PO#?\s*([A-Z0-9-]+)/i);
    if (soldToMatch) {
      customer = soldToMatch[1]!.trim(); // Real customer name
      customerPO = soldToMatch[2]!.trim(); // Real customer PO
      console.log(`[PARSER] Internal transfer: ${originalCustomer} → Real customer: ${customer}, PO: ${customerPO}`);
    } else {
      // Pattern not found - add warning
      console.warn(`[PARSER] ${loadNumber}: Could not extract real customer from: "${allNotes}"`);
      validationWarnings.push(
        `Internal transfer detected (${customer}) but could not find "SOLD TO {CUSTOMER} PO# {PO}" pattern in notes`
      );
    }
  }

  // Basic validation

  if (!customer || customer.trim() === '') {
    validationErrors.push('Customer name is missing');
  }

  if (qty38 === 0 && qty24 === 0) {
    validationErrors.push('No product quantities');
  }

  if (qty38 > 0 && price38 === 0) {
    validationErrors.push('Missing price for 38" tire');
  }

  if (qty24 > 0 && price24 === 0) {
    validationErrors.push('Missing price for 24" tire');
  }

  const parsed: RawExcelRow = {
    // Metadata
    rowIndex,
    sheetName,
    orderSeries: CONFIG.ORDER_SERIES[sheetName as keyof typeof CONFIG.ORDER_SERIES] || sheetName,

    // Order info
    loadNumber: loadNumber.toString(),
    customer: normalizeCustomerName(customer), // Normalize customer name (already extracted from notes if internal)
    customerPO: customerPO,

    // Quantities
    qty38,
    qty24,
    totalQty: qty38 + qty24,

    // Prices
    price38,
    price24,

    // Delivery
    deliveryAddress: row[C.DELIVERY_ADDRESS] || '',

    // Dates
    etaPort: excelDateToISO(row[C.ETA_PORT]),
    confirmedEta: excelDateToISO(row[C.CONFIRMED_ETA]),
    customerDueDate: excelDateToISO(row[C.CUSTOMER_DUE_DATE]),
    actualDelivery: excelDateToISO(row[C.ACTUAL_DELIVERY]),

    // Status
    status: row[C.STATUS] || '',

    // Tracking
    containerNumbers: row[C.CONTAINER_NUMBERS] || null,

    // Validation
    isValid: validationErrors.length === 0,
    validationErrors,
    validationWarnings,

    // Customer validation (will be populated later)
    customerExists: false,
    customerId: null,
    isInternalCustomer: isInternalCustomer(customer),
  };

  return parsed;
}

// ============================================================================
// PARSE EXCEL FILE
// ============================================================================

export async function parseExcelFile(file: File): Promise<RawExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('Failed to read file');
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const allRows: RawExcelRow[] = [];

        // Check if it's a CSV file (single sheet)
        const sheetNames = workbook.SheetNames;
        const isCsv = file.name.toLowerCase().endsWith('.csv');

        if (isCsv || sheetNames.length === 1) {
          // Handle CSV or single-sheet file
          const sheet = workbook.Sheets[sheetNames[0]!];

          // Try to determine GDC from filename
          let sheetName = 'GDC 0'; // Default
          const fileName = file.name.toLowerCase();
          if (fileName.includes('gdc 0') || fileName.includes('gdc0')) {
            sheetName = 'GDC 0';
          } else if (fileName.includes('gdc 1') || fileName.includes('gdc1')) {
            sheetName = 'GDC 1';
          } else if (fileName.includes('gdc 2') || fileName.includes('gdc2')) {
            sheetName = 'GDC 2';
          }

          // Read all rows as array
          const rawData = XLSX.utils.sheet_to_json(sheet!, {
            defval: null,
            header: 1,
          }) as any[][];

          // Find header row (contains "Load #")
          let startRow = 3; // Default
          for (let i = 0; i < Math.min(10, rawData.length); i++) {
            const row = rawData[i];
            if (row && row.some((cell: any) => {
              const cellStr = String(cell || '').toLowerCase();
              return cellStr.includes('load') && cellStr.includes('#');
            })) {
              startRow = i + 1; // Data starts after header
              break;
            }
          }

          // Parse data rows
          for (let i = startRow; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            const parsed = parseRow(row, i + 1, sheetName);
            if (parsed) {
              allRows.push(parsed);
            }
          }
        } else {
          // Parse each sheet (Excel with multiple sheets)
          for (const sheetName of CONFIG.SHEETS) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) {
              console.warn(`Sheet "${sheetName}" not found, skipping...`);
              continue;
            }

            // Read all rows as array
            const rawData = XLSX.utils.sheet_to_json(sheet, {
              defval: null,
              header: 1,
            }) as any[][];

            const startRow = CONFIG.DATA_START_ROW[sheetName as keyof typeof CONFIG.DATA_START_ROW] - 1;

            // Parse data rows
            for (let i = startRow; i < rawData.length; i++) {
              const row = rawData[i];
              if (!row || row.length === 0) continue;

              const parsed = parseRow(row, i + 1, sheetName);
              if (parsed) {
                allRows.push(parsed);
              }
            }
          }
        }

        resolve(allRows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}
