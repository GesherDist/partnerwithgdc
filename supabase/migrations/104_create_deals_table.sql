-- ============================================
-- Migration: 104_create_deals_table.sql
-- Description: Create deals table for Pipedrive deals
-- Created: 2025-09-07
-- ============================================

-- ============================================
-- 1. Create deals table
-- ============================================

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  title VARCHAR(255) NOT NULL,

  -- Pipedrive IDs
  pipedrive_deal_id INTEGER UNIQUE,
  pipedrive_person_id INTEGER,
  pipedrive_org_id INTEGER,

  -- Value
  value DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'USD',

  -- Pipeline & Stage
  pipeline_id INTEGER,
  pipeline_name VARCHAR(255),
  stage_id INTEGER,
  stage_name VARCHAR(255),
  stage_order INTEGER,

  -- Status
  status VARCHAR(50) DEFAULT 'open', -- open, won, lost
  probability INTEGER,

  -- Dates
  expected_close_date DATE,
  won_time TIMESTAMPTZ,
  lost_time TIMESTAMPTZ,
  close_time TIMESTAMPTZ,

  -- Lost reason
  lost_reason VARCHAR(255),

  -- Contact & Organization (linked)
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(100),
  organization_name VARCHAR(255),

  -- Linked to Gesher entities
  customer_id UUID REFERENCES customers(id),
  lead_id UUID REFERENCES leads(id),

  -- Owner
  owner_id UUID REFERENCES users(id),
  pipedrive_owner_id INTEGER,
  pipedrive_owner_name VARCHAR(255),

  -- Sync tracking
  pipedrive_synced_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_pipedrive_deal_id ON deals(pipedrive_deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_id ON deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON deals(deleted_at);

-- ============================================
-- 2. Create deal_notes table
-- ============================================

CREATE TABLE IF NOT EXISTS deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Note content
  content TEXT NOT NULL,

  -- Pipedrive sync
  pipedrive_note_id INTEGER,
  synced_to_pipedrive BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_deal_notes_deal_id ON deal_notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_notes_pipedrive_note_id ON deal_notes(pipedrive_note_id);

-- ============================================
-- 3. Create deal_activities table
-- ============================================

CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Activity info
  activity_type VARCHAR(50) NOT NULL, -- call, meeting, task, email, deadline
  subject VARCHAR(255) NOT NULL,
  description TEXT,

  -- Status
  done BOOLEAN DEFAULT FALSE,
  due_date DATE,
  due_time TIME,
  completed_at TIMESTAMPTZ,

  -- Pipedrive sync
  pipedrive_activity_id INTEGER,
  synced_to_pipedrive BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_activities_done ON deal_activities(done);
CREATE INDEX IF NOT EXISTS idx_deal_activities_due_date ON deal_activities(due_date);

-- ============================================
-- 4. RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;

-- Deals policies
CREATE POLICY "Users can view all deals" ON deals
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert deals" ON deals
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update deals" ON deals
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete deals" ON deals
  FOR DELETE USING (auth.role() = 'authenticated');

-- Deal notes policies
CREATE POLICY "Users can view all deal notes" ON deal_notes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert deal notes" ON deal_notes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update deal notes" ON deal_notes
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete deal notes" ON deal_notes
  FOR DELETE USING (auth.role() = 'authenticated');

-- Deal activities policies
CREATE POLICY "Users can view all deal activities" ON deal_activities
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert deal activities" ON deal_activities
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update deal activities" ON deal_activities
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete deal activities" ON deal_activities
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 5. Updated_at triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_updated_at ON deals;
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deals_updated_at();

DROP TRIGGER IF EXISTS deal_notes_updated_at ON deal_notes;
CREATE TRIGGER deal_notes_updated_at
  BEFORE UPDATE ON deal_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_deals_updated_at();

DROP TRIGGER IF EXISTS deal_activities_updated_at ON deal_activities;
CREATE TRIGGER deal_activities_updated_at
  BEFORE UPDATE ON deal_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_deals_updated_at();
