-- ============================================
-- MIGRATION: 070_pick_tickets_tables.sql
-- PURPOSE: Pick Tickets and Packing Lists for warehouse fulfillment
-- AUTHOR: System
-- DATE: 2025
-- PHASE: 4
-- DEPENDS ON: 012_sales_orders_tables.sql, 007_locations_table.sql
-- ============================================

-- ============================================
-- PICK TICKET STATUS ENUM
-- ============================================

CREATE TYPE pick_ticket_status AS ENUM (
  'pending',
  'assigned',
  'picking',
  'picked',
  'packing',
  'packed',
  'shipped',
  'cancelled'
);
COMMENT ON TYPE pick_ticket_status IS 'Pick ticket workflow status';

-- ============================================
-- PICK TICKET PRIORITY ENUM
-- ============================================

CREATE TYPE pick_ticket_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);
COMMENT ON TYPE pick_ticket_priority IS 'Pick ticket priority level';

-- ============================================
-- PACKING LIST STATUS ENUM
-- ============================================

CREATE TYPE packing_list_status AS ENUM (
  'draft',
  'packed',
  'shipped'
);
COMMENT ON TYPE packing_list_status IS 'Packing list workflow status';

-- ============================================
-- PICK TICKETS TABLE
-- ============================================

CREATE TABLE pick_tickets (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pick Ticket Identity
  pick_ticket_number VARCHAR(50) NOT NULL,

  -- Relationships
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,

  -- Assignment
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  -- Priority
  priority pick_ticket_priority NOT NULL DEFAULT 'normal',

  -- Status
  status pick_ticket_status NOT NULL DEFAULT 'pending',

  -- Timestamps
  picking_started_at TIMESTAMPTZ,
  picking_completed_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,
  special_instructions TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT pick_tickets_number_format CHECK (pick_ticket_number ~ '^PT-[0-9]{4}-[0-9]{5}$')
);

-- ============================================
-- PICK TICKET ITEMS TABLE
-- ============================================

CREATE TABLE pick_ticket_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  pick_ticket_id UUID NOT NULL REFERENCES pick_tickets(id) ON DELETE CASCADE,
  sales_order_item_id UUID NOT NULL REFERENCES sales_order_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Product Snapshot (denormalized for historical record)
  sku VARCHAR(50) NOT NULL,
  description VARCHAR(500),

  -- Bin Location
  bin_location VARCHAR(100),

  -- Quantities
  quantity_to_pick INTEGER NOT NULL DEFAULT 1,
  quantity_picked INTEGER NOT NULL DEFAULT 0,

  -- Picking Tracking
  picked_at TIMESTAMPTZ,
  picked_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Sort Order
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT pick_ticket_items_quantity_positive CHECK (quantity_to_pick > 0),
  CONSTRAINT pick_ticket_items_quantity_picked_valid CHECK (quantity_picked >= 0 AND quantity_picked <= quantity_to_pick)
);

-- ============================================
-- PACKING LISTS TABLE
-- ============================================

CREATE TABLE packing_lists (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Packing List Identity
  packing_list_number VARCHAR(50) NOT NULL,

  -- Relationships
  pick_ticket_id UUID NOT NULL REFERENCES pick_tickets(id) ON DELETE RESTRICT,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,

  -- Packing Details
  total_packages INTEGER NOT NULL DEFAULT 1,
  total_weight DECIMAL(10, 2),
  weight_unit VARCHAR(10) DEFAULT 'lbs',

  -- Status
  status packing_list_status NOT NULL DEFAULT 'draft',

  -- Timestamps
  packed_at TIMESTAMPTZ,
  packed_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Notes
  notes TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT packing_lists_number_format CHECK (packing_list_number ~ '^PL-[0-9]{4}-[0-9]{5}$')
);

-- ============================================
-- PACKING LIST ITEMS TABLE
-- ============================================

CREATE TABLE packing_list_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  packing_list_id UUID NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
  pick_ticket_item_id UUID NOT NULL REFERENCES pick_ticket_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Product Snapshot
  sku VARCHAR(50) NOT NULL,
  description VARCHAR(500),

  -- Packing Details
  quantity_packed INTEGER NOT NULL DEFAULT 1,
  package_number INTEGER NOT NULL DEFAULT 1,
  weight DECIMAL(10, 2),

  -- Sort Order
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT packing_list_items_quantity_positive CHECK (quantity_packed > 0),
  CONSTRAINT packing_list_items_package_positive CHECK (package_number > 0)
);

-- ============================================
-- INDEXES
-- ============================================

