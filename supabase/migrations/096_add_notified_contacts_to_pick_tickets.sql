-- Migration: Add notified_contact_ids to pick_tickets table
-- Purpose: Store which location contacts were notified when pick ticket was created

-- Add notified_contact_ids column (array of UUIDs)
ALTER TABLE pick_tickets
ADD COLUMN IF NOT EXISTS notified_contact_ids UUID[] DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN pick_tickets.notified_contact_ids IS 'Array of location_contact IDs who were notified via email when pick ticket was created';

-- Create index for searching by contact
CREATE INDEX IF NOT EXISTS idx_pick_tickets_notified_contacts
ON pick_tickets USING GIN (notified_contact_ids);
