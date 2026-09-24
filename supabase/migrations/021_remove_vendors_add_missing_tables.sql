-- ============================================
-- MIGRATION: 021_remove_vendors_add_missing_tables.sql
-- PURPOSE: Remove vendors table (not in client doc), modify PO, add missing tables
-- AUTHOR: System
-- DATE: 2024
-- ============================================

-- ============================================
-- STEP 1: MODIFY PURCHASE ORDERS - REMOVE VENDOR DEPENDENCY
-- ============================================

-- Drop the vendor-related index
DROP INDEX IF EXISTS idx_purchase_orders_vendor;

-- Add supplier fields directly (always Galileo/Alon per client doc)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(100) DEFAULT 'Galileo',
  ADD COLUMN IF NOT EXISTS supplier_contact VARCHAR(100) DEFAULT 'Alon';

-- Drop the vendor_id foreign key constraint and column
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_vendor_id_fkey;
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS vendor_id;

-- Update comment
COMMENT ON COLUMN purchase_orders.supplier_name IS 'Supplier name (default: Galileo)';
COMMENT ON COLUMN purchase_orders.supplier_contact IS 'Supplier contact person (default: Alon)';

-- ============================================
-- STEP 2: DROP VENDORS TABLE
-- ============================================

DROP TABLE IF EXISTS vendors CASCADE;

-- ============================================
-- STEP 3: CREATE INVENTORY TABLE
-- Client Doc: "per product per location: on_hand, allocated. Derived available = on_hand - allocated"
-- ============================================

CREATE TABLE inventory (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Quantities
  on_hand INTEGER NOT NULL DEFAULT 0,
  allocated INTEGER NOT NULL DEFAULT 0,
  -- available is computed: on_hand - allocated

  -- Reorder Settings
  reorder_point INTEGER DEFAULT 0,
  reorder_qty INTEGER DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT inventory_product_location_unique UNIQUE (product_id, location_id),
  CONSTRAINT inventory_on_hand_non_negative CHECK (on_hand >= 0),
  CONSTRAINT inventory_allocated_non_negative CHECK (allocated >= 0),
  CONSTRAINT inventory_allocated_lte_on_hand CHECK (allocated <= on_hand)
);

-- Indexes
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_inventory_low_stock ON inventory(product_id) WHERE on_hand - allocated <= reorder_point;

-- Trigger for updated_at
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_select ON inventory
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY inventory_insert ON inventory
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('inventory.create', 'inventory.manage')
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY inventory_update ON inventory
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('inventory.edit', 'inventory.manage')
        AND u.deleted_at IS NULL
    )
  );

COMMENT ON TABLE inventory IS 'Inventory per product per location';
COMMENT ON COLUMN inventory.on_hand IS 'Quantity physically in stock';
COMMENT ON COLUMN inventory.allocated IS 'Quantity allocated to orders';
COMMENT ON COLUMN inventory.reorder_point IS 'Threshold to trigger reorder signal';
COMMENT ON COLUMN inventory.reorder_qty IS 'Suggested reorder quantity';

-- ============================================
-- STEP 4: CREATE COST_COMPONENTS TABLE
-- Client Doc: "type (ex_works, ocean_freight, duty, inland), amount. Sum = landed cost"
-- ============================================

CREATE TYPE cost_component_type AS ENUM (
  'door_to_door',
  'ex_works',
  'ocean_freight',
  'duty',
  'inland',
  'other'
);

CREATE TABLE cost_components (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships (can be linked to PO or PO Item)
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES purchase_order_items(id) ON DELETE CASCADE,

  -- Component Details
  component_type cost_component_type NOT NULL,
  description VARCHAR(200),
  amount INTEGER NOT NULL DEFAULT 0, -- in cents
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT cost_components_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT cost_components_has_parent CHECK (
    purchase_order_id IS NOT NULL OR purchase_order_item_id IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_cost_components_po ON cost_components(purchase_order_id);
CREATE INDEX idx_cost_components_po_item ON cost_components(purchase_order_item_id);
CREATE INDEX idx_cost_components_type ON cost_components(component_type);

-- Trigger for updated_at
CREATE TRIGGER trg_cost_components_updated_at
  BEFORE UPDATE ON cost_components
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE cost_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_components_select ON cost_components
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY cost_components_insert ON cost_components
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('purchase_orders.edit', 'finance.manage')
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY cost_components_update ON cost_components
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('purchase_orders.edit', 'finance.manage')
        AND u.deleted_at IS NULL
    )
  );

COMMENT ON TABLE cost_components IS 'Landed cost components for POs';
COMMENT ON COLUMN cost_components.component_type IS 'Type: door_to_door (current), or itemized (future)';
COMMENT ON COLUMN cost_components.amount IS 'Cost amount in cents';

-- ============================================
-- STEP 5: CREATE CREDIT_NOTES TABLE
-- Client Doc: "for short/damaged; adjust and push"
-- ============================================

CREATE TYPE credit_note_status AS ENUM (
  'draft',
  'issued',
  'applied',
  'cancelled'
);

CREATE TYPE credit_note_reason AS ENUM (
  'short_shipment',
  'damaged_goods',
  'pricing_error',
  'return',
  'other'
);

