/**
 * QuickBooks chart of accounts → dashboard categories.
 *
 * Oct 12 call: cash, AR/AP, inventory, operating cash flow and OPEX on the
 * management dashboard come from QuickBooks, using the client's chart of
 * accounts. Every account gets one category; OPEX accounts also get a group
 * (a line in the OPEX breakdown).
 *
 * Nothing has to be saved for the common case: the category is suggested from
 * the QuickBooks account type, and the OPEX group from the parent account
 * ("Legal & Professional Fees:Accounting" → "Legal & Professional Fees").
 * A saved choice (chart_of_accounts.dashboard_category / opex_group,
 * migration 161) overrides the suggestion.
 */

export const DASHBOARD_CATEGORIES = [
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'inventory',
  'revenue',
  'cogs',
  'opex',
  'not_used',
] as const;

export type DashboardCategory = (typeof DASHBOARD_CATEGORIES)[number];

export const DASHBOARD_CATEGORY_LABELS: Record<DashboardCategory, string> = {
  cash: 'Cash',
  accounts_receivable: 'Accounts Receivable',
  accounts_payable: 'Accounts Payable',
  inventory: 'Inventory',
  revenue: 'Revenue',
  cogs: 'COGS',
  opex: 'OPEX',
  not_used: 'Not used',
};

export function isDashboardCategory(value: unknown): value is DashboardCategory {
  return typeof value === 'string' && (DASHBOARD_CATEGORIES as readonly string[]).includes(value);
}

interface AccountLike {
  accountType: string;
  accountSubType: string | null;
  name: string;
  fullyQualifiedName: string | null;
}

/** Category suggested from the QuickBooks account type */
export function suggestCategory(account: AccountLike): DashboardCategory {
  switch (account.accountType) {
    case 'Bank':
      return 'cash';
    case 'Accounts Receivable':
      return 'accounts_receivable';
    case 'Accounts Payable':
      return 'accounts_payable';
    case 'Income':
      return 'revenue';
    case 'Cost of Goods Sold':
      return 'cogs';
    case 'Expense':
      return 'opex';
    case 'Other Current Asset':
      if (account.accountSubType === 'Inventory') {
        return 'inventory';
      }
      // Payments received but not yet deposited: QuickBooks counts them as cash
      return account.accountSubType === 'UndepositedFunds' ? 'cash' : 'not_used';
    default:
      // Other Income/Expense (interest, etc.), credit cards, fixed assets,
      // equity and long-term items are not part of the call's metrics
      return 'not_used';
  }
}

/** OPEX group suggested from the parent account (top level of the full name) */
export function suggestOpexGroup(account: AccountLike): string {
  const fullName = account.fullyQualifiedName || account.name;
  return fullName.split(':')[0]!.trim() || account.name;
}
