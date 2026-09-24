-- Migration: Add assigned_contact_id column to pick_tickets table
-- Purpose: Allow pick tickets to be assigned to location contacts (warehouse workers)
-- Date: 2024-09-23
-- Issue: Column was missing in live database, causing pick ticket creation to fail

-- Add assigned_contact_id column for location contact assignment
ALTER TABLE pick_tickets
ADD COLUMN IF NOT EXISTS assigned_contact_id UUID REFERENCES location_contacts(id) ON DELETE SET NULL;

-- Add index for the new column (improves query performance)
CREATE INDEX IF NOT EXISTS idx_pick_tickets_assigned_contact
ON pick_tickets(assigned_contact_id) WHERE deleted_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN pick_tickets.assigned_to IS 'UUID of assigned system user (from users table)';
COMMENT ON COLUMN pick_tickets.assigned_contact_id IS 'UUID of assigned location contact (from location_contacts table)';

-- Verify the column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pick_tickets'
    AND column_name = 'assigned_contact_id'
  ) THEN
    RAISE EXCEPTION 'Failed to add assigned_contact_id column to pick_tickets table';
  END IF;

  RAISE NOTICE 'Successfully added assigned_contact_id column to pick_tickets table';
END $$;
