/**
 * HISTORICAL IMPORT - DATA VALIDATOR
 * ===================================
 * Validate parsed data against database
 */

import { RawExcelRow, ValidationResult, ValidationError, ValidationWarning, ValidationSummary } from '../types';
import { normalizeCustomerName } from './customer-mapping';

// ============================================================================
// VALIDATE ROWS AGAINST DATABASE
// ============================================================================

export async function validateRows(rows: RawExcelRow[]): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Collect unique customer names (excluding internal) and normalize them
  const customerNames = new Set<string>();
  rows.forEach((row) => {
    if (!row.isInternalCustomer && row.customer) {
      const normalized = normalizeCustomerName(row.customer);
      customerNames.add(normalized);
    }
  });

  // Fetch all customers from database in one query
  const customerMap = await fetchCustomerMap(Array.from(customerNames));

  // Validate each row
  let validRows = 0;
  let invalidRows = 0;
  let warningRows = 0;
  let customersFound = 0;
  let customersMissing = 0;
  let internalCustomers = 0;

  for (const row of rows) {
    // Check if internal customer (Gesher, GDC, Unallocated)
    if (row.isInternalCustomer) {
      internalCustomers++;
      row.customerExists = true; // Mark as valid - will create PO for warehouse inventory
      row.customerId = null; // No customer ID for warehouse inventory
      warnings.push({
        rowIndex: row.rowIndex,
        loadNumber: row.loadNumber,
        field: 'customer',
        message: `Warehouse inventory (no customer): ${row.customer}. Will create PO for GDC inventory.`,
        severity: 'warning',
      });
      continue;
    }

    // Check if customer exists in database (normalize first)
    const normalizedName = normalizeCustomerName(row.customer);
    const customer = customerMap.get(normalizedName.toLowerCase());

    if (customer) {
      // Update row with customer ID and normalized name
      row.customerExists = true;
      row.customerId = customer.id;
      row.customer = customer.name; // Update to database name
      customersFound++;
    } else {
      // Customer not found
      row.customerExists = false;
      customersMissing++;
      errors.push({
        rowIndex: row.rowIndex,
        loadNumber: row.loadNumber,
        field: 'customer',
        message: `Customer not found: ${row.customer} (normalized to: ${normalizedName})`,
        severity: 'error',
      });
    }

    // Add row-level validation errors
    row.validationErrors.forEach((error) => {
      errors.push({
        rowIndex: row.rowIndex,
        loadNumber: row.loadNumber,
        field: 'data',
        message: error,
        severity: 'error',
      });
    });

    // Count valid/invalid rows
    if (row.isValid && row.customerExists) {
      validRows++;
    } else {
      invalidRows++;
    }

    if (row.validationWarnings.length > 0) {
      warningRows++;
    }
  }

  const summary: ValidationSummary = {
    totalRows: rows.length,
    validRows,
    invalidRows,
    warningRows,
    customersFound,
    customersMissing,
    internalCustomers,
  };

  return {
    isValid: invalidRows === 0,
    errors,
    warnings,
    summary,
  };
}

// ============================================================================
// FETCH CUSTOMERS FROM DATABASE
// ============================================================================

async function fetchCustomerMap(customerNames: string[]): Promise<Map<string, { id: string; name: string }>> {
  const map = new Map<string, { id: string; name: string }>();

  if (customerNames.length === 0) {
    return map;
  }

  try {
    const response = await fetch('/api/historical-import/validate-customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerNames }),
    });

    if (!response.ok) {
      throw new Error('Failed to validate customers');
    }

    const data = await response.json();

    // Build map: customer name (lowercase) -> customer record
    data.customers.forEach((customer: { id: string; name: string }) => {
      map.set(customer.name.toLowerCase(), customer);
    });

    return map;
  } catch (error) {
    console.error('Error validating customers:', error);
    return map;
  }
}

// ============================================================================
// GET VALID ROWS ONLY
// ============================================================================

export function getValidRows(rows: RawExcelRow[]): RawExcelRow[] {
  return rows.filter((row) => {
    // Include internal customers (warehouse inventory) as valid
    if (row.isInternalCustomer) return row.isValid;

    // For regular customers, check both validity and customer existence
    return row.isValid && row.customerExists;
  });
}

// ============================================================================
// GET INTERNAL CUSTOMER ROWS
// ============================================================================

export function getInternalCustomerRows(rows: RawExcelRow[]): RawExcelRow[] {
  return rows.filter((row) => row.isInternalCustomer);
}

// ============================================================================
// GET INVALID ROWS
// ============================================================================

export function getInvalidRows(rows: RawExcelRow[]): RawExcelRow[] {
  return rows.filter((row) => {
    // Exclude internal customers
    if (row.isInternalCustomer) return false;

    // Include rows that are invalid or customer doesn't exist
    return !row.isValid || !row.customerExists;
  });
}
