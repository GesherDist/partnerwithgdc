-- ============================================
-- MIGRATION: 004_audit_tables.sql
-- PURPOSE: Audit logging and file attachments tables
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 001_initial_schema.sql, 002_auth_tables.sql
-- ============================================

-- ============================================
-- AUDIT_LOGS TABLE
-- ============================================
-- Immutable audit trail for all important actions
-- ============================================

CREATE TABLE audit_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Reference
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(200),

  -- Action Details
  action audit_action NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT,

  -- Entity Reference (polymorphic)
  entity_type VARCHAR(50),
  entity_id UUID,

  -- Change Data
  old_data JSONB,
  new_data JSONB,
  changes JSONB,

  -- Request Context
  ip_address INET,
  user_agent TEXT,
  request_id UUID,

  -- Metadata
  metadata JSONB,

  -- Timestamp (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_created_at_brin ON audit_logs USING BRIN(created_at);

-- Composite index for filtering
CREATE INDEX idx_audit_logs_filter ON audit_logs(module, action, created_at DESC);

-- GIN index for JSONB search
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING GIN(metadata);
CREATE INDEX idx_audit_logs_changes ON audit_logs USING GIN(changes);

-- Make audit logs immutable (no updates or deletes)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- Comments
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all system actions';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed the action';
COMMENT ON COLUMN audit_logs.user_email IS 'Snapshot of user email at time of action';
COMMENT ON COLUMN audit_logs.user_name IS 'Snapshot of user name at time of action';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed';
COMMENT ON COLUMN audit_logs.module IS 'Module where action occurred';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity affected';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID of entity affected';
COMMENT ON COLUMN audit_logs.old_data IS 'State before the change';
COMMENT ON COLUMN audit_logs.new_data IS 'State after the change';
COMMENT ON COLUMN audit_logs.changes IS 'Computed diff of changes';
COMMENT ON COLUMN audit_logs.ip_address IS 'Client IP address';
COMMENT ON COLUMN audit_logs.user_agent IS 'Client user agent';
COMMENT ON COLUMN audit_logs.request_id IS 'Request correlation ID';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context data';

-- ============================================
-- ATTACHMENTS TABLE
-- ============================================
-- Polymorphic file attachments for any entity
-- ============================================

CREATE TABLE attachments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity Reference (polymorphic)
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,

  -- File Information
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,

  -- Categorization
  category VARCHAR(50),
  description TEXT,

  -- Storage
  storage_bucket VARCHAR(100) NOT NULL DEFAULT 'attachments',

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT attachments_file_size_positive CHECK (file_size > 0),
  CONSTRAINT attachments_file_name_length CHECK (LENGTH(TRIM(file_name)) >= 1)
);

-- Indexes
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_category ON attachments(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_created_by ON attachments(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_deleted_at ON attachments(deleted_at);

-- Triggers
CREATE TRIGGER trg_attachments_updated_at
  BEFORE UPDATE ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE attachments IS 'Polymorphic file attachments for any entity';
COMMENT ON COLUMN attachments.entity_type IS 'Type of entity this attachment belongs to';
COMMENT ON COLUMN attachments.entity_id IS 'ID of entity this attachment belongs to';
COMMENT ON COLUMN attachments.file_name IS 'Stored file name (may be hashed)';
COMMENT ON COLUMN attachments.original_name IS 'Original uploaded file name';
COMMENT ON COLUMN attachments.file_path IS 'Path in storage bucket';
COMMENT ON COLUMN attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN attachments.mime_type IS 'MIME type of the file';
COMMENT ON COLUMN attachments.category IS 'File category (document, image, etc.)';
COMMENT ON COLUMN attachments.storage_bucket IS 'Supabase storage bucket name';

-- ============================================
-- HELPER FUNCTION: Create Audit Log
-- ============================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id UUID,
  p_action audit_action,
  p_module VARCHAR,
  p_entity_type VARCHAR DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_email VARCHAR;
  v_user_name VARCHAR;
  v_changes JSONB;
  v_audit_id UUID;
BEGIN
  -- Get user details
  SELECT email, first_name || ' ' || last_name
  INTO v_user_email, v_user_name
  FROM users
  WHERE id = p_user_id;

  -- Compute changes if both old and new data exist
  IF p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
    SELECT jsonb_object_agg(key, jsonb_build_object('old', p_old_data->key, 'new', value))
    INTO v_changes
    FROM jsonb_each(p_new_data)
    WHERE p_old_data->key IS DISTINCT FROM value;
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    user_email,
    user_name,
    action,
    module,
    entity_type,
    entity_id,
    old_data,
    new_data,
    changes,
    description,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_user_id,
    v_user_email,
    v_user_name,
    p_action,
    p_module,
    p_entity_type,
    p_entity_id,
    p_old_data,
    p_new_data,
    v_changes,
    p_description,
    p_ip_address,
    p_user_agent,
    p_metadata
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_audit_log IS 'Helper function to create audit log entries with computed changes';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Audit logs are only readable by admins (will be expanded with proper permission checks)
CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.level >= 90
        AND u.deleted_at IS NULL
    )
  );

-- Users can view attachments for entities they have access to
-- This is a base policy - will be refined per entity type
CREATE POLICY attachments_select_authenticated ON attachments
  FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS attachments_select_authenticated ON attachments;
-- DROP POLICY IF EXISTS audit_logs_select_admin ON audit_logs;
-- DROP FUNCTION IF EXISTS create_audit_log;
-- DROP TRIGGER IF EXISTS trg_attachments_updated_at ON attachments;
-- DROP TABLE IF EXISTS attachments;
-- DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
-- DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
-- DROP FUNCTION IF EXISTS prevent_audit_log_modification();
-- DROP TABLE IF EXISTS audit_logs;
