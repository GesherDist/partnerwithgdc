-- ============================================
-- Migration: 100_add_pipedrive_labels.sql
-- Description: Add pipedrive_labels column for lead labels from Pipedrive
-- Created: 2025-09-03
-- ============================================

-- Labels in Pipedrive are like "HOT", "WARM", "COLD", etc.
-- We store them as a JSONB array for flexibility

ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipedrive_labels JSONB DEFAULT '[]'::jsonb;

-- Create index for searching by labels
CREATE INDEX IF NOT EXISTS idx_leads_pipedrive_labels
  ON leads USING GIN (pipedrive_labels);

-- Add a comment to explain the column
COMMENT ON COLUMN leads.pipedrive_labels IS 'Array of label names from Pipedrive (e.g., ["HOT", "Qualified"])';
