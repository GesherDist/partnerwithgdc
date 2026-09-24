-- ============================================
-- Migration: Add QuickBooks fields to products table
-- ============================================
-- Adds QBO sync fields directly to products table instead of
-- using a separate qbo_entity_sync table.
-- ============================================

-- Add QBO sync fields to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS qbo_item_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS qbo_realm_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS qbo_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qbo_sync_error TEXT;

-- Create index for QBO item ID lookup
CREATE INDEX IF NOT EXISTS idx_products_qbo_item_id
ON products(qbo_item_id)
WHERE qbo_item_id IS NOT NULL;

-- Create index for realm ID (company) lookup
CREATE INDEX IF NOT EXISTS idx_products_qbo_realm_id
ON products(qbo_realm_id)
WHERE qbo_realm_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.qbo_item_id IS 'QuickBooks Online Item ID';
COMMENT ON COLUMN products.qbo_realm_id IS 'QuickBooks Online Company/Realm ID';
COMMENT ON COLUMN products.qbo_synced_at IS 'Last successful sync timestamp to QuickBooks';
COMMENT ON COLUMN products.qbo_sync_error IS 'Last sync error message if any';
