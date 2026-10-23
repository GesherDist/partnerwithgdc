-- ============================================
-- MIGRATION: 167_pipedrive_linked_account.sql
-- PURPOSE: Remember which Pipedrive account (company) the Pipedrive IDs
--          stored in Gesher belong to, even after a disconnect. Connecting a
--          DIFFERENT account (e.g. sandbox -> live) then clears those IDs so
--          nothing is written to the wrong deals / organizations, and webhook
--          events from another account are ignored.
-- DATE: 2026-10-23
-- ============================================
-- linked_account = {
--   "companyId": "12345", "companyName": "Gesher Distribution",
--   "linkedAt": "...",
--   "lastSwitch": { "from": {...}, "to": {...}, "at": "...", "cleared": {...},
--                   "acknowledged": false }
-- }

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS linked_account JSONB;

-- Start from the account connected today: its IDs are the ones stored now
UPDATE integrations i
SET linked_account = jsonb_build_object(
  'companyId', c.metadata->>'companyId',
  'companyName', c.metadata->>'companyName',
  'linkedAt', NOW()
)
FROM integration_connections c
WHERE i.provider = 'pipedrive'
  AND c.integration_id = i.id
  AND c.deleted_at IS NULL
  AND c.metadata->>'companyId' IS NOT NULL
  AND i.linked_account IS NULL;
