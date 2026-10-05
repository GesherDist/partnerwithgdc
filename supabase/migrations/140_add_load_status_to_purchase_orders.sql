-- Migration: Add load_status to purchase_orders for Operations Dashboard tracking
-- Purpose: Track GDC 0 operations status (OPEN, CLOSED, HOLD, etc.) separate from PO workflow status
-- Date: Oct 2, 2026

-- ============================================
-- STEP 1: ADD NEW VALUES TO load_status ENUM
-- ============================================

-- Add new values needed for GDC tracking
-- Existing values: available, sold, open, hold, in_transit, invoiced
-- New values needed: po_needed, not_invoiced, partially_paid, paid, disputed, delivered, closed, confirmed, processing

ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'po_needed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'not_invoiced';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'processing';

-- ============================================
-- STEP 2: ADD load_status COLUMN TO purchase_orders
-- ============================================

-- Add load_status column (using expanded load_status enum type)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS load_status load_status DEFAULT 'open';

COMMENT ON COLUMN purchase_orders.load_status IS 'Operations status for GDC tracking: OPEN, CLOSED, HOLD, IN_TRANSIT, AVAILABLE, SOLD, INVOICED, etc.';

-- Create index for filtering by load_status
CREATE INDEX IF NOT EXISTS idx_purchase_orders_load_status ON purchase_orders(load_status) WHERE deleted_at IS NULL;

-- ============================================
-- STEP 3: DATA MIGRATION - Set initial load_status based on PO status
-- ============================================

-- Map existing PO statuses to appropriate load_status values
UPDATE purchase_orders
SET load_status = CASE
    WHEN status = 'draft' THEN 'po_needed'::load_status
    WHEN status = 'sent' THEN 'open'::load_status
    WHEN status = 'confirmed' THEN 'confirmed'::load_status
    WHEN status = 'in_production' THEN 'open'::load_status
    WHEN status = 'ready_to_ship' THEN 'available'::load_status
    WHEN status = 'in_transit' THEN 'in_transit'::load_status
    WHEN status = 'partial' THEN 'open'::load_status
    WHEN status = 'received' THEN 'available'::load_status
    WHEN status = 'cancelled' THEN 'closed'::load_status
    ELSE 'open'::load_status
END
WHERE load_status IS NULL OR load_status = 'open';

-- ============================================
-- ROLLBACK SCRIPT (commented out)
-- ============================================

-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_purchase_orders_load_status;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS load_status;
-- Note: Cannot easily remove enum values once added (PostgreSQL limitation)
