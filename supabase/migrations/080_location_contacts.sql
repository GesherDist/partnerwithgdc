-- ============================================
-- MIGRATION: 080_location_contacts.sql
-- PURPOSE: Create location_contacts table for warehouse workers who receive pick ticket emails
-- DATE: 2025-08-18
-- NOTE: These are NOT system users - they don't login, just receive emails
-- ============================================

-- Create location_contacts table
CREATE TABLE IF NOT EXISTS location_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Contact details
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_location_contacts_location ON location_contacts(location_id);
CREATE INDEX IF NOT EXISTS idx_location_contacts_email ON location_contacts(email);
CREATE INDEX IF NOT EXISTS idx_location_contacts_active ON location_contacts(location_id) WHERE is_active = true;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP TABLE IF EXISTS location_contacts;
