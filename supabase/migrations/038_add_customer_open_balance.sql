-- ============================================
-- MIGRATION: 038_add_customer_open_balance.sql
-- PURPOSE: Add open_balance field to customers table
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 008_customers_table.sql
-- ============================================

-- Add open_balance column to customers table
-- Stores the current outstanding balance in cents (integer for precision)
ALTER TABLE customers
ADD COLUMN open_balance INTEGER NOT NULL DEFAULT 0;

-- Add constraint to ensure open_balance is not negative
ALTER TABLE customers
ADD CONSTRAINT customers_open_balance_non_negative CHECK (open_balance >= 0);

-- Add index for filtering/sorting by open_balance
CREATE INDEX idx_customers_open_balance ON customers(open_balance) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN customers.open_balance IS 'Current outstanding balance in cents (integer for precision)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_customers_open_balance;
-- ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_open_balance_non_negative;
-- ALTER TABLE customers DROP COLUMN IF EXISTS open_balance;
