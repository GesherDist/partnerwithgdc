-- ============================================
-- MIGRATION: 018_purchase_orders_tables.sql
-- PURPOSE: Purchase Orders and Purchase Order Items tables (includes vendors)
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 3
-- DEPENDS ON: 012_sales_orders_tables.sql
-- ============================================

-- ============================================
-- VENDOR STATUS ENUM
-- ============================================

CREATE TYPE vendor_status AS ENUM (
  'active',
  'inactive'
);
COMMENT ON TYPE vendor_status IS 'Vendor status';

-- ============================================
-- VENDORS TABLE
-- ============================================

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  address_street VARCHAR(200),
  address_city VARCHAR(100),
  address_state VARCHAR(50),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(50) DEFAULT 'US',
  payment_terms VARCHAR(100),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  tax_id VARCHAR(50),
  status vendor_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT vendors_name_length CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT vendors_email_format CHECK (
    email IS NULL OR
    email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
  )
);

CREATE UNIQUE INDEX idx_vendors_code_unique ON vendors(vendor_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_name ON vendors(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_status ON vendors(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_deleted_at ON vendors(deleted_at);

CREATE SEQUENCE IF NOT EXISTS vendor_code_seq START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION generate_vendor_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  seq_num := NEXTVAL('vendor_code_seq');
  RETURN 'VEN-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_select ON vendors
  FOR SELECT
  USING (deleted_at IS NULL AND auth.role() = 'authenticated');

CREATE POLICY vendors_insert ON vendors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'vendors.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY vendors_update ON vendors
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'vendors.edit'
        AND u.deleted_at IS NULL
    )
  );

COMMENT ON TABLE vendors IS 'Vendor/supplier master table';

-- ============================================
-- PURCHASE ORDER STATUS ENUM
-- ============================================

CREATE TYPE po_status AS ENUM (
  'draft',
  'sent',
  'confirmed',
  'partial',
  'received',
  'cancelled'
);
COMMENT ON TYPE po_status IS 'Purchase order workflow status';

-- ============================================
-- PURCHASE ORDERS TABLE
-- ============================================

CREATE TABLE purchase_orders (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PO Identity
  po_number VARCHAR(50) NOT NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,

  -- Relationships
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL, -- Link to chain
  warehouse_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- PO Settings
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  status po_status NOT NULL DEFAULT 'draft',

  -- Vendor Address (denormalized for historical record)
  vendor_address_street VARCHAR(200),
  vendor_address_city VARCHAR(100),
  vendor_address_state VARCHAR(50),
  vendor_address_postal_code VARCHAR(20),
  vendor_address_country VARCHAR(50) DEFAULT 'US',

  -- Ship To Address (denormalized)
  ship_to_address_street VARCHAR(200),
  ship_to_address_city VARCHAR(100),
  ship_to_address_state VARCHAR(50),
  ship_to_address_postal_code VARCHAR(20),
  ship_to_address_country VARCHAR(50) DEFAULT 'US',

  -- Calculations (stored in cents for precision)
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  shipping_cost INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,

  -- Notes
  vendor_notes TEXT,
  internal_notes TEXT,

  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT purchase_orders_number_format CHECK (po_number ~ '^PO-[0-9]{4}-[0-9]{5}$'),
  CONSTRAINT purchase_orders_amounts_positive CHECK (
    subtotal >= 0 AND
    tax_total >= 0 AND
    shipping_cost >= 0 AND
    grand_total >= 0
  ),
  CONSTRAINT purchase_orders_delivery_after_po CHECK (
    expected_delivery_date IS NULL OR
    expected_delivery_date >= po_date
  )
);

-- ============================================
-- PURCHASE ORDER ITEMS TABLE
-- ============================================

CREATE TABLE purchase_order_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE SET NULL, -- Link to chain

  -- Product Snapshot (denormalized for historical record)
  sku VARCHAR(50) NOT NULL,
  description VARCHAR(500),

  -- Quantities & Pricing
  quantity_ordered INTEGER NOT NULL DEFAULT 1,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_code VARCHAR(10) NOT NULL DEFAULT 'EA',
  unit_price INTEGER NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL DEFAULT 0,

  -- Sort Order
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT po_items_quantity_ordered_positive CHECK (quantity_ordered > 0),
  CONSTRAINT po_items_quantity_received_valid CHECK (quantity_received >= 0),
  CONSTRAINT po_items_unit_price_positive CHECK (unit_price >= 0),
  CONSTRAINT po_items_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100),
  CONSTRAINT po_items_line_total_positive CHECK (line_total >= 0)
);

-- ============================================
-- INDEXES
-- ============================================

