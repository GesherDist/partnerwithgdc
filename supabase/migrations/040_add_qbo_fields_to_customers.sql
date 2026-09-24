-- ============================================
-- Migration: Add QuickBooks fields to customers table
-- ============================================
-- Adds QBO sync fields directly to customers table instead of
-- using a separate qbo_entity_sync table.
-- ============================================

-- Add QBO sync fields to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS qbo_customer_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS qbo_realm_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS qbo_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qbo_sync_error TEXT;

-- Create index for QBO customer ID lookup
CREATE INDEX IF NOT EXISTS idx_customers_qbo_customer_id
ON customers(qbo_customer_id)
WHERE qbo_customer_id IS NOT NULL;

-- Create index for realm ID (company) lookup
CREATE INDEX IF NOT EXISTS idx_customers_qbo_realm_id
ON customers(qbo_realm_id)
WHERE qbo_realm_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN customers.qbo_customer_id IS 'QuickBooks Online Customer ID';
COMMENT ON COLUMN customers.qbo_realm_id IS 'QuickBooks Online Company/Realm ID';
COMMENT ON COLUMN customers.qbo_synced_at IS 'Last successful sync timestamp to QuickBooks';
COMMENT ON COLUMN customers.qbo_sync_error IS 'Last sync error message if any';
