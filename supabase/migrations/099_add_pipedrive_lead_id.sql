-- ============================================
-- Migration: 099_add_pipedrive_lead_id.sql
-- Description: Add pipedrive_lead_id column for Leads Inbox sync
-- Created: 2025-09-03
-- ============================================

-- Pipedrive Leads Inbox uses UUID IDs, not integers like Persons
-- We need a separate column to track leads from Leads Inbox

ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipedrive_lead_id VARCHAR(255);

-- Create unique index for pipedrive_lead_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_pipedrive_lead_id
  ON leads(pipedrive_lead_id)
  WHERE pipedrive_lead_id IS NOT NULL AND deleted_at IS NULL;
