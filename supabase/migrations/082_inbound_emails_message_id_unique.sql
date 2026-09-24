-- ============================================
-- MIGRATION: 082_inbound_emails_message_id_unique.sql
-- PURPOSE: Add unique constraint on inbound_emails.message_id for idempotency
-- AUTHOR: System
-- DATE: 2025-08-19
-- DEPENDS ON: 054_inbound_emails_table.sql
-- ============================================

-- Add unique constraint on message_id to prevent duplicate processing
-- This ensures webhook retries don't create duplicate email records
ALTER TABLE inbound_emails
ADD CONSTRAINT inbound_emails_message_id_unique UNIQUE (message_id);

-- Add index for faster lookups (if not already covered by unique constraint)
CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON inbound_emails(message_id);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON CONSTRAINT inbound_emails_message_id_unique ON inbound_emails IS
  'Ensures idempotency for webhook processing - prevents duplicate email records from retries';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_inbound_emails_message_id;
-- ALTER TABLE inbound_emails DROP CONSTRAINT IF EXISTS inbound_emails_message_id_unique;