-- Pick Tickets Indexes
CREATE UNIQUE INDEX idx_pick_tickets_number_unique ON pick_tickets(pick_ticket_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_pick_tickets_sales_order ON pick_tickets(sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pick_tickets_warehouse ON pick_tickets(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pick_tickets_assigned_to ON pick_tickets(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_pick_tickets_status ON pick_tickets(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pick_tickets_priority ON pick_tickets(priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_pick_tickets_deleted_at ON pick_tickets(deleted_at);
CREATE INDEX idx_pick_tickets_created_at ON pick_tickets(created_at);

-- Pick Ticket Items Indexes
CREATE INDEX idx_pick_ticket_items_pick_ticket ON pick_ticket_items(pick_ticket_id);
CREATE INDEX idx_pick_ticket_items_product ON pick_ticket_items(product_id);
CREATE INDEX idx_pick_ticket_items_so_item ON pick_ticket_items(sales_order_item_id);
CREATE INDEX idx_pick_ticket_items_sort ON pick_ticket_items(pick_ticket_id, sort_order);

-- Packing Lists Indexes
CREATE UNIQUE INDEX idx_packing_lists_number_unique ON packing_lists(packing_list_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_packing_lists_pick_ticket ON packing_lists(pick_ticket_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_packing_lists_sales_order ON packing_lists(sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_packing_lists_shipment ON packing_lists(shipment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_packing_lists_status ON packing_lists(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_packing_lists_deleted_at ON packing_lists(deleted_at);

-- Packing List Items Indexes
CREATE INDEX idx_packing_list_items_packing_list ON packing_list_items(packing_list_id);
CREATE INDEX idx_packing_list_items_pick_ticket_item ON packing_list_items(pick_ticket_item_id);
CREATE INDEX idx_packing_list_items_product ON packing_list_items(product_id);
CREATE INDEX idx_packing_list_items_package ON packing_list_items(packing_list_id, package_number);

-- Full-text search index
CREATE INDEX idx_pick_tickets_search ON pick_tickets
USING gin(to_tsvector('english', pick_ticket_number || ' ' || COALESCE(notes, '')))
WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for pick_tickets
CREATE TRIGGER trg_pick_tickets_updated_at
  BEFORE UPDATE ON pick_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for pick_ticket_items
CREATE TRIGGER trg_pick_ticket_items_updated_at
  BEFORE UPDATE ON pick_ticket_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for packing_lists
CREATE TRIGGER trg_packing_lists_updated_at
  BEFORE UPDATE ON packing_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for packing_list_items
CREATE TRIGGER trg_packing_list_items_updated_at
  BEFORE UPDATE ON packing_list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEQUENCES FOR NUMBER GENERATION
-- ============================================

CREATE SEQUENCE IF NOT EXISTS pick_ticket_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

CREATE SEQUENCE IF NOT EXISTS packing_list_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Function to generate pick ticket number
CREATE OR REPLACE FUNCTION generate_pick_ticket_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  seq_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  seq_num := NEXTVAL('pick_ticket_number_seq');
  RETURN 'PT-' || current_year || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_pick_ticket_number() IS 'Generates next pick ticket number in format PT-YYYY-NNNNN';

-- Function to generate packing list number
CREATE OR REPLACE FUNCTION generate_packing_list_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  seq_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  seq_num := NEXTVAL('packing_list_number_seq');
  RETURN 'PL-' || current_year || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_packing_list_number() IS 'Generates next packing list number in format PL-YYYY-NNNNN';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE pick_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_list_items ENABLE ROW LEVEL SECURITY;

-- Pick Tickets Policies
CREATE POLICY pick_tickets_select ON pick_tickets
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

CREATE POLICY pick_tickets_insert ON pick_tickets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY pick_tickets_update ON pick_tickets
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.edit'
        AND u.deleted_at IS NULL
    )
  );

-- Pick Ticket Items inherit from parent
CREATE POLICY pick_ticket_items_select ON pick_ticket_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pick_tickets pt
      WHERE pt.id = pick_ticket_items.pick_ticket_id
        AND pt.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY pick_ticket_items_insert ON pick_ticket_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY pick_ticket_items_update ON pick_ticket_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.edit'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY pick_ticket_items_delete ON pick_ticket_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.edit'
        AND u.deleted_at IS NULL
    )
  );

-- Packing Lists Policies
CREATE POLICY packing_lists_select ON packing_lists
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

CREATE POLICY packing_lists_insert ON packing_lists
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY packing_lists_update ON packing_lists
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.edit'
        AND u.deleted_at IS NULL
    )
  );

-- Packing List Items inherit from parent
CREATE POLICY packing_list_items_select ON packing_list_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM packing_lists pl
      WHERE pl.id = packing_list_items.packing_list_id
        AND pl.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY packing_list_items_insert ON packing_list_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.create'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY packing_list_items_update ON packing_list_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.edit'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY packing_list_items_delete ON packing_list_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'pick_tickets.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE pick_tickets IS 'Pick tickets for warehouse order fulfillment';
COMMENT ON COLUMN pick_tickets.pick_ticket_number IS 'Unique pick ticket number in format PT-YYYY-NNNNN';
COMMENT ON COLUMN pick_tickets.sales_order_id IS 'Reference to the sales order being fulfilled';
COMMENT ON COLUMN pick_tickets.warehouse_id IS 'Warehouse location where items will be picked';
COMMENT ON COLUMN pick_tickets.assigned_to IS 'User assigned to pick this order';
COMMENT ON COLUMN pick_tickets.priority IS 'Pick priority level';
COMMENT ON COLUMN pick_tickets.status IS 'Current pick ticket status';

COMMENT ON TABLE pick_ticket_items IS 'Line items to be picked for a pick ticket';
COMMENT ON COLUMN pick_ticket_items.bin_location IS 'Warehouse bin/aisle location of the item';
COMMENT ON COLUMN pick_ticket_items.quantity_to_pick IS 'Quantity that needs to be picked';
COMMENT ON COLUMN pick_ticket_items.quantity_picked IS 'Quantity actually picked';

COMMENT ON TABLE packing_lists IS 'Packing lists generated from picked items';
COMMENT ON COLUMN packing_lists.packing_list_number IS 'Unique packing list number in format PL-YYYY-NNNNN';
COMMENT ON COLUMN packing_lists.total_packages IS 'Number of packages in this packing list';
COMMENT ON COLUMN packing_lists.total_weight IS 'Total weight of all packages';

COMMENT ON TABLE packing_list_items IS 'Items included in a packing list';
COMMENT ON COLUMN packing_list_items.package_number IS 'Which package this item is in (1, 2, 3...)';
COMMENT ON COLUMN packing_list_items.quantity_packed IS 'Quantity of this item packed';

-- ============================================
-- SEED PERMISSIONS
-- ============================================

-- Insert pick_tickets permissions
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES
  ('pick_tickets.view', 'View pick tickets', 'pick_tickets', 'user', '1'),
  ('pick_tickets.create', 'Create pick tickets', 'pick_tickets', 'user', '2'),
  ('pick_tickets.edit', 'Edit pick tickets', 'pick_tickets', 'user', '3'),
  ('pick_tickets.delete', 'Delete pick tickets', 'pick_tickets', 'user', '4'),
  ('pick_tickets.assign', 'Assign pick tickets to users', 'pick_tickets', 'user', '5'),
  ('pick_tickets.pick', 'Mark items as picked', 'pick_tickets', 'user', '6')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions to warehouse_manager and operations roles (if they exist)
-- This will be handled by role setup separately

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS packing_list_items_delete ON packing_list_items;
-- DROP POLICY IF EXISTS packing_list_items_update ON packing_list_items;
-- DROP POLICY IF EXISTS packing_list_items_insert ON packing_list_items;
-- DROP POLICY IF EXISTS packing_list_items_select ON packing_list_items;
-- DROP POLICY IF EXISTS packing_lists_update ON packing_lists;
-- DROP POLICY IF EXISTS packing_lists_insert ON packing_lists;
-- DROP POLICY IF EXISTS packing_lists_select ON packing_lists;
-- DROP POLICY IF EXISTS pick_ticket_items_delete ON pick_ticket_items;
-- DROP POLICY IF EXISTS pick_ticket_items_update ON pick_ticket_items;
-- DROP POLICY IF EXISTS pick_ticket_items_insert ON pick_ticket_items;
-- DROP POLICY IF EXISTS pick_ticket_items_select ON pick_ticket_items;
-- DROP POLICY IF EXISTS pick_tickets_update ON pick_tickets;
-- DROP POLICY IF EXISTS pick_tickets_insert ON pick_tickets;
-- DROP POLICY IF EXISTS pick_tickets_select ON pick_tickets;
-- DROP TRIGGER IF EXISTS trg_packing_list_items_updated_at ON packing_list_items;
-- DROP TRIGGER IF EXISTS trg_packing_lists_updated_at ON packing_lists;
-- DROP TRIGGER IF EXISTS trg_pick_ticket_items_updated_at ON pick_ticket_items;
-- DROP TRIGGER IF EXISTS trg_pick_tickets_updated_at ON pick_tickets;
-- DROP FUNCTION IF EXISTS generate_packing_list_number();
-- DROP FUNCTION IF EXISTS generate_pick_ticket_number();
-- DROP SEQUENCE IF EXISTS packing_list_number_seq;
-- DROP SEQUENCE IF EXISTS pick_ticket_number_seq;
-- DROP TABLE IF EXISTS packing_list_items;
-- DROP TABLE IF EXISTS packing_lists;
-- DROP TABLE IF EXISTS pick_ticket_items;
-- DROP TABLE IF EXISTS pick_tickets;
-- DROP TYPE IF EXISTS packing_list_status;
-- DROP TYPE IF EXISTS pick_ticket_priority;
-- DROP TYPE IF EXISTS pick_ticket_status;
-- DELETE FROM permissions WHERE module = 'pick_tickets';
