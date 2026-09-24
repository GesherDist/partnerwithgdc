-- ============================================
-- MIGRATION: 084_products_qbo_accounts.sql
-- PURPOSE: Add QuickBooks account fields to products table
-- AUTHOR: System
-- DATE: 2025-08-20
-- ============================================

-- ============================================
-- ADD QUICKBOOKS ACCOUNT FIELDS
-- ============================================

-- Income Account (e.g., "Sales Revenue - Product")
ALTER TABLE products ADD COLUMN IF NOT EXISTS qbo_income_account VARCHAR(100);
COMMENT ON COLUMN products.qbo_income_account IS 'QuickBooks Income Account name for this product';

-- Expense Account (e.g., "Cost of Goods Sold - Product")
ALTER TABLE products ADD COLUMN IF NOT EXISTS qbo_expense_account VARCHAR(100);
COMMENT ON COLUMN products.qbo_expense_account IS 'QuickBooks Expense/COGS Account name for this product';

-- Inventory Asset Account (e.g., "Inventory Asset")
ALTER TABLE products ADD COLUMN IF NOT EXISTS qbo_inventory_asset_account VARCHAR(100);
COMMENT ON COLUMN products.qbo_inventory_asset_account IS 'QuickBooks Inventory Asset Account name (for inventory items)';

-- ============================================
-- ADD DESCRIPTION FIELDS
-- ============================================

-- Sales Description (shown on invoices/sales)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_description TEXT;
COMMENT ON COLUMN products.sales_description IS 'Description shown on sales documents (invoices, quotes)';

-- Purchase Description (shown on purchase orders)
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_description TEXT;
COMMENT ON COLUMN products.purchase_description IS 'Description shown on purchase documents (POs)';

-- ============================================
-- ADD OTHER QBO-RELATED FIELDS
-- ============================================

-- Barcode
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(50);
COMMENT ON COLUMN products.barcode IS 'Product barcode (UPC, EAN, etc.)';

-- Taxable flag
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN products.is_taxable IS 'Whether this product is taxable';

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_taxable ON products(is_taxable) WHERE is_taxable = TRUE;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_products_taxable;
-- DROP INDEX IF EXISTS idx_products_barcode;
-- ALTER TABLE products DROP COLUMN IF EXISTS is_taxable;
-- ALTER TABLE products DROP COLUMN IF EXISTS barcode;
-- ALTER TABLE products DROP COLUMN IF EXISTS purchase_description;
-- ALTER TABLE products DROP COLUMN IF EXISTS sales_description;
-- ALTER TABLE products DROP COLUMN IF EXISTS qbo_inventory_asset_account;
-- ALTER TABLE products DROP COLUMN IF EXISTS qbo_expense_account;
-- ALTER TABLE products DROP COLUMN IF EXISTS qbo_income_account;
