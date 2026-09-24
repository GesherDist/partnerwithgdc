-- ============================================
-- MIGRATION: 015_integration_framework.sql
-- PURPOSE: Enterprise Integration Framework tables
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 2
-- DEPENDS ON: 002_auth_tables.sql
-- ============================================

-- ============================================
-- INTEGRATION ENUMS
-- ============================================

CREATE TYPE integration_provider AS ENUM (
  'quickbooks',
  'pipedrive',
  'monday',
  'xero',
  'hubspot',
  'salesforce',
  'shipstation',
  'easypost'
);
COMMENT ON TYPE integration_provider IS 'Supported integration providers';

CREATE TYPE integration_type AS ENUM (
  'accounting',
  'crm',
  'project_management',
  'shipping',
  'tracking',
  'inventory',
  'payments'
);
COMMENT ON TYPE integration_type IS 'Categories of integrations';

CREATE TYPE integration_status AS ENUM (
  'active',
  'inactive',
  'deprecated'
);
COMMENT ON TYPE integration_status IS 'Integration availability status';

CREATE TYPE connection_status AS ENUM (
  'connected',
  'disconnected',
  'error',
  'pending',
  'expired'
);
COMMENT ON TYPE connection_status IS 'Connection state for integration connections';

CREATE TYPE sync_direction AS ENUM (
  'inbound',
  'outbound',
  'bidirectional'
);
COMMENT ON TYPE sync_direction IS 'Data sync direction';

CREATE TYPE sync_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled'
);
COMMENT ON TYPE sync_status IS 'Sync operation status';

-- ============================================
-- INTEGRATIONS TABLE (Master List)
-- ============================================

CREATE TABLE integrations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Integration Identity
  provider integration_provider NOT NULL,
  type integration_type NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Configuration
  icon_url VARCHAR(500),
  documentation_url VARCHAR(500),

  -- Status
  status integration_status NOT NULL DEFAULT 'active',

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT integrations_provider_unique UNIQUE (provider)
);

COMMENT ON TABLE integrations IS 'Master list of supported integrations';
COMMENT ON COLUMN integrations.provider IS 'Unique integration provider identifier';
COMMENT ON COLUMN integrations.type IS 'Category of integration (accounting, crm, etc.)';
COMMENT ON COLUMN integrations.name IS 'Display name for the integration';
COMMENT ON COLUMN integrations.status IS 'Whether this integration is available for use';

-- ============================================
-- INTEGRATION CONNECTIONS TABLE
-- ============================================

CREATE TABLE integration_connections (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE RESTRICT,
  organization_id UUID, -- Nullable for single-tenant, can reference organizations table when added

  -- External Account Identity
  external_account_id VARCHAR(255), -- e.g., QuickBooks realmId, Pipedrive company ID
  external_account_name VARCHAR(255), -- e.g., Company name from provider

  -- OAuth Tokens (encrypted)
  access_token TEXT, -- Encrypted access token
  refresh_token TEXT, -- Encrypted refresh token
  token_expires_at TIMESTAMPTZ,

  -- Provider-specific Configuration
  environment VARCHAR(50) DEFAULT 'production', -- sandbox, production
  metadata JSONB DEFAULT '{}', -- Provider-specific data

  -- Connection State
  status connection_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  last_sync_at TIMESTAMPTZ,

  -- Audit Fields
  connected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT integration_connections_unique_org_integration
    UNIQUE NULLS NOT DISTINCT (organization_id, integration_id, deleted_at)
);

COMMENT ON TABLE integration_connections IS 'Active connections to external integrations';
COMMENT ON COLUMN integration_connections.integration_id IS 'Reference to the integration being connected';
COMMENT ON COLUMN integration_connections.organization_id IS 'Organization that owns this connection (nullable for single-tenant)';
COMMENT ON COLUMN integration_connections.external_account_id IS 'Account identifier from the external provider';
COMMENT ON COLUMN integration_connections.external_account_name IS 'Account/company name from external provider';
COMMENT ON COLUMN integration_connections.access_token IS 'Encrypted OAuth access token';
COMMENT ON COLUMN integration_connections.refresh_token IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN integration_connections.metadata IS 'Provider-specific configuration and data';
COMMENT ON COLUMN integration_connections.status IS 'Current connection state';

-- ============================================
-- INTEGRATION SYNC LOGS TABLE
-- ============================================

