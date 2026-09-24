-- ============================================
-- MIGRATION: 081_shipping_tracking.sql
-- PURPOSE: Add shipping tracking fields and tables for AI email agent
-- AUTHOR: System
-- DATE: 2025-08-18
-- DEPENDS ON: 019_shipments_tables.sql, 054_inbound_emails_table.sql
-- ============================================

-- ============================================
-- TRACKING STATUS ENUM
-- ============================================

CREATE TYPE shipment_tracking_status AS ENUM (
  'booked',              -- Shipment booked, not yet picked
  'container_picked',    -- Container collected from port/yard
  'loaded_on_vessel',    -- On the ship
  'departed_origin',     -- Ship has sailed from origin
  'in_transit',          -- On the ocean
  'arrived_port',        -- Arrived at US port
  'customs_clearance',   -- Going through customs
  'on_rail',             -- On train to inland destination
  'at_ramp',             -- Arrived at rail ramp
  'out_for_delivery',    -- Being delivered
  'delivered',           -- Delivered to consignee
  'exception'            -- Problem occurred
);
COMMENT ON TYPE shipment_tracking_status IS 'Container tracking status from shipping emails';

-- ============================================
-- ISSUE TYPE ENUM
-- ============================================

CREATE TYPE shipment_issue_type AS ENUM (
  'container_damaged',   -- Physical damage to container/cargo
  'transload_required',  -- Need to move cargo to new container
  'customs_hold',        -- Held by customs for inspection
  'delayed',             -- Behind schedule
  'lfd_approaching',     -- Last Free Day is soon
  'demurrage_risk',      -- Risk of storage charges
  'address_change',      -- Delivery address changed
  'additional_charges'   -- Extra fees needed
);
COMMENT ON TYPE shipment_issue_type IS 'Types of issues detected from shipping emails';

-- ============================================
-- ADD TRACKING FIELDS TO SHIPMENTS TABLE
-- ============================================

-- Container Information
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS container_number VARCHAR(20);
COMMENT ON COLUMN shipments.container_number IS 'Container number (e.g., TCLU8042633)';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS mbl_number VARCHAR(50);
COMMENT ON COLUMN shipments.mbl_number IS 'Master Bill of Lading number (e.g., SEAOTB17624)';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS vessel_name VARCHAR(100);
COMMENT ON COLUMN shipments.vessel_name IS 'Name of the vessel';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS voyage_number VARCHAR(50);
COMMENT ON COLUMN shipments.voyage_number IS 'Voyage number';

-- Port Information
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS port_of_loading VARCHAR(100);
COMMENT ON COLUMN shipments.port_of_loading IS 'Port where container was loaded (POL)';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS port_of_discharge VARCHAR(100);
COMMENT ON COLUMN shipments.port_of_discharge IS 'Port where container will be discharged (POD)';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS final_destination VARCHAR(100);
COMMENT ON COLUMN shipments.final_destination IS 'Final destination (FPD)';

-- Dates from tracking
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS eta_port_tracking DATE;
COMMENT ON COLUMN shipments.eta_port_tracking IS 'ETA to port from tracking emails';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS eta_ramp DATE;
COMMENT ON COLUMN shipments.eta_ramp IS 'ETA to rail ramp';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS lfd_date DATE;
COMMENT ON COLUMN shipments.lfd_date IS 'Last Free Day - deadline before demurrage charges';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS actual_arrival_port DATE;
COMMENT ON COLUMN shipments.actual_arrival_port IS 'Actual arrival date at port';

-- Tracking Status
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS tracking_status shipment_tracking_status;
COMMENT ON COLUMN shipments.tracking_status IS 'Current tracking status from emails';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS last_tracking_update TIMESTAMPTZ;
COMMENT ON COLUMN shipments.last_tracking_update IS 'When tracking was last updated';

-- Issue Tracking
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS has_issue BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN shipments.has_issue IS 'Flag indicating if there is an issue with shipment';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS issue_type shipment_issue_type;
COMMENT ON COLUMN shipments.issue_type IS 'Type of issue if has_issue is true';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS issue_description TEXT;
COMMENT ON COLUMN shipments.issue_description IS 'Description of the issue';

-- Transload Information
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transload_container VARCHAR(20);
COMMENT ON COLUMN shipments.transload_container IS 'New container number if transloaded';

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS is_transloaded BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN shipments.is_transloaded IS 'Flag indicating if cargo was transloaded to new container';

-- ============================================
-- SHIPPING EMAILS TABLE
-- ============================================

