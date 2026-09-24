/**
 * QuickBooks-specific Types
 *
 * Type definitions specific to QuickBooks integration.
 */

// ============================================
// OAUTH TYPES
// ============================================

/**
 * QuickBooks environment
 */
export type QuickBooksEnvironment = 'sandbox' | 'production';

/**
 * OAuth token response from Intuit
 */
export interface IntuitTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

/**
 * OAuth error response from Intuit
 */
export interface IntuitErrorResponse {
  error: string;
  error_description?: string;
}

// ============================================
// API TYPES
// ============================================

/**
 * Company info from QuickBooks API
 */
export interface QuickBooksCompanyInfo {
  CompanyInfo: {
    Id: string;
    CompanyName: string;
    LegalName?: string;
    CompanyAddr?: QuickBooksAddress;
    PrimaryPhone?: { FreeFormNumber?: string };
    Email?: { Address?: string };
    FiscalYearStartMonth?: string;
    Country?: string;
    CompanyStartDate?: string;
  };
}

/**
 * QuickBooks address format
 */
export interface QuickBooksAddress {
  Line1?: string;
  Line2?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
  Country?: string;
}

/**
 * QuickBooks customer from API
 */
export interface QuickBooksCustomer {
  Id?: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  BillAddr?: QuickBooksAddress;
  ShipAddr?: QuickBooksAddress;
  Taxable?: boolean;
  Balance?: number;
  Active?: boolean;
  SyncToken?: string;
  MetaData?: {
    CreateTime?: string;
    LastUpdatedTime?: string;
  };
}

/**
 * QuickBooks invoice from API
 */
export interface QuickBooksInvoice {
  Id?: string;
  DocNumber?: string;
  CustomerRef: { value: string; name?: string };
  TxnDate?: string;
  DueDate?: string;
  Line: QuickBooksInvoiceLine[];
  TotalAmt?: number;
  Balance?: number;
  EmailStatus?: string;
  BillEmail?: { Address?: string };
  BillAddr?: QuickBooksAddress;
  ShipAddr?: QuickBooksAddress;
  PrivateNote?: string;
  CustomerMemo?: { value?: string };
  SyncToken?: string;
  MetaData?: {
    CreateTime?: string;
    LastUpdatedTime?: string;
  };
}

/**
 * QuickBooks invoice line item
 */
export interface QuickBooksInvoiceLine {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount: number;
  DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail' | 'DiscountLineDetail';
  SalesItemLineDetail?: {
    ItemRef?: { value: string; name?: string };
    Qty?: number;
    UnitPrice?: number;
    TaxCodeRef?: { value: string };
  };
}

/**
 * QuickBooks payment from API
 */
export interface QuickBooksPayment {
  Id?: string;
  CustomerRef: { value: string; name?: string };
  TotalAmt: number;
  TxnDate?: string;
  PaymentMethodRef?: { value: string; name?: string };
  PaymentRefNum?: string;
  PrivateNote?: string;
  Line?: Array<{
    Amount: number;
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
  SyncToken?: string;
  MetaData?: {
    CreateTime?: string;
    LastUpdatedTime?: string;
  };
}

/**
 * QuickBooks item (product) from API
 */
export interface QuickBooksItem {
  Id?: string;
  Name: string;
  Sku?: string;
  Description?: string;
  PurchaseDesc?: string;
  PurchaseCost?: number;
  UnitPrice?: number;
  Type?: 'Inventory' | 'Service' | 'NonInventory';
  Active?: boolean;
  Taxable?: boolean;
  IncomeAccountRef?: { value: string; name?: string };
  ExpenseAccountRef?: { value: string; name?: string };
  AssetAccountRef?: { value: string; name?: string };
  TrackQtyOnHand?: boolean;
  QtyOnHand?: number;
  InvStartDate?: string;
  SyncToken?: string;
  MetaData?: {
    CreateTime?: string;
    LastUpdatedTime?: string;
  };
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * QuickBooks query response pagination metadata
 */
export interface QuickBooksQueryPagination {
  startPosition?: number;
  maxResults?: number;
  totalCount?: number;
}

/**
 * QuickBooks query response wrapper
 */
export interface QuickBooksQueryResponse<T> {
  QueryResponse: QuickBooksQueryPagination & Record<string, T[] | undefined>;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * QuickBooks provider configuration
 */
export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: QuickBooksEnvironment;
  encryptionKey: string;
}

/**
 * QuickBooks connection metadata stored in JSONB
 */
export interface QuickBooksConnectionMetadata {
  environment: QuickBooksEnvironment;
  companyStartDate?: string;
  fiscalYearStartMonth?: string;
  country?: string;
  lastCustomerSync?: string;
  lastInvoiceSync?: string;
  lastPaymentSync?: string;
  [key: string]: unknown;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Connection status response for UI
 */
export interface QuickBooksStatusResponse {
  connected: boolean;
  companyName?: string;
  realmId?: string;
  environment?: QuickBooksEnvironment;
  connectedAt?: string;
  tokenExpiresAt?: string;
  status?: string;
  errorMessage?: string;
}
