-- ============================================
-- MIGRATION: 073_add_customer_po_to_quotes.sql
-- PURPOSE: Add customer_po_number to quotes table
-- AUTHOR: System
-- DATE: 2025-08-14
-- ============================================

-- Add customer_po_number column to quotes table
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS customer_po_number VARCHAR(100);

COMMENT ON COLUMN quotes.customer_po_number IS 'Customer purchase order number extracted from email/PDF';

-- Create index for searching by PO number
CREATE INDEX IF NOT EXISTS idx_quotes_customer_po_number ON quotes(customer_po_number) WHERE deleted_at IS NULL;

-- ============================================
-- ROLLBACK
-- ============================================
-- DROP INDEX IF EXISTS idx_quotes_customer_po_number;
-- ALTER TABLE quotes DROP COLUMN IF EXISTS customer_po_number;
