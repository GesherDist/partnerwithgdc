/**
 * HISTORICAL IMPORT - CUSTOMER NAME MAPPING
 * ==========================================
 * Map abbreviated customer names to full database names
 */

// Customer name mappings (Excel name → Database name)
// IMPORTANT: These must match EXACTLY as stored in database (including commas, LLC/Inc, etc.)
const CUSTOMER_NAME_MAP: Record<string, string> = {
  // Valley variations → Database: "Valley Irrigation LLC"
  'valley': 'Valley Irrigation LLC',
  'valley irrigation': 'Valley Irrigation LLC',
  'valley irrigation llc': 'Valley Irrigation LLC',

  // Lindsay variations → Database: "Lindsay Irrigation Solutions, LLC"
  'lindsay': 'Lindsay Irrigation Solutions, LLC',
  'lindsay irrigation': 'Lindsay Irrigation Solutions, LLC',
  'lindsay irrigation solutions': 'Lindsay Irrigation Solutions, LLC',
  'lindsay irrigation solutions llc': 'Lindsay Irrigation Solutions, LLC',
  'lindsay irrigation solutions, llc': 'Lindsay Irrigation Solutions, LLC',

  // MWI variations → Database: "MWI, LLC"
  'mwi': 'MWI, LLC',
  'mwi llc': 'MWI, LLC',
  'mwi, llc': 'MWI, LLC',

  // GDC/MWI combined → Database: "MWI, LLC"
  'gdc/mwi': 'MWI, LLC',

  // WISH variations → Database: "WISH Nebraska, Inc"
  'wish': 'WISH Nebraska, Inc',
  'wish nebraska': 'WISH Nebraska, Inc',
  'wish nebraska inc': 'WISH Nebraska, Inc',
  'wish nebraska, inc': 'WISH Nebraska, Inc',

  // Valmont → Database: "Valmont Industries"
  'valmont': 'Valmont Industries',
  'valmont industries': 'Valmont Industries',

  // Western → Database: "Western Irrigation Supply House"
  'western': 'Western Irrigation Supply House',
  'western irrigation': 'Western Irrigation Supply House',
  'western irrigation supply': 'Western Irrigation Supply House',
  'western irrigation supply house': 'Western Irrigation Supply House',

  // Add more mappings as needed
};

/**
 * Normalize customer name to match database records
 */
export function normalizeCustomerName(name: string | null | undefined): string {
  if (!name) return '';

  // Trim and lowercase for comparison
  const normalized = name.trim().toLowerCase();

  // Check if we have a mapping
  if (CUSTOMER_NAME_MAP[normalized]) {
    return CUSTOMER_NAME_MAP[normalized];
  }

  // Return original if no mapping found
  return name.trim();
}

/**
 * Get all possible customer names (for batch validation)
 */
export function getNormalizedCustomerNames(names: string[]): string[] {
  const uniqueNames = new Set<string>();

  names.forEach(name => {
    const normalized = normalizeCustomerName(name);
    if (normalized) {
      uniqueNames.add(normalized);
    }
  });

  return Array.from(uniqueNames);
}
