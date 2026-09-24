/**
 * QuickBooks Chart of Accounts Sync Service
 *
 * Syncs Chart of Accounts from QuickBooks Online to local database.
 */

import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks/quickbooks.provider';
import {
  upsertAccounts,
  getLastSyncTime,
  countAccountsByRealm,
} from '../repositories/chart-of-accounts.repository';
import type {
  QboAccount,
  QboAccountQueryResponse,
  ChartOfAccountsInsert,
  ChartOfAccountsSyncResult,
  AccountClassification,
} from '../types/chart-of-accounts';
import { getApiBaseUrl } from '../lib/oauth';
import { QBO_API_MINOR_VERSION } from '@/modules/integrations/providers/accounting/quickbooks/constants';
import type { QuickBooksEnvironment } from '../types';

// ============================================
// CLASSIFICATION MAPPER
// ============================================

function mapQboClassification(
  accountType: string,
  qboClassification?: string
): AccountClassification {
  // Use QBO classification if available
  if (qboClassification) {
    const lower = qboClassification.toLowerCase();
    if (lower === 'asset') return 'asset';
    if (lower === 'liability') return 'liability';
    if (lower === 'equity') return 'equity';
    if (lower === 'revenue') return 'revenue';
    if (lower === 'expense') return 'expense';
  }

  // Fallback to account type mapping
  const typeMap: Record<string, AccountClassification> = {
    'Income': 'revenue',
    'Other Income': 'revenue',
    'Expense': 'expense',
    'Other Expense': 'expense',
    'Cost of Goods Sold': 'expense',
    'Bank': 'asset',
    'Accounts Receivable': 'asset',
    'Other Current Asset': 'asset',
    'Fixed Asset': 'asset',
    'Other Asset': 'asset',
    'Accounts Payable': 'liability',
    'Credit Card': 'liability',
    'Other Current Liability': 'liability',
    'Long Term Liability': 'liability',
    'Equity': 'equity',
  };

  return typeMap[accountType] || 'expense';
}

// ============================================
// SYNC SERVICE
// ============================================

export interface QboAccountSyncService {
  /**
   * Sync all accounts from QuickBooks
   */
  syncAccounts(connectionId: string): Promise<ChartOfAccountsSyncResult>;

  /**
   * Get sync status
   */
  getSyncStatus(qboRealmId: string): Promise<{
    lastSyncAt: Date | null;
    accountCount: number;
  }>;
}

class QboAccountSyncServiceImpl implements QboAccountSyncService {
  /**
   * Fetch all accounts from QuickBooks API
   */
  private async fetchAccountsFromQbo(
    accessToken: string,
    realmId: string,
    environment: string
  ): Promise<QboAccount[]> {
    const allAccounts: QboAccount[] = [];
    let startPosition = 1;
    const maxResults = 100;
    let hasMore = true;

    while (hasMore) {
      const query = `SELECT * FROM Account WHERE Active = true STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const url = `${getApiBaseUrl(environment as QuickBooksEnvironment)}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=${QBO_API_MINOR_VERSION}`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Failed to fetch accounts from QBO:', errorBody);
        throw new Error(`QuickBooks API error: ${response.status}`);
      }

      const data: QboAccountQueryResponse = await response.json();
      const accounts = data.QueryResponse.Account || [];

      allAccounts.push(...accounts);

      // Check if there are more results
      if (accounts.length < maxResults) {
        hasMore = false;
      } else {
        startPosition += maxResults;
      }
    }

    return allAccounts;
  }

  /**
   * Map QBO account to our insert format
   */
  private mapQboAccountToInsert(
    account: QboAccount,
    realmId: string
  ): ChartOfAccountsInsert {
    return {
      qbo_account_id: account.Id,
      qbo_realm_id: realmId,
      name: account.Name,
      fully_qualified_name: account.FullyQualifiedName || null,
      account_type: account.AccountType,
      account_sub_type: account.AccountSubType || null,
      classification: mapQboClassification(account.AccountType, account.Classification),
      current_balance: account.CurrentBalance ?? null,
      currency_code: account.CurrencyRef?.value || 'USD',
      is_active: account.Active !== false,
      qbo_sync_token: account.SyncToken || null,
      qbo_synced_at: new Date().toISOString(),
    };
  }

  /**
   * Sync all accounts from QuickBooks to local database
   */
  async syncAccounts(connectionId: string): Promise<ChartOfAccountsSyncResult> {
    const result: ChartOfAccountsSyncResult = {
      success: false,
      created: 0,
      updated: 0,
      errors: [],
      syncedAt: new Date(),
    };

    try {
      // Get access token
      const tokenInfo = await quickBooksProvider.getAccessToken(connectionId);
      if (!tokenInfo) {
        throw new Error('QuickBooks connection not found or expired');
      }

      const { accessToken, externalAccountId: realmId, environment } = tokenInfo;

      // Fetch all accounts from QBO
      console.log(`[QBO Sync] Fetching accounts from QuickBooks (realm: ${realmId})...`);
      const qboAccounts = await this.fetchAccountsFromQbo(accessToken, realmId, environment);
      console.log(`[QBO Sync] Fetched ${qboAccounts.length} accounts from QuickBooks`);

      if (qboAccounts.length === 0) {
        result.success = true;
        return result;
      }

      // Map to our format
      const accountsToUpsert: ChartOfAccountsInsert[] = qboAccounts.map((acc) =>
        this.mapQboAccountToInsert(acc, realmId)
      );

      // Batch upsert
      console.log(`[QBO Sync] Upserting ${accountsToUpsert.length} accounts...`);
      const upsertCount = await upsertAccounts(accountsToUpsert);
      console.log(`[QBO Sync] Upserted ${upsertCount} accounts`);

      result.success = true;
      result.created = upsertCount; // Note: upsert doesn't distinguish create vs update
      result.syncedAt = new Date();

      return result;
    } catch (error) {
      console.error('[QBO Sync] Error syncing accounts:', error);
      result.errors.push({
        accountId: 'sync',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return result;
    }
  }

  /**
   * Get sync status for a realm
   */
  async getSyncStatus(qboRealmId: string): Promise<{
    lastSyncAt: Date | null;
    accountCount: number;
  }> {
    const [lastSyncAt, accountCount] = await Promise.all([
      getLastSyncTime(qboRealmId),
      countAccountsByRealm(qboRealmId),
    ]);

    return { lastSyncAt, accountCount };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const qboAccountSyncService: QboAccountSyncService = new QboAccountSyncServiceImpl();
