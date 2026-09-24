-- ============================================
-- MIGRATION: 014_add_tax_exempt_expiry.sql
-- PURPOSE: Add tax exemption expiry date to customers table
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 1
-- DEPENDS ON: 008_customers_table.sql
-- ============================================

-- ============================================
-- ADD TAX EXEMPTION EXPIRY COLUMN
-- ============================================
-- Per client requirement: "tax-exemption on file (bool + expiry)"
-- This field tracks when the tax exemption certificate expires
-- ============================================

ALTER TABLE customers
ADD COLUMN tax_exempt_expiry_at DATE;

-- ============================================
-- INDEX
-- ============================================
-- Index for finding customers with expiring tax exemptions
CREATE INDEX idx_customers_tax_exempt_expiry
ON customers(tax_exempt_expiry_at)
WHERE deleted_at IS NULL
  AND tax_exempt = TRUE
  AND tax_exempt_expiry_at IS NOT NULL;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN customers.tax_exempt_expiry_at IS 'Tax exemption certificate expiration date';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_customers_tax_exempt_expiry;
-- ALTER TABLE customers DROP COLUMN IF EXISTS tax_exempt_expiry_at;
