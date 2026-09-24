-- ============================================
-- Migration: 098_pipedrive_integration.sql
-- Description: Add Pipedrive integration tables and fields
-- Created: 2025-09-03
-- ============================================

-- ============================================
-- 1. Add Pipedrive fields to customers table
-- ============================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS pipedrive_person_id INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pipedrive_org_id INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pipedrive_deal_id INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pipedrive_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_pipedrive_person_id ON customers(pipedrive_person_id);
CREATE INDEX IF NOT EXISTS idx_customers_pipedrive_org_id ON customers(pipedrive_org_id);

-- ============================================
-- 2. Create leads table
-- ============================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),

  -- Address
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(100),

  -- Pipedrive IDs
  pipedrive_person_id INTEGER UNIQUE,
  pipedrive_deal_id INTEGER,
  pipedrive_org_id INTEGER,

  -- Deal Info
  deal_title VARCHAR(255),
  deal_value DECIMAL(12,2),
  deal_currency VARCHAR(3) DEFAULT 'USD',
  deal_stage VARCHAR(100),
  deal_stage_id INTEGER,
  deal_pipeline VARCHAR(100),
  deal_pipeline_id INTEGER,
  deal_probability INTEGER,
  deal_status VARCHAR(50), -- open, won, lost
  expected_close_date DATE,
  deal_won_time TIMESTAMPTZ,
  deal_lost_time TIMESTAMPTZ,
  deal_lost_reason VARCHAR(255),

  -- Source & Status
  source VARCHAR(100), -- 'pipedrive', 'trade_show', 'referral', 'cold_call', 'website', 'manual'
  source_detail VARCHAR(255), -- e.g., "Detroit Trade Show 2025"
  status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, proposal, negotiation, converted, lost

  -- Owner
  owner_id UUID REFERENCES users(id),
  pipedrive_owner_id INTEGER,
  pipedrive_owner_name VARCHAR(255),

  -- Notes
  notes TEXT,

  -- Conversion tracking
  converted_customer_id UUID REFERENCES customers(id),
  converted_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ
);

-- Indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_pipedrive_person_id ON leads(pipedrive_person_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipedrive_deal_id ON leads(pipedrive_deal_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_deal_status ON leads(deal_status);
CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_converted_customer_id ON leads(converted_customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at);

-- ============================================
-- 3. Create pipedrive_sync_log table (for debugging/audit)
-- ============================================

CREATE TABLE IF NOT EXISTS pipedrive_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event Info
  event_type VARCHAR(50) NOT NULL, -- 'sync', 'webhook', 'push'
  direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
  entity_type VARCHAR(50) NOT NULL, -- 'person', 'deal', 'note', 'organization'

  -- IDs
  entity_id UUID, -- Gesher entity ID
  pipedrive_id INTEGER, -- Pipedrive entity ID

  -- Payload
  payload JSONB,

  -- Result
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'skipped'
  error_message TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_log_event_type ON pipedrive_sync_log(event_type);
CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_log_entity_type ON pipedrive_sync_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_log_status ON pipedrive_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_log_created_at ON pipedrive_sync_log(created_at);

-- ============================================
-- 4. Create lead_notes table (for tracking notes separately)
-- ============================================

CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

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

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_pipedrive_note_id ON lead_notes(pipedrive_note_id);

-- ============================================
-- 5. RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipedrive_sync_log ENABLE ROW LEVEL SECURITY;

-- Leads policies
CREATE POLICY "Users can view all leads" ON leads
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert leads" ON leads
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update leads" ON leads
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete leads" ON leads
  FOR DELETE USING (auth.role() = 'authenticated');

-- Lead notes policies
CREATE POLICY "Users can view all lead notes" ON lead_notes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert lead notes" ON lead_notes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update lead notes" ON lead_notes
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete lead notes" ON lead_notes
  FOR DELETE USING (auth.role() = 'authenticated');

-- Sync log policies (admin only or service role)
CREATE POLICY "Users can view sync logs" ON pipedrive_sync_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service can insert sync logs" ON pipedrive_sync_log
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 6. Updated_at trigger for leads
-- ============================================

CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

-- Same for lead_notes
DROP TRIGGER IF EXISTS lead_notes_updated_at ON lead_notes;
CREATE TRIGGER lead_notes_updated_at
  BEFORE UPDATE ON lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();