CREATE TABLE credit_notes (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Credit Note Identity
  credit_note_number VARCHAR(50) NOT NULL,
  credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Relationships
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,

  -- Details
  reason credit_note_reason NOT NULL,
  reason_description TEXT,
  status credit_note_status NOT NULL DEFAULT 'draft',

  -- Amounts (in cents)
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,

  -- QuickBooks Integration
  quickbooks_credit_memo_id VARCHAR(100),
  quickbooks_sync_status VARCHAR(20) DEFAULT 'pending',
  quickbooks_last_sync TIMESTAMPTZ,

  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT credit_notes_number_format CHECK (credit_note_number ~ '^CN-[0-9]{4}-[0-9]{5}$'),
  CONSTRAINT credit_notes_amounts_non_negative CHECK (
    subtotal >= 0 AND tax_total >= 0 AND grand_total >= 0
  )
);

-- Credit Note Items
CREATE TABLE credit_note_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE SET NULL,

  -- Item Details
  sku VARCHAR(50),
  description VARCHAR(500),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL DEFAULT 0,

  -- Sort Order
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE UNIQUE INDEX idx_credit_notes_number_unique ON credit_notes(credit_note_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_notes_customer ON credit_notes(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_notes_invoice ON credit_notes(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_notes_status ON credit_notes(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_notes_qb ON credit_notes(quickbooks_credit_memo_id) WHERE quickbooks_credit_memo_id IS NOT NULL;
CREATE INDEX idx_credit_note_items_cn ON credit_note_items(credit_note_id);

-- Sequence for credit note numbers
CREATE SEQUENCE IF NOT EXISTS credit_note_number_seq START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  seq_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  seq_num := NEXTVAL('credit_note_number_seq');
  RETURN 'CN-' || current_year || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trg_credit_notes_updated_at
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_credit_note_items_updated_at
  BEFORE UPDATE ON credit_note_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_notes_select ON credit_notes
  FOR SELECT USING (deleted_at IS NULL AND auth.role() = 'authenticated');

CREATE POLICY credit_notes_insert ON credit_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('credit_notes.create', 'finance.manage')
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY credit_note_items_select ON credit_note_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM credit_notes cn
      WHERE cn.id = credit_note_items.credit_note_id
        AND cn.deleted_at IS NULL
        AND auth.role() = 'authenticated'
    )
  );

COMMENT ON TABLE credit_notes IS 'Credit notes for short/damaged/returns';
COMMENT ON TABLE credit_note_items IS 'Line items for credit notes';

-- ============================================
-- STEP 6: CREATE APPROVAL_EVENTS TABLE
-- Client Doc: "the audit spine. {type: credit_release | price_override | allocation, subject_id, decided_by, decided_at, note}"
-- ============================================

CREATE TYPE approval_event_type AS ENUM (
  'credit_release',
  'price_override',
  'allocation',
  'other'
);

CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE approval_events (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event Type & Subject
  event_type approval_event_type NOT NULL,
  subject_type VARCHAR(50) NOT NULL, -- 'quote', 'sales_order', 'invoice', etc.
  subject_id UUID NOT NULL,

  -- Approval Details
  status approval_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,

  -- Context
  reason TEXT, -- Why approval was requested
  decision_note TEXT, -- Approver's note

  -- Additional Data (JSON for flexibility)
  metadata JSONB DEFAULT '{}',

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT approval_events_decision_consistency CHECK (
    (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL) OR
    (status != 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_approval_events_type ON approval_events(event_type);
CREATE INDEX idx_approval_events_subject ON approval_events(subject_type, subject_id);
CREATE INDEX idx_approval_events_status ON approval_events(status);
CREATE INDEX idx_approval_events_requested_by ON approval_events(requested_by);
CREATE INDEX idx_approval_events_decided_by ON approval_events(decided_by);
CREATE INDEX idx_approval_events_pending ON approval_events(status) WHERE status = 'pending';

-- Trigger for updated_at
CREATE TRIGGER trg_approval_events_updated_at
  BEFORE UPDATE ON approval_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_events_select ON approval_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY approval_events_insert ON approval_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY approval_events_update ON approval_events
  FOR UPDATE USING (
    -- Only approvers can update (approve/reject)
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name IN ('sales_director', 'finance', 'management', 'super_admin')
        AND u.deleted_at IS NULL
    )
  );

COMMENT ON TABLE approval_events IS 'Audit trail for all approval decisions';
COMMENT ON COLUMN approval_events.event_type IS 'Type: credit_release, price_override, allocation';
COMMENT ON COLUMN approval_events.subject_type IS 'Entity type: quote, sales_order, invoice';
COMMENT ON COLUMN approval_events.subject_id IS 'ID of the entity requiring approval';
COMMENT ON COLUMN approval_events.metadata IS 'Additional context (e.g., original price, requested price)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback:
-- DROP TABLE IF EXISTS approval_events CASCADE;
-- DROP TYPE IF EXISTS approval_status;
-- DROP TYPE IF EXISTS approval_event_type;
-- DROP TABLE IF EXISTS credit_note_items CASCADE;
-- DROP TABLE IF EXISTS credit_notes CASCADE;
-- DROP SEQUENCE IF EXISTS credit_note_number_seq;
-- DROP FUNCTION IF EXISTS generate_credit_note_number();
-- DROP TYPE IF EXISTS credit_note_reason;
-- DROP TYPE IF EXISTS credit_note_status;
-- DROP TABLE IF EXISTS cost_components CASCADE;
-- DROP TYPE IF EXISTS cost_component_type;
-- DROP TABLE IF EXISTS inventory CASCADE;
-- ALTER TABLE purchase_orders ADD COLUMN vendor_id UUID REFERENCES vendors(id);
-- Re-create vendors table
