-- Migration: Add separate field for location contact assignment in pick tickets
-- Purpose: Add assigned_contact_id column for location contacts (separate from assigned_to for users)
-- Date: 2025-08-31

-- Re-add the foreign key constraint on assigned_to if it was dropped
-- (This ensures assigned_to only references users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pick_tickets_assigned_to_fkey'
  ) THEN
    ALTER TABLE pick_tickets
    ADD CONSTRAINT pick_tickets_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add new column for location contact assignment
ALTER TABLE pick_tickets
ADD COLUMN IF NOT EXISTS assigned_contact_id UUID REFERENCES location_contacts(id) ON DELETE SET NULL;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_pick_tickets_assigned_contact
ON pick_tickets(assigned_contact_id) WHERE deleted_at IS NULL;

-- Add comments
COMMENT ON COLUMN pick_tickets.assigned_to IS 'UUID of assigned system user (from users table)';
COMMENT ON COLUMN pick_tickets.assigned_contact_id IS 'UUID of assigned location contact (from location_contacts table)';
