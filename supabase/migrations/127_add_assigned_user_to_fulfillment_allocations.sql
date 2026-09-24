-- ============================================
-- MIGRATION: 127_add_assigned_user_to_fulfillment_allocations.sql
-- PURPOSE: Add assigned_user_id to fulfillment_allocations for warehouse worker assignment
-- DATE: 2026-09-18
-- ============================================

-- Add assigned_user_id column to fulfillment_allocations
ALTER TABLE fulfillment_allocations
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_user
ON fulfillment_allocations(assigned_user_id)
WHERE assigned_user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN fulfillment_allocations.assigned_user_id IS 'Warehouse worker (user) assigned to handle this allocation (for creating pick tickets with assigned_to field)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 127 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added: assigned_user_id to fulfillment_allocations';
  RAISE NOTICE 'Purpose: Allow assignment of warehouse workers to GDC inventory allocations';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  - assigned_contact_id: Location contact for email/phone notifications';
  RAISE NOTICE '  - assigned_user_id: Warehouse worker for pick ticket assignment';
  RAISE NOTICE '';
END $$;
