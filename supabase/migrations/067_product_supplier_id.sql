-- ============================================
-- MIGRATION: 067_product_supplier_id.sql
-- PURPOSE: Add supplier_id to products table
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 060_suppliers_table.sql
-- ============================================

-- Add supplier_id column to products
ALTER TABLE products ADD COLUMN supplier_id UUID REFERENCES suppliers(id);

-- Create index for efficient queries
CREATE INDEX idx_products_supplier ON products(supplier_id) WHERE deleted_at IS NULL;

-- Comment
COMMENT ON COLUMN products.supplier_id IS 'Default supplier for this product - used for auto-assignment on PO creation';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_products_supplier;
-- ALTER TABLE products DROP COLUMN IF EXISTS supplier_id;
