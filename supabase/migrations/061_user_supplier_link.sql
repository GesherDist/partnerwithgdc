-- ============================================
-- MIGRATION: 061_user_supplier_link.sql
-- PURPOSE: Link users to suppliers for portal access
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 060_suppliers_table.sql
-- ============================================

-- ============================================
-- ADD SUPPLIER_ID TO USERS TABLE
-- ============================================

-- Add supplier_id column to users table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE users ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_supplier ON users(supplier_id) WHERE deleted_at IS NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN users.supplier_id IS 'Reference to supplier company (for supplier portal users)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_users_supplier;
-- ALTER TABLE users DROP COLUMN IF EXISTS supplier_id;
