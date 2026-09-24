-- ============================================
-- MIGRATION: 125_add_assigned_contact_to_fulfillment_allocations.sql
-- PURPOSE: Add assigned_contact_id to fulfillment_allocations for location contact assignment
-- DATE: 2026-09-18
-- ============================================

-- Add assigned_contact_id column to fulfillment_allocations
ALTER TABLE fulfillment_allocations
ADD COLUMN IF NOT EXISTS assigned_contact_id UUID REFERENCES location_contacts(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fulfillment_allocations_contact
ON fulfillment_allocations(assigned_contact_id)
WHERE assigned_contact_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN fulfillment_allocations.assigned_contact_id IS 'Location contact assigned to handle this allocation (for GDC inventory allocations)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 125 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added: assigned_contact_id to fulfillment_allocations';
  RAISE NOTICE 'Purpose: Allow assignment of location contacts to warehouse allocations';
  RAISE NOTICE '';
END $$;
