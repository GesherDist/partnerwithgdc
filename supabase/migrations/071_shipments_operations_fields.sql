-- ============================================
-- MIGRATION: 071_shipments_operations_fields.sql
-- PURPOSE: Add operations tracking fields to shipments table for Jenny's dashboard
-- AUTHOR: System
-- DATE: 2025-08-13
-- DEPENDS ON: 019_shipments_tables.sql
-- ============================================

-- ============================================
-- LOAD STATUS ENUM (Jenny's status values)
-- ============================================

CREATE TYPE load_status AS ENUM (
  'available',    -- AVAILABLE: Ready to sell/ship from inventory
  'sold',         -- SOLD: Committed to customer
  'open',         -- OPEN: In process, pending actions
  'hold',         -- HOLD: On hold for some reason
  'in_transit',   -- IN_TRANSIT: Currently shipping
  'invoiced'      -- INVOICED: Invoice sent to customer
);
COMMENT ON TYPE load_status IS 'Operations status for load/shipment tracking (Jenny dashboard)';

-- ============================================
-- ADD NEW FIELDS TO SHIPMENTS TABLE
-- ============================================

-- Supplier Reference (Galileo's Sales Order number)
ALTER TABLE shipments ADD COLUMN supplier_reference_number VARCHAR(50);
COMMENT ON COLUMN shipments.supplier_reference_number IS 'Supplier reference number (e.g., Galileo SO# like SO2600023)';

-- Port Arrival Dates (Ocean shipping specific)
ALTER TABLE shipments ADD COLUMN eta_to_port DATE;
COMMENT ON COLUMN shipments.eta_to_port IS 'Estimated arrival date at US port (first leg of ocean shipping)';

ALTER TABLE shipments ADD COLUMN confirmed_eta DATE;
COMMENT ON COLUMN shipments.confirmed_eta IS 'Supplier confirmed ETA date';

-- Customer Expected Delivery
ALTER TABLE shipments ADD COLUMN customer_expected_delivery DATE;
COMMENT ON COLUMN shipments.customer_expected_delivery IS 'Date customer expects delivery';

-- Quantity Tracking
ALTER TABLE shipments ADD COLUMN qty_delivered INTEGER DEFAULT 0;
COMMENT ON COLUMN shipments.qty_delivered IS 'Quantity delivered so far (for partial deliveries)';

ALTER TABLE shipments ADD COLUMN outstanding_qty INTEGER DEFAULT 0;
COMMENT ON COLUMN shipments.outstanding_qty IS 'Remaining quantity to deliver';

ALTER TABLE shipments ADD COLUMN total_qty INTEGER DEFAULT 0;
COMMENT ON COLUMN shipments.total_qty IS 'Total quantity in this shipment/load';

-- Supplier Invoice Information
ALTER TABLE shipments ADD COLUMN supplier_invoice_number VARCHAR(50);
COMMENT ON COLUMN shipments.supplier_invoice_number IS 'Supplier invoice number (e.g., Galileo invoice #)';

ALTER TABLE shipments ADD COLUMN supplier_invoice_amount DECIMAL(12, 2);
COMMENT ON COLUMN shipments.supplier_invoice_amount IS 'Supplier invoice total amount';

-- Payment Milestones (50%/50% terms common with suppliers)
ALTER TABLE shipments ADD COLUMN payment_50_percent_date DATE;
COMMENT ON COLUMN shipments.payment_50_percent_date IS 'Date when 50% payment was made';

ALTER TABLE shipments ADD COLUMN remaining_50_due_date DATE;
COMMENT ON COLUMN shipments.remaining_50_due_date IS 'Date when remaining 50% payment is due';

-- Operations Notes
ALTER TABLE shipments ADD COLUMN action_required TEXT;
COMMENT ON COLUMN shipments.action_required IS 'Operations action items (e.g., "Galileo will Invoice | In Transit to Port")';

ALTER TABLE shipments ADD COLUMN executive_notes TEXT;
COMMENT ON COLUMN shipments.executive_notes IS 'Executive/management notes (Ankur notes)';

-- Delay Flag
ALTER TABLE shipments ADD COLUMN is_delayed BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN shipments.is_delayed IS 'Flag indicating if shipment is delayed';

-- Operations Load Status (different from existing shipment status)
ALTER TABLE shipments ADD COLUMN load_status load_status DEFAULT 'open';
COMMENT ON COLUMN shipments.load_status IS 'Operations status: available, sold, open, hold, in_transit, invoiced';

-- Customer Ship Window (date range)
ALTER TABLE shipments ADD COLUMN customer_ship_window_start DATE;
COMMENT ON COLUMN shipments.customer_ship_window_start IS 'Customer ship window start date';

ALTER TABLE shipments ADD COLUMN customer_ship_window_end DATE;
COMMENT ON COLUMN shipments.customer_ship_window_end IS 'Customer ship window end date';

-- ============================================
-- INDEXES FOR NEW FIELDS
-- ============================================

CREATE INDEX idx_shipments_supplier_ref ON shipments(supplier_reference_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_eta_to_port ON shipments(eta_to_port) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_load_status ON shipments(load_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_is_delayed ON shipments(is_delayed) WHERE deleted_at IS NULL AND is_delayed = TRUE;
CREATE INDEX idx_shipments_customer_expected ON shipments(customer_expected_delivery) WHERE deleted_at IS NULL;

-- ============================================
-- CONSTRAINT FOR SHIP WINDOW
-- ============================================

ALTER TABLE shipments ADD CONSTRAINT shipments_ship_window_valid CHECK (
  customer_ship_window_start IS NULL OR
  customer_ship_window_end IS NULL OR
  customer_ship_window_end >= customer_ship_window_start
);

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_ship_window_valid;
-- DROP INDEX IF EXISTS idx_shipments_customer_expected;
-- DROP INDEX IF EXISTS idx_shipments_is_delayed;
-- DROP INDEX IF EXISTS idx_shipments_load_status;
-- DROP INDEX IF EXISTS idx_shipments_eta_to_port;
-- DROP INDEX IF EXISTS idx_shipments_supplier_ref;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS customer_ship_window_end;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS customer_ship_window_start;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS load_status;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS is_delayed;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS executive_notes;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS action_required;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS remaining_50_due_date;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS payment_50_percent_date;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS supplier_invoice_amount;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS supplier_invoice_number;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS total_qty;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS outstanding_qty;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS qty_delivered;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS customer_expected_delivery;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS confirmed_eta;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS eta_to_port;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS supplier_reference_number;
-- DROP TYPE IF EXISTS load_status;