-- Purchase Orders Indexes
CREATE UNIQUE INDEX idx_purchase_orders_number_unique ON purchase_orders(po_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_sales_order ON purchase_orders(sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_po_date ON purchase_orders(po_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_delivery_date ON purchase_orders(expected_delivery_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_warehouse ON purchase_orders(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_deleted_at ON purchase_orders(deleted_at);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at);

-- Purchase Order Items Indexes
CREATE INDEX idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_product ON purchase_order_items(product_id);
CREATE INDEX idx_po_items_sales_order_item ON purchase_order_items(sales_order_item_id);
CREATE INDEX idx_po_items_sort ON purchase_order_items(purchase_order_id, sort_order);

-- Full-text search index
CREATE INDEX idx_purchase_orders_search ON purchase_orders
USING gin(to_tsvector('english', po_number))
WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for purchase_orders
CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for purchase_order_items
CREATE TRIGGER trg_po_items_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEQUENCE FOR PO NUMBERS
-- ============================================

CREATE SEQUENCE IF NOT EXISTS po_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Function to generate PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  seq_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  seq_num := NEXTVAL('po_number_seq');
  RETURN 'PO-' || current_year || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_po_number() IS 'Generates next PO number in format PO-YYYY-NNNNN';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view POs
CREATE POLICY purchase_orders_select ON purchase_orders
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY purchase_orders_insert ON purchase_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'purchase_orders.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires permission
CREATE POLICY purchase_orders_update ON purchase_orders
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'purchase_orders.edit'
        AND u.deleted_at IS NULL
    )
  );

-- PO items inherit from parent PO
CREATE POLICY po_items_select ON purchase_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND po.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY po_items_insert ON purchase_order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'purchase_orders.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY po_items_update ON purchase_order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'purchase_orders.edit'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY po_items_delete ON purchase_order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'purchase_orders.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE purchase_orders IS 'Purchase orders to vendors';
COMMENT ON COLUMN purchase_orders.po_number IS 'Unique PO number in format PO-YYYY-NNNNN';
COMMENT ON COLUMN purchase_orders.po_date IS 'Date the PO was created';
COMMENT ON COLUMN purchase_orders.expected_delivery_date IS 'Expected delivery date';
COMMENT ON COLUMN purchase_orders.vendor_id IS 'Reference to vendor';
COMMENT ON COLUMN purchase_orders.sales_order_id IS 'Reference to sales order (chain link)';
COMMENT ON COLUMN purchase_orders.warehouse_id IS 'Receiving warehouse';
COMMENT ON COLUMN purchase_orders.currency_code IS 'Currency for all monetary values';
COMMENT ON COLUMN purchase_orders.status IS 'Current status in PO workflow';
COMMENT ON COLUMN purchase_orders.subtotal IS 'Sum of line totals in cents';
COMMENT ON COLUMN purchase_orders.tax_total IS 'Total tax in cents';
COMMENT ON COLUMN purchase_orders.shipping_cost IS 'Shipping cost in cents';
COMMENT ON COLUMN purchase_orders.grand_total IS 'Final PO total in cents';

COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';
COMMENT ON COLUMN purchase_order_items.sales_order_item_id IS 'Reference to sales order item (chain link)';
COMMENT ON COLUMN purchase_order_items.sku IS 'Product SKU snapshot at time of PO';
COMMENT ON COLUMN purchase_order_items.description IS 'Product description snapshot';
COMMENT ON COLUMN purchase_order_items.quantity_ordered IS 'Quantity ordered';
COMMENT ON COLUMN purchase_order_items.quantity_received IS 'Quantity received so far';
COMMENT ON COLUMN purchase_order_items.unit_code IS 'Unit of measure code (EA, SET, PR, BOX)';
COMMENT ON COLUMN purchase_order_items.unit_price IS 'Price per unit in cents';
COMMENT ON COLUMN purchase_order_items.tax_rate IS 'Tax rate percentage (0-100)';
COMMENT ON COLUMN purchase_order_items.line_total IS 'Calculated line total in cents';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS po_items_delete ON purchase_order_items;
-- DROP POLICY IF EXISTS po_items_update ON purchase_order_items;
-- DROP POLICY IF EXISTS po_items_insert ON purchase_order_items;
-- DROP POLICY IF EXISTS po_items_select ON purchase_order_items;
-- DROP POLICY IF EXISTS purchase_orders_update ON purchase_orders;
-- DROP POLICY IF EXISTS purchase_orders_insert ON purchase_orders;
-- DROP POLICY IF EXISTS purchase_orders_select ON purchase_orders;
-- DROP TRIGGER IF EXISTS trg_po_items_updated_at ON purchase_order_items;
-- DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON purchase_orders;
-- DROP FUNCTION IF EXISTS generate_po_number();
-- DROP SEQUENCE IF EXISTS po_number_seq;
-- DROP TABLE IF EXISTS purchase_order_items;
-- DROP TABLE IF EXISTS purchase_orders;
-- DROP TYPE IF EXISTS po_status;
