-- ============================================
-- MIGRATION: 166_pipedrive_sync_snapshot.sql
-- PURPOSE: "Sync with Pipedrive" button (two-way). Stores the values both
--          systems agreed on at the last sync, so each side's changes since
--          then can be told apart field by field. When both sides changed a
--          field, the ERP wins.
-- DATE: 2026-10-22
-- ============================================
-- Customers: name, street, city, state, zip, country
-- Contacts:  name, email, phone, mobile, type
-- Values are normalized (lower case, digits only for phones). NULL = never
-- synced: the ERP wins, and Pipedrive only fills fields empty in the ERP.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS pipedrive_sync_snapshot JSONB;

ALTER TABLE customer_contacts
  ADD COLUMN IF NOT EXISTS pipedrive_sync_snapshot JSONB;
