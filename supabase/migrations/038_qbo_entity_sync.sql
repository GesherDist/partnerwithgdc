-- ============================================
-- MIGRATION: 038_qbo_entity_sync.sql
-- PURPOSE: Centralized QuickBooks entity sync tracking table
-- AUTHOR: System
-- DATE: 2024
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Sync status enum
CREATE TYPE qbo_sync_status AS ENUM (
  'pending',      -- Waiting to be synced
  'synced',       -- Successfully synced
  'failed',       -- Sync failed (will retry)
  'error'         -- Permanent error (needs manual intervention)
);

-- Sync direction enum
CREATE TYPE qbo_sync_direction AS ENUM (
  'push',         -- Our system → QuickBooks
  'pull'          -- QuickBooks → Our system
);

-- Entity type enum (expandable)
CREATE TYPE qbo_entity_type AS ENUM (
  'customer',
  'product',
  'invoice',
  'bill',
  'payment',
  'credit_memo'
);

-- ============================================
-- QBO ENTITY SYNC TABLE
-- ============================================
-- Centralized table for tracking QuickBooks sync status
-- for all entity types (customers, products, invoices, etc.)
-- ============================================

CREATE TABLE qbo_entity_sync (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity Reference
  entity_type qbo_entity_type NOT NULL,
  entity_id UUID NOT NULL,

  -- QuickBooks Reference
  qbo_entity_id TEXT,                    -- QBO ID (null if not yet synced)
  qbo_realm_id TEXT NOT NULL,            -- QBO Company/Realm ID

  -- Sync Status
  sync_status qbo_sync_status NOT NULL DEFAULT 'pending',
  sync_direction qbo_sync_direction NOT NULL DEFAULT 'push',

  -- Timestamps
  last_synced_at TIMESTAMPTZ,            -- Last successful sync
  next_retry_at TIMESTAMPTZ,             -- When to retry (for failed syncs)

  -- Error Tracking
  last_error TEXT,                       -- Last error message
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT qbo_entity_sync_unique_entity UNIQUE (entity_type, entity_id, qbo_realm_id),
  CONSTRAINT qbo_entity_sync_retry_count_positive CHECK (retry_count >= 0),
  CONSTRAINT qbo_entity_sync_max_retries_positive CHECK (max_retries >= 0)
);

-- ============================================
-- INDEXES
-- ============================================

-- Find by entity type and ID (common lookup)
CREATE INDEX idx_qbo_entity_sync_entity
ON qbo_entity_sync(entity_type, entity_id);

-- Find by QBO ID (reverse lookup)
CREATE INDEX idx_qbo_entity_sync_qbo_id
ON qbo_entity_sync(qbo_entity_id)
WHERE qbo_entity_id IS NOT NULL;

-- Find pending syncs (for sync queue)
CREATE INDEX idx_qbo_entity_sync_pending
ON qbo_entity_sync(sync_status, entity_type)
WHERE sync_status = 'pending';

-- Find failed syncs ready for retry
CREATE INDEX idx_qbo_entity_sync_retry
ON qbo_entity_sync(next_retry_at, sync_status)
WHERE sync_status = 'failed' AND next_retry_at IS NOT NULL;

-- Find by realm (for multi-company support)
CREATE INDEX idx_qbo_entity_sync_realm
ON qbo_entity_sync(qbo_realm_id);

-- Find syncs by status for dashboard/reporting
CREATE INDEX idx_qbo_entity_sync_status
ON qbo_entity_sync(sync_status);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER trg_qbo_entity_sync_updated_at
  BEFORE UPDATE ON qbo_entity_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE qbo_entity_sync ENABLE ROW LEVEL SECURITY;

-- View requires integrations.view permission
CREATE POLICY qbo_entity_sync_select ON qbo_entity_sync
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('integrations.view', 'integrations.manage')
        AND u.deleted_at IS NULL
    )
  );

-- Manage requires integrations.manage permission
CREATE POLICY qbo_entity_sync_insert ON qbo_entity_sync
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'integrations.manage'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY qbo_entity_sync_update ON qbo_entity_sync
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'integrations.manage'
        AND u.deleted_at IS NULL
    )
  );

CREATE POLICY qbo_entity_sync_delete ON qbo_entity_sync
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'integrations.manage'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE qbo_entity_sync IS 'Centralized QuickBooks sync tracking for all entity types';
COMMENT ON COLUMN qbo_entity_sync.entity_type IS 'Type of entity being synced (customer, product, invoice, etc.)';
COMMENT ON COLUMN qbo_entity_sync.entity_id IS 'UUID of the entity in our system';
COMMENT ON COLUMN qbo_entity_sync.qbo_entity_id IS 'QuickBooks entity ID (null until first successful sync)';
COMMENT ON COLUMN qbo_entity_sync.qbo_realm_id IS 'QuickBooks Company/Realm ID';
COMMENT ON COLUMN qbo_entity_sync.sync_status IS 'Current sync status: pending, synced, failed, error';
COMMENT ON COLUMN qbo_entity_sync.sync_direction IS 'Direction of sync: push (to QBO) or pull (from QBO)';
COMMENT ON COLUMN qbo_entity_sync.last_synced_at IS 'Timestamp of last successful sync';
COMMENT ON COLUMN qbo_entity_sync.next_retry_at IS 'When to attempt retry for failed syncs';
COMMENT ON COLUMN qbo_entity_sync.last_error IS 'Error message from last failed sync attempt';
COMMENT ON COLUMN qbo_entity_sync.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN qbo_entity_sync.max_retries IS 'Maximum retry attempts before marking as error';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS qbo_entity_sync_delete ON qbo_entity_sync;
-- DROP POLICY IF EXISTS qbo_entity_sync_update ON qbo_entity_sync;
-- DROP POLICY IF EXISTS qbo_entity_sync_insert ON qbo_entity_sync;
-- DROP POLICY IF EXISTS qbo_entity_sync_select ON qbo_entity_sync;
-- DROP TRIGGER IF EXISTS trg_qbo_entity_sync_updated_at ON qbo_entity_sync;
-- DROP TABLE IF EXISTS qbo_entity_sync;
-- DROP TYPE IF EXISTS qbo_entity_type;
-- DROP TYPE IF EXISTS qbo_sync_direction;
-- DROP TYPE IF EXISTS qbo_sync_status;
