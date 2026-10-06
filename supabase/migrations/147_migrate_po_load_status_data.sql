-- ============================================
-- Migration: Migrate PO load_status Data
-- Date: 2026-10-06
-- Description: Set initial load_status values based on PO status
-- Note: Runs AFTER migration 146 (enum values added)
-- ============================================

-- Prerequisites:
-- - Migration 140: load_status column added to purchase_orders
-- - Migration 146: All enum values added to load_status and po_status

-- ============================================
-- STEP 1: Ensure column exists (safety check)
-- ============================================

-- Add column if migration 140 failed
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS load_status load_status DEFAULT 'open';

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_purchase_orders_load_status ON purchase_orders(load_status) WHERE deleted_at IS NULL;

-- ============================================
-- STEP 2: Data Migration - Map PO status to load_status
-- ============================================

-- Map existing PO statuses to appropriate load_status values
-- This uses the new enum values added in migration 146
UPDATE purchase_orders
SET load_status = CASE
    WHEN status = 'draft' THEN 'po_needed'::load_status
    WHEN status = 'sent' THEN 'open'::load_status
    WHEN status = 'confirmed' THEN 'open'::load_status
    WHEN status = 'available' THEN 'available'::load_status
    WHEN status = 'sold' THEN 'sold'::load_status
    WHEN status = 'in_production' THEN 'open'::load_status
    WHEN status = 'ready_to_ship' THEN 'available'::load_status
    WHEN status = 'in_transit' THEN 'in_transit'::load_status
    WHEN status = 'partial' THEN 'open'::load_status
    WHEN status = 'received' THEN 'available'::load_status
    WHEN status = 'cancelled' THEN 'closed'::load_status
    WHEN status = 'invoiced' THEN 'invoiced'::load_status
    WHEN status = 'not_invoiced' THEN 'not_invoiced'::load_status
    WHEN status = 'closed' THEN 'closed'::load_status
    WHEN status = 'hold' THEN 'hold'::load_status
    WHEN status = 'paid' THEN 'paid'::load_status
    WHEN status = 'partially_paid' THEN 'partially_paid'::load_status
    WHEN status = 'disputed' THEN 'disputed'::load_status
    ELSE 'open'::load_status
END
WHERE deleted_at IS NULL;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  total_count INTEGER;
  updated_count INTEGER;
BEGIN
  -- Count total POs
  SELECT COUNT(*) INTO total_count
  FROM purchase_orders
  WHERE deleted_at IS NULL;

  -- Count POs with load_status set
  SELECT COUNT(*) INTO updated_count
  FROM purchase_orders
  WHERE deleted_at IS NULL AND load_status IS NOT NULL;

  RAISE NOTICE '✅ Migration 147 completed successfully';
  RAISE NOTICE 'Total POs: %, POs with load_status: %', total_count, updated_count;
END $$;