CREATE TABLE integration_sync_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,

  -- Sync Details
  entity_type VARCHAR(100) NOT NULL, -- e.g., 'invoice', 'customer', 'payment'
  entity_id VARCHAR(255), -- ID of the specific entity being synced
  direction sync_direction NOT NULL,
  status sync_status NOT NULL DEFAULT 'pending',

  -- Request/Response Data
  request_data JSONB,
  response_data JSONB,

  -- Error Handling
  error_message TEXT,
  error_code VARCHAR(50),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE integration_sync_logs IS 'Log of integration sync operations';
COMMENT ON COLUMN integration_sync_logs.connection_id IS 'The connection this sync belongs to';
COMMENT ON COLUMN integration_sync_logs.entity_type IS 'Type of entity being synced (invoice, customer, etc.)';
COMMENT ON COLUMN integration_sync_logs.entity_id IS 'Identifier of the specific entity';
COMMENT ON COLUMN integration_sync_logs.direction IS 'Whether data is inbound, outbound, or bidirectional';
COMMENT ON COLUMN integration_sync_logs.request_data IS 'Data sent to the external service';
COMMENT ON COLUMN integration_sync_logs.response_data IS 'Response received from external service';
COMMENT ON COLUMN integration_sync_logs.retry_count IS 'Number of retry attempts made';

-- ============================================
-- INDEXES
-- ============================================

-- Integrations Indexes
CREATE INDEX idx_integrations_provider ON integrations(provider);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_integrations_status ON integrations(status);

-- Integration Connections Indexes
CREATE INDEX idx_integration_connections_integration ON integration_connections(integration_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_integration_connections_organization ON integration_connections(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_integration_connections_status ON integration_connections(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_integration_connections_external_account ON integration_connections(external_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_integration_connections_deleted_at ON integration_connections(deleted_at);

-- Sync Logs Indexes
CREATE INDEX idx_sync_logs_connection ON integration_sync_logs(connection_id);
CREATE INDEX idx_sync_logs_entity_type ON integration_sync_logs(entity_type);
CREATE INDEX idx_sync_logs_status ON integration_sync_logs(status);
CREATE INDEX idx_sync_logs_created_at ON integration_sync_logs(created_at);
CREATE INDEX idx_sync_logs_retry ON integration_sync_logs(status, next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for integrations
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for integration_connections
CREATE TRIGGER trg_integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- Integrations: Anyone authenticated can view available integrations
CREATE POLICY integrations_select ON integrations
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Integration Connections: Require permission to manage
CREATE POLICY integration_connections_select ON integration_connections
  FOR SELECT
  USING (
    deleted_at IS NULL AND
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

CREATE POLICY integration_connections_insert ON integration_connections
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

CREATE POLICY integration_connections_update ON integration_connections
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
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

CREATE POLICY integration_connections_delete ON integration_connections
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

-- Sync Logs: Same permissions as connections
CREATE POLICY sync_logs_select ON integration_sync_logs
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

-- ============================================
-- SEED DATA: Available Integrations
-- ============================================

INSERT INTO integrations (provider, type, name, description, status) VALUES
  ('quickbooks', 'accounting', 'QuickBooks Online', 'Sync invoices, payments, and customer data with QuickBooks Online', 'active'),
  ('pipedrive', 'crm', 'Pipedrive', 'Sync deals, contacts, and activities with Pipedrive CRM', 'active'),
  ('monday', 'project_management', 'Monday.com', 'Sync tasks and projects with Monday.com', 'inactive');

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS sync_logs_select ON integration_sync_logs;
-- DROP POLICY IF EXISTS integration_connections_delete ON integration_connections;
-- DROP POLICY IF EXISTS integration_connections_update ON integration_connections;
-- DROP POLICY IF EXISTS integration_connections_insert ON integration_connections;
-- DROP POLICY IF EXISTS integration_connections_select ON integration_connections;
-- DROP POLICY IF EXISTS integrations_select ON integrations;
-- DROP TRIGGER IF EXISTS trg_integration_connections_updated_at ON integration_connections;
-- DROP TRIGGER IF EXISTS trg_integrations_updated_at ON integrations;
-- DROP TABLE IF EXISTS integration_sync_logs;
-- DROP TABLE IF EXISTS integration_connections;
-- DROP TABLE IF EXISTS integrations;
-- DROP TYPE IF EXISTS sync_status;
-- DROP TYPE IF EXISTS sync_direction;
-- DROP TYPE IF EXISTS connection_status;
-- DROP TYPE IF EXISTS integration_status;
-- DROP TYPE IF EXISTS integration_type;
-- DROP TYPE IF EXISTS integration_provider;
