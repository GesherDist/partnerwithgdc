-- ============================================
-- Migration: 106_add_address_to_deals.sql
-- Description: Add address fields to deals table for organization address sync
-- Created: 2025-09-08
-- ============================================

-- Add address columns to deals table
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS organization_address_street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS organization_address_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS organization_address_state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS organization_address_postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS organization_address_country VARCHAR(100);

-- Add index for faster queries on city/state (common filters)
CREATE INDEX IF NOT EXISTS idx_deals_org_city ON deals(organization_address_city);
CREATE INDEX IF NOT EXISTS idx_deals_org_state ON deals(organization_address_state);

-- Add comment
COMMENT ON COLUMN deals.organization_address_street IS 'Organization street address from Pipedrive';
COMMENT ON COLUMN deals.organization_address_city IS 'Organization city from Pipedrive';
COMMENT ON COLUMN deals.organization_address_state IS 'Organization state/province from Pipedrive';
COMMENT ON COLUMN deals.organization_address_postal_code IS 'Organization postal/ZIP code from Pipedrive';
COMMENT ON COLUMN deals.organization_address_country IS 'Organization country from Pipedrive';
