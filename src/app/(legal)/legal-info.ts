/**
 * Company details shown on the public legal pages (/terms, /privacy).
 * These URLs are registered with Intuit (QuickBooks app) as the EULA and
 * Privacy Policy, so they must stay public (see PUBLIC_ROUTES in middleware).
 */
export const LEGAL_INFO = {
  companyName: 'Gesher Distribution',
  appName: 'Gesher ERP',
  contactEmail: 'gai@geshersfulfillment.com',
  effectiveDate: 'October 20, 2026',
} as const;
