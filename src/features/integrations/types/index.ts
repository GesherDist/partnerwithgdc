/**
 * Integration Types
 *
 * Shapes for the Settings > Integrations panels.
 *
 * These describe what a *connected* provider looks like on screen. They are
 * deliberately view-shaped, not storage-shaped — when the real connection rows
 * land in Postgres, map them onto these rather than leaking columns into the UI.
 */

/**
 * Connection state of a single provider.
 *
 * `error` covers "we have credentials but the last call failed" — an expired
 * refresh token, a revoked API key. The brief is explicit that integration
 * failures are never silent, so the UI has to be able to show this.
 */
export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

/**
 * QuickBooks Online Advanced — OAuth2.
 *
 * QBO stays the financial system of record, so this connection is the one that
 * matters most. `realmId` is Intuit's company identifier and is what every API
 * call is scoped to.
 */
export interface QuickBooksConnection {
  companyName: string;
  realmId: string;
  environment: 'sandbox' | 'production';
  connectedAt: string;
  /** Intuit refresh tokens expire on a rolling window — surfaced so nobody is surprised. */
  tokenExpiresAt: string;
  lastSyncAt: string | null;
  /** Push invoices + supplier bills out to QBO. */
  pushInvoices: boolean;
  /** Pull payments + AR aging back from QBO. */
  pullPayments: boolean;
}

/**
 * Pipedrive — API token, two-way.
 */
export interface PipedriveConnection {
  companyDomain: string;
  connectedAs: string;
  /** Which pipeline new deals land in. */
  pipelineId: string;
  connectedAt: string;
  lastSyncAt: string | null;
  /** Quote sent -> create/update the deal. */
  pushQuotes: boolean;
  /** Deal won -> reflect it on the quote/sales order. */
  pullWonDeals: boolean;
}
