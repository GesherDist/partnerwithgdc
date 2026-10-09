-- ============================================
-- MIGRATION: 152_add_invoice_sales_rep_delivery_fields.sql
-- PURPOSE: Add sales rep and delivery date fields to invoices
-- AUTHOR: System
-- DATE: 2026-10-09
-- DEPENDS ON: 020_invoices_tables.sql
-- ============================================

-- ============================================
-- ADD SALES REP FIELDS
-- ============================================

-- Sales rep ID (reference to users table)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Sales rep name (denormalized for historical record)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS sales_rep_name VARCHAR(200);

-- ============================================
-- ADD DELIVERY DATE FIELD
-- ============================================

-- Delivery date (actual delivery date for the invoice)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- ============================================
-- ADD INVOICE TYPE ENUM (for Phase 3)
-- ============================================

-- Create invoice type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_type') THEN
    CREATE TYPE invoice_type AS ENUM (
      'customer',     -- Invoice to customer for product sales
      'commission'    -- Commission invoice (e.g., to Galileo)
    );
  END IF;
END$$;

COMMENT ON TYPE invoice_type IS 'Type of invoice: customer (sales) or commission';

-- Add invoice type column
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_type invoice_type NOT NULL DEFAULT 'customer';

-- ============================================
-- ADD INDEXES
-- ============================================

-- Index for sales rep filtering
CREATE INDEX IF NOT EXISTS idx_invoices_sales_rep ON invoices(sales_rep_id) WHERE deleted_at IS NULL;

-- Index for invoice type filtering
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type) WHERE deleted_at IS NULL;

-- Index for delivery date filtering
CREATE INDEX IF NOT EXISTS idx_invoices_delivery_date ON invoices(delivery_date) WHERE deleted_at IS NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN invoices.sales_rep_id IS 'Reference to sales representative user';
COMMENT ON COLUMN invoices.sales_rep_name IS 'Sales rep name (denormalized for historical record)';
COMMENT ON COLUMN invoices.delivery_date IS 'Actual delivery date for the invoice';
COMMENT ON COLUMN invoices.invoice_type IS 'Type of invoice: customer or commission';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_invoices_delivery_date;
-- DROP INDEX IF EXISTS idx_invoices_type;
-- DROP INDEX IF EXISTS idx_invoices_sales_rep;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS invoice_type;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS delivery_date;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS sales_rep_name;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS sales_rep_id;
-- DROP TYPE IF EXISTS invoice_type;
