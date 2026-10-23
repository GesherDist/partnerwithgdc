-- ============================================
-- MIGRATION: 165_customer_contacts_pipedrive_person.sql
-- PURPOSE: Two-way contact sync with Pipedrive. Each ERP customer contact
--          links to its Pipedrive person, so edits on either side reach
--          the same record.
-- DATE: 2026-10-21
-- ============================================
-- The link stays on a soft-deleted contact, so later edits of that person
-- in Pipedrive do not create the contact again in the ERP.

ALTER TABLE customer_contacts
  ADD COLUMN IF NOT EXISTS pipedrive_person_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_customer_contacts_pipedrive_person_id
  ON customer_contacts(pipedrive_person_id)
  WHERE pipedrive_person_id IS NOT NULL;
