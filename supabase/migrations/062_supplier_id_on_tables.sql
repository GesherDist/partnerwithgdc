-- ============================================
-- MIGRATION: 062_supplier_id_on_tables.sql
-- PURPOSE: Add supplier_id to purchase_orders and shipments for data isolation
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 061_user_supplier_link.sql
-- ============================================

-- ============================================
-- ADD SUPPLIER_ID TO PURCHASE ORDERS
-- ============================================

-- Add supplier_id column to purchase_orders
-- This allows RLS to filter POs by supplier
ALTER TABLE purchase_orders ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Create index for efficient filtering
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN purchase_orders.supplier_id IS 'Reference to supplier for portal access filtering';

-- ============================================
-- ADD SUPPLIER_ID TO SHIPMENTS
-- ============================================

-- Add supplier_id column to shipments
ALTER TABLE shipments ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Create index for efficient filtering
CREATE INDEX idx_shipments_supplier ON shipments(supplier_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN shipments.supplier_id IS 'Reference to supplier for portal access filtering';

-- ============================================
-- ADD SUPPLIER PORTAL FIELDS TO PURCHASE ORDERS
-- ============================================

-- Production status for supplier tracking
CREATE TYPE production_status AS ENUM (
  'not_started',
  'in_production',
  'ready_to_ship',
  'shipped'
);
COMMENT ON TYPE production_status IS 'Production status for supplier portal';

-- Add production tracking fields
ALTER TABLE purchase_orders
  ADD COLUMN production_status production_status DEFAULT 'not_started',
  ADD COLUMN supplier_confirmed_at TIMESTAMPTZ,
  ADD COLUMN supplier_confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN supplier_rejected_at TIMESTAMPTZ,
  ADD COLUMN supplier_rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN supplier_rejection_reason TEXT,
  ADD COLUMN expected_completion_date DATE,
  ADD COLUMN supplier_notes TEXT;

COMMENT ON COLUMN purchase_orders.production_status IS 'Current production status from supplier';
COMMENT ON COLUMN purchase_orders.supplier_confirmed_at IS 'When supplier confirmed/accepted the PO';
COMMENT ON COLUMN purchase_orders.supplier_confirmed_by IS 'User who confirmed the PO';
COMMENT ON COLUMN purchase_orders.supplier_rejected_at IS 'When supplier rejected the PO';
COMMENT ON COLUMN purchase_orders.supplier_rejected_by IS 'User who rejected the PO';
COMMENT ON COLUMN purchase_orders.supplier_rejection_reason IS 'Reason for rejection';
COMMENT ON COLUMN purchase_orders.expected_completion_date IS 'Expected production completion date';
COMMENT ON COLUMN purchase_orders.supplier_notes IS 'Notes from supplier';

-- ============================================
-- ADD SUPPLIER PORTAL FIELDS TO SHIPMENTS
-- ============================================

-- Add shipping detail fields for supplier updates
ALTER TABLE shipments
  ADD COLUMN container_number VARCHAR(50),
  ADD COLUMN bill_of_lading VARCHAR(100),
  ADD COLUMN vessel_name VARCHAR(200),
  ADD COLUMN port_of_loading VARCHAR(200),
  ADD COLUMN port_of_discharge VARCHAR(200),
  ADD COLUMN etd DATE,
  ADD COLUMN eta_port DATE,
  ADD COLUMN eta_customer DATE,
  ADD COLUMN supplier_updated_at TIMESTAMPTZ,
  ADD COLUMN supplier_updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN shipments.container_number IS 'Shipping container number';
COMMENT ON COLUMN shipments.bill_of_lading IS 'Bill of Lading number';
COMMENT ON COLUMN shipments.vessel_name IS 'Name of shipping vessel';
COMMENT ON COLUMN shipments.port_of_loading IS 'Port where goods are loaded';
COMMENT ON COLUMN shipments.port_of_discharge IS 'Destination port';
COMMENT ON COLUMN shipments.etd IS 'Estimated Time of Departure';
COMMENT ON COLUMN shipments.eta_port IS 'ETA at destination port';
COMMENT ON COLUMN shipments.eta_customer IS 'ETA at customer location';
COMMENT ON COLUMN shipments.supplier_updated_at IS 'When supplier last updated this shipment';
COMMENT ON COLUMN shipments.supplier_updated_by IS 'User who last updated from supplier portal';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- ALTER TABLE shipments DROP COLUMN IF EXISTS supplier_updated_by;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS supplier_updated_at;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS eta_customer;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS eta_port;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS etd;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS port_of_discharge;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS port_of_loading;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS vessel_name;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS bill_of_lading;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS container_number;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS supplier_notes;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS expected_completion_date;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS supplier_rejection_reason;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS supplier_rejected_by;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS supplier_rejected_at;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS supplier_confirmed_by;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS supplier_confirmed_at;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS production_status;
-- DROP TYPE IF EXISTS production_status;
-- DROP INDEX IF EXISTS idx_shipments_supplier;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS supplier_id;
-- DROP INDEX IF EXISTS idx_po_supplier;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS supplier_id;
