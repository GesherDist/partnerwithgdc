-- ============================================
-- MIGRATION: 083_chart_of_accounts.sql
-- PURPOSE: Chart of Accounts table for QuickBooks integration
-- AUTHOR: System
-- DATE: 2025-08-20
-- ============================================

-- ============================================
-- ACCOUNT CLASSIFICATION ENUM
-- ============================================

CREATE TYPE account_classification AS ENUM (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

COMMENT ON TYPE account_classification IS 'QuickBooks account classification';

-- ============================================
-- CHART OF ACCOUNTS TABLE
-- ============================================

CREATE TABLE chart_of_accounts (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- QuickBooks Reference
  qbo_account_id VARCHAR(50) NOT NULL,
  qbo_realm_id VARCHAR(50) NOT NULL,

  -- Account Details
  name VARCHAR(200) NOT NULL,
  fully_qualified_name VARCHAR(500),
  account_type VARCHAR(50) NOT NULL,        -- Income, Expense, Cost of Goods Sold, Other Current Asset, etc.
  account_sub_type VARCHAR(50),             -- SalesOfProductIncome, SuppliesMaterialsCogs, etc.

  -- Classification
  classification account_classification NOT NULL,

  -- Current Balance (optional, for reference)
  current_balance DECIMAL(15, 2),
  currency_code VARCHAR(3) DEFAULT 'USD',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Sync Tracking
  qbo_sync_token VARCHAR(20),
  qbo_synced_at TIMESTAMPTZ,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chart_of_accounts_qbo_unique UNIQUE (qbo_account_id, qbo_realm_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_chart_of_accounts_realm ON chart_of_accounts(qbo_realm_id);
CREATE INDEX idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX idx_chart_of_accounts_classification ON chart_of_accounts(classification);
CREATE INDEX idx_chart_of_accounts_active ON chart_of_accounts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_chart_of_accounts_name ON chart_of_accounts(name);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER trg_chart_of_accounts_updated_at
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view accounts
CREATE POLICY chart_of_accounts_select ON chart_of_accounts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert/Update requires admin permission (sync operations)
CREATE POLICY chart_of_accounts_insert ON chart_of_accounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name = 'admin'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY chart_of_accounts_update ON chart_of_accounts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name = 'admin'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE chart_of_accounts IS 'Chart of Accounts synced from QuickBooks Online';
COMMENT ON COLUMN chart_of_accounts.qbo_account_id IS 'QuickBooks Account ID';
COMMENT ON COLUMN chart_of_accounts.qbo_realm_id IS 'QuickBooks Company/Realm ID';
COMMENT ON COLUMN chart_of_accounts.name IS 'Account name (e.g., Sales Revenue - Product)';
COMMENT ON COLUMN chart_of_accounts.fully_qualified_name IS 'Full path name (e.g., Income:Sales Revenue - Product)';
COMMENT ON COLUMN chart_of_accounts.account_type IS 'QuickBooks account type';
COMMENT ON COLUMN chart_of_accounts.account_sub_type IS 'QuickBooks account sub-type for detailed categorization';
COMMENT ON COLUMN chart_of_accounts.classification IS 'High-level classification (asset, liability, equity, revenue, expense)';
COMMENT ON COLUMN chart_of_accounts.current_balance IS 'Current account balance from last sync';
COMMENT ON COLUMN chart_of_accounts.qbo_sync_token IS 'QuickBooks sync token for optimistic locking';
COMMENT ON COLUMN chart_of_accounts.qbo_synced_at IS 'Last sync timestamp';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS chart_of_accounts_update ON chart_of_accounts;
-- DROP POLICY IF EXISTS chart_of_accounts_insert ON chart_of_accounts;
-- DROP POLICY IF EXISTS chart_of_accounts_select ON chart_of_accounts;
-- DROP TRIGGER IF EXISTS trg_chart_of_accounts_updated_at ON chart_of_accounts;
-- DROP TABLE IF EXISTS chart_of_accounts;
-- DROP TYPE IF EXISTS account_classification;
