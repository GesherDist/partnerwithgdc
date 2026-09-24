-- ============================================
-- MIGRATION: 019_shipments_tables.sql
-- PURPOSE: Shipments and Shipment Items tables
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 3
-- DEPENDS ON: 018_purchase_orders_tables.sql
-- ============================================

-- ============================================
-- SHIPMENT STATUS ENUM
-- ============================================

CREATE TYPE shipment_status AS ENUM (
  'pending',
  'in_transit',
  'delivered',
  'failed'
);
COMMENT ON TYPE shipment_status IS 'Shipment workflow status';

-- ============================================
-- SHIPMENTS TABLE
-- ============================================

CREATE TABLE shipments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Shipment Identity
  shipment_number VARCHAR(50) NOT NULL,
  shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  estimated_arrival DATE,
  actual_arrival DATE,

  -- Relationships (Chain Links)
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,

  -- Carrier Information
  carrier VARCHAR(100),
  tracking_number VARCHAR(100),
  service_type VARCHAR(100),

  -- Locations
  from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Ship To Address (denormalized for historical record)
  ship_to_name VARCHAR(255),
  ship_to_address_street VARCHAR(200),
  ship_to_address_city VARCHAR(100),
  ship_to_address_state VARCHAR(50),
  ship_to_address_postal_code VARCHAR(20),
  ship_to_address_country VARCHAR(50) DEFAULT 'US',

  -- Shipment Details
  total_weight DECIMAL(10, 2),
  weight_unit VARCHAR(10) DEFAULT 'lbs',
  total_packages INTEGER DEFAULT 1,

  -- Status
  status shipment_status NOT NULL DEFAULT 'pending',

  -- Notes
  notes TEXT,
  delivery_instructions TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT shipments_number_format CHECK (shipment_number ~ '^SH-[0-9]{4}-[0-9]{5}$'),
  CONSTRAINT shipments_arrival_after_shipment CHECK (
    estimated_arrival IS NULL OR
    estimated_arrival >= shipment_date
  )
);

-- ============================================
-- SHIPMENT ITEMS TABLE
-- ============================================

CREATE TABLE shipment_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE SET NULL,
  purchase_order_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,

  -- Product Snapshot (denormalized for historical record)
  sku VARCHAR(50) NOT NULL,
  description VARCHAR(500),

  -- Quantity
  quantity_shipped INTEGER NOT NULL DEFAULT 1,

  -- Sort Order
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT shipment_items_quantity_positive CHECK (quantity_shipped > 0)
);

-- ============================================
-- INDEXES
-- ============================================

-- Shipments Indexes
CREATE UNIQUE INDEX idx_shipments_number_unique ON shipments(shipment_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_sales_order ON shipments(sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_purchase_order ON shipments(purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_status ON shipments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_shipment_date ON shipments(shipment_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_carrier ON shipments(carrier) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_deleted_at ON shipments(deleted_at);
CREATE INDEX idx_shipments_created_at ON shipments(created_at);

-- Shipment Items Indexes
CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX idx_shipment_items_product ON shipment_items(product_id);
CREATE INDEX idx_shipment_items_sales_order_item ON shipment_items(sales_order_item_id);
CREATE INDEX idx_shipment_items_po_item ON shipment_items(purchase_order_item_id);
CREATE INDEX idx_shipment_items_sort ON shipment_items(shipment_id, sort_order);

-- Full-text search index
CREATE INDEX idx_shipments_search ON shipments
USING gin(to_tsvector('english', shipment_number || ' ' || COALESCE(tracking_number, '') || ' ' || COALESCE(carrier, '')))
WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for shipments
CREATE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for shipment_items
CREATE TRIGGER trg_shipment_items_updated_at
  BEFORE UPDATE ON shipment_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEQUENCE FOR SHIPMENT NUMBERS
-- ============================================

CREATE SEQUENCE IF NOT EXISTS shipment_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Function to generate shipment number
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  seq_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  seq_num := NEXTVAL('shipment_number_seq');
  RETURN 'SH-' || current_year || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_shipment_number() IS 'Generates next shipment number in format SH-YYYY-NNNNN';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view shipments
CREATE POLICY shipments_select ON shipments
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY shipments_insert ON shipments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'shipments.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires permission
CREATE POLICY shipments_update ON shipments
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'shipments.edit'
        AND u.deleted_at IS NULL
    )
  );

-- Shipment items inherit from parent shipment
CREATE POLICY shipment_items_select ON shipment_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_items.shipment_id
        AND s.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY shipment_items_insert ON shipment_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'shipments.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY shipment_items_update ON shipment_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'shipments.edit'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY shipment_items_delete ON shipment_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'shipments.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE shipments IS 'Shipment tracking for sales orders and purchase orders';
COMMENT ON COLUMN shipments.shipment_number IS 'Unique shipment number in format SH-YYYY-NNNNN';
COMMENT ON COLUMN shipments.shipment_date IS 'Date the shipment was sent';
COMMENT ON COLUMN shipments.estimated_arrival IS 'Estimated arrival date';
COMMENT ON COLUMN shipments.actual_arrival IS 'Actual arrival date';
COMMENT ON COLUMN shipments.sales_order_id IS 'Reference to sales order (outbound shipment)';
COMMENT ON COLUMN shipments.purchase_order_id IS 'Reference to purchase order (inbound shipment)';
COMMENT ON COLUMN shipments.carrier IS 'Shipping carrier name';
COMMENT ON COLUMN shipments.tracking_number IS 'Carrier tracking number';
COMMENT ON COLUMN shipments.status IS 'Current shipment status';

COMMENT ON TABLE shipment_items IS 'Line items for shipments';
COMMENT ON COLUMN shipment_items.sku IS 'Product SKU snapshot';
COMMENT ON COLUMN shipment_items.quantity_shipped IS 'Quantity shipped';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS shipment_items_delete ON shipment_items;
-- DROP POLICY IF EXISTS shipment_items_update ON shipment_items;
-- DROP POLICY IF EXISTS shipment_items_insert ON shipment_items;
-- DROP POLICY IF EXISTS shipment_items_select ON shipment_items;
-- DROP POLICY IF EXISTS shipments_update ON shipments;
-- DROP POLICY IF EXISTS shipments_insert ON shipments;
-- DROP POLICY IF EXISTS shipments_select ON shipments;
-- DROP TRIGGER IF EXISTS trg_shipment_items_updated_at ON shipment_items;
-- DROP TRIGGER IF EXISTS trg_shipments_updated_at ON shipments;
-- DROP FUNCTION IF EXISTS generate_shipment_number();
-- DROP SEQUENCE IF EXISTS shipment_number_seq;
-- DROP TABLE IF EXISTS shipment_items;
-- DROP TABLE IF EXISTS shipments;
-- DROP TYPE IF EXISTS shipment_status;
