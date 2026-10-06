-- Migration: Add load_status to purchase_orders for Operations Dashboard tracking
-- Purpose: Track GDC 0 operations status (OPEN, CLOSED, HOLD, etc.) separate from PO workflow status
-- Date: Oct 2, 2026
-- FIXED: Removed unsafe enum value usage in same transaction

-- ============================================
-- STEP 1: ADD load_status COLUMN TO purchase_orders
-- ============================================

-- Note: New enum values are added in migration 146
-- This migration only adds the column and index

-- Add load_status column (using existing load_status enum values)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS load_status load_status DEFAULT 'open';

COMMENT ON COLUMN purchase_orders.load_status IS 'Operations status for GDC tracking: OPEN, CLOSED, HOLD, IN_TRANSIT, AVAILABLE, SOLD, INVOICED, etc.';

-- Create index for filtering by load_status
CREATE INDEX IF NOT EXISTS idx_purchase_orders_load_status ON purchase_orders(load_status) WHERE deleted_at IS NULL;

-- ============================================
-- NOTE: Data migration moved to separate migration (147)
-- ============================================

-- Enum values (po_needed, not_invoiced, etc.) are added in migration 146
-- Data migration that uses these values is in migration 147 (after enum values are committed)

-- ============================================
-- ROLLBACK SCRIPT (commented out)
-- ============================================

-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_purchase_orders_load_status;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS load_status;
