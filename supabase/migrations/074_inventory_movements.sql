-- ============================================
-- MIGRATION: 074_inventory_movements.sql
-- PURPOSE: Inventory movements audit trail for tracking all inventory changes
-- AUTHOR: System
-- DATE: 2025-08-14
-- DEPENDS ON: 021_remove_vendors_add_missing_tables.sql (inventory table)
-- ============================================

-- ============================================
-- MOVEMENT TYPE ENUM
-- ============================================

CREATE TYPE inventory_movement_type AS ENUM (
  'receive',      -- Goods received from shipment
  'allocate',     -- Reserved for sales order
  'deallocate',   -- Released from sales order (cancelled/modified)
  'ship',         -- Shipped out (pick ticket completed)
  'adjust',       -- Manual adjustment (count correction)
  'transfer_out', -- Transfer out to another location
  'transfer_in'   -- Transfer in from another location
);

COMMENT ON TYPE inventory_movement_type IS 'Type of inventory movement for audit trail';

-- ============================================
-- INVENTORY MOVEMENTS TABLE
-- ============================================

CREATE TABLE inventory_movements (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product & Location
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,

  -- Movement Details
  movement_type inventory_movement_type NOT NULL,
  quantity INTEGER NOT NULL,  -- Positive for in, negative for out

  -- Quantities After Movement (snapshot)
  on_hand_after INTEGER NOT NULL,
  allocated_after INTEGER NOT NULL,

  -- Reference (what caused this movement)
  reference_type VARCHAR(50),  -- 'shipment', 'sales_order', 'pick_ticket', 'adjustment', 'transfer'
  reference_id UUID,
  reference_number VARCHAR(50),  -- Human readable (SO-2025-00001, SH-2025-00001)

  -- For transfers
  related_location_id UUID REFERENCES locations(id),  -- The other location in transfer

  -- Notes
  notes TEXT,
  reason VARCHAR(200),  -- For adjustments: 'physical_count', 'damaged', 'lost', etc.

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT inventory_movements_quantity_not_zero CHECK (quantity != 0),
  CONSTRAINT inventory_movements_on_hand_non_negative CHECK (on_hand_after >= 0),
  CONSTRAINT inventory_movements_allocated_non_negative CHECK (allocated_after >= 0)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_location ON inventory_movements(location_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at DESC);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);
CREATE INDEX idx_inventory_movements_product_location ON inventory_movements(product_id, location_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view movements
CREATE POLICY inventory_movements_select ON inventory_movements
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert requires inventory permissions
CREATE POLICY inventory_movements_insert ON inventory_movements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('inventory.adjust', 'inventory.manage', 'shipments.edit', 'orders.edit')
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE inventory_movements IS 'Audit trail for all inventory changes';
COMMENT ON COLUMN inventory_movements.quantity IS 'Positive for incoming, negative for outgoing';
COMMENT ON COLUMN inventory_movements.on_hand_after IS 'Snapshot of on_hand quantity after this movement';
COMMENT ON COLUMN inventory_movements.allocated_after IS 'Snapshot of allocated quantity after this movement';
COMMENT ON COLUMN inventory_movements.reference_type IS 'Source: shipment, sales_order, pick_ticket, adjustment, transfer';
COMMENT ON COLUMN inventory_movements.related_location_id IS 'For transfers: the other location involved';

-- ============================================
-- ADD last_counted_at TO INVENTORY TABLE
-- ============================================

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS last_counted_at TIMESTAMPTZ;
COMMENT ON COLUMN inventory.last_counted_at IS 'Last physical inventory count date';

-- ============================================
-- INVENTORY PERMISSIONS
-- ============================================

-- Parent: View Inventory Module
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('inventory.view_module', 'View Inventory Module', 'Inventory Module', 'user', 0)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

-- Child: Adjust Inventory (child of inventory.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'inventory.adjust', 'Make manual inventory adjustments', 'Inventory Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'inventory.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Child: Transfer Inventory (child of inventory.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'inventory.transfer', 'Transfer inventory between locations', 'Inventory Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'inventory.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Child: Manage Inventory (child of inventory.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'inventory.manage', 'Full inventory management access', 'Inventory Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'inventory.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Assign to Operations Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Operations Manager'
  AND p.name LIKE 'inventory.%'
ON CONFLICT DO NOTHING;

-- Assign to Super Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Super Admin'
  AND p.name LIKE 'inventory.%'
ON CONFLICT DO NOTHING;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE module = 'inventory');
-- DELETE FROM permissions WHERE module = 'inventory';
-- ALTER TABLE inventory DROP COLUMN IF EXISTS last_counted_at;
-- DROP TABLE IF EXISTS inventory_movements;
-- DROP TYPE IF EXISTS inventory_movement_type;