CREATE TABLE shipping_emails (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to raw email
  inbound_email_id UUID NOT NULL REFERENCES inbound_emails(id) ON DELETE CASCADE,

  -- Link to shipment (if matched)
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,

  -- Extracted Data
  container_number VARCHAR(20),
  mbl_number VARCHAR(50),
  so_number VARCHAR(50),
  vessel_name VARCHAR(100),
  voyage_number VARCHAR(50),

  -- Detected Status
  detected_status shipment_tracking_status,
  status_description TEXT,
  current_location VARCHAR(200),

  -- Dates
  eta_port DATE,
  eta_ramp DATE,
  lfd_date DATE,
  delivery_date DATE,

  -- Issue Detection
  has_issue BOOLEAN DEFAULT FALSE,
  issue_type shipment_issue_type,
  issue_description TEXT,

  -- Transload
  is_transload BOOLEAN DEFAULT FALSE,
  new_container_number VARCHAR(20),

  -- Processing Status
  is_processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  is_matched BOOLEAN DEFAULT FALSE,

  -- AI Extraction
  extraction_confidence DECIMAL(3,2),
  raw_extraction JSONB,
  key_points JSONB,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SHIPMENT STATUS HISTORY TABLE
-- ============================================

CREATE TABLE shipment_status_history (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to shipment
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,

  -- Status Information
  status shipment_tracking_status NOT NULL,
  status_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Location
  location VARCHAR(200),

  -- Source
  inbound_email_id UUID REFERENCES inbound_emails(id) ON DELETE SET NULL,
  shipping_email_id UUID REFERENCES shipping_emails(id) ON DELETE SET NULL,

  -- Details
  notes TEXT,
  raw_extract JSONB,

  -- Who/When
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- Shipments tracking indexes
CREATE INDEX IF NOT EXISTS idx_shipments_container_number ON shipments(container_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_mbl_number ON shipments(mbl_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_status ON shipments(tracking_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_has_issue ON shipments(has_issue) WHERE deleted_at IS NULL AND has_issue = TRUE;
CREATE INDEX IF NOT EXISTS idx_shipments_lfd_date ON shipments(lfd_date) WHERE deleted_at IS NULL;

-- Shipping emails indexes
CREATE INDEX idx_shipping_emails_inbound_email ON shipping_emails(inbound_email_id);
CREATE INDEX idx_shipping_emails_shipment ON shipping_emails(shipment_id);
CREATE INDEX idx_shipping_emails_container ON shipping_emails(container_number);
CREATE INDEX idx_shipping_emails_so_number ON shipping_emails(so_number);
CREATE INDEX idx_shipping_emails_processed ON shipping_emails(is_processed);
CREATE INDEX idx_shipping_emails_has_issue ON shipping_emails(has_issue) WHERE has_issue = TRUE;
CREATE INDEX idx_shipping_emails_created ON shipping_emails(created_at DESC);

-- Status history indexes
CREATE INDEX idx_shipment_status_history_shipment ON shipment_status_history(shipment_id);
CREATE INDEX idx_shipment_status_history_status ON shipment_status_history(status);
CREATE INDEX idx_shipment_status_history_date ON shipment_status_history(status_date DESC);
CREATE INDEX idx_shipment_status_history_email ON shipment_status_history(inbound_email_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for shipping_emails
CREATE TRIGGER trg_shipping_emails_updated_at
  BEFORE UPDATE ON shipping_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE shipping_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_status_history ENABLE ROW LEVEL SECURITY;

-- Shipping emails - allow authenticated users to view
CREATE POLICY shipping_emails_select ON shipping_emails
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow service role full access (for webhook processing)
CREATE POLICY shipping_emails_service_insert ON shipping_emails
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY shipping_emails_service_update ON shipping_emails
  FOR UPDATE
  USING (true);

-- Status history - allow authenticated users to view
CREATE POLICY shipment_status_history_select ON shipment_status_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow service role full access
CREATE POLICY shipment_status_history_service_insert ON shipment_status_history
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE shipping_emails IS 'Stores extracted data from shipping tracking emails';
COMMENT ON COLUMN shipping_emails.extraction_confidence IS 'AI confidence score 0.00 to 1.00';
COMMENT ON COLUMN shipping_emails.raw_extraction IS 'Complete JSON extraction from AI';
COMMENT ON COLUMN shipping_emails.key_points IS 'Array of key points extracted from email';

COMMENT ON TABLE shipment_status_history IS 'Audit trail of all shipment status changes from emails';
COMMENT ON COLUMN shipment_status_history.status_date IS 'When this status was detected/reported';
COMMENT ON COLUMN shipment_status_history.location IS 'Location at time of status update';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP TRIGGER IF EXISTS trg_shipping_emails_updated_at ON shipping_emails;
-- DROP POLICY IF EXISTS shipment_status_history_service_insert ON shipment_status_history;
-- DROP POLICY IF EXISTS shipment_status_history_select ON shipment_status_history;
-- DROP POLICY IF EXISTS shipping_emails_service_update ON shipping_emails;
-- DROP POLICY IF EXISTS shipping_emails_service_insert ON shipping_emails;
-- DROP POLICY IF EXISTS shipping_emails_select ON shipping_emails;
-- DROP TABLE IF EXISTS shipment_status_history;
-- DROP TABLE IF EXISTS shipping_emails;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS is_transloaded;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS transload_container;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS issue_description;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS issue_type;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS has_issue;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS last_tracking_update;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS tracking_status;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS actual_arrival_port;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS lfd_date;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS eta_ramp;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS eta_port_tracking;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS final_destination;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS port_of_discharge;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS port_of_loading;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS voyage_number;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS vessel_name;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS mbl_number;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS container_number;
-- DROP TYPE IF EXISTS shipment_issue_type;
-- DROP TYPE IF EXISTS shipment_tracking_status;
