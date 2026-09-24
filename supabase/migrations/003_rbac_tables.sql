-- ============================================
-- MIGRATION: 003_rbac_tables.sql
-- PURPOSE: Role-Based Access Control (RBAC) tables
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 001_initial_schema.sql, 002_auth_tables.sql
-- ============================================

-- ============================================
-- ROLES TABLE
-- ============================================
-- Defines system and custom roles
-- ============================================

CREATE TABLE roles (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Role Identity
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Role Hierarchy
  level INTEGER NOT NULL DEFAULT 0,

  -- System Flag (cannot be deleted)
  is_system BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT roles_name_length CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT roles_slug_format CHECK (slug ~* '^[a-z][a-z0-9_]*$'),
  CONSTRAINT roles_level_range CHECK (level >= 0 AND level <= 100)
);

-- Indexes
CREATE INDEX idx_roles_slug ON roles(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_level ON roles(level) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_is_system ON roles(is_system) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_deleted_at ON roles(deleted_at);

-- Triggers
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Prevent deletion of system roles
CREATE OR REPLACE FUNCTION prevent_system_role_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = TRUE THEN
    RAISE EXCEPTION 'System roles cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_prevent_system_delete
  BEFORE DELETE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_role_delete();

-- Comments
COMMENT ON TABLE roles IS 'System and custom roles for RBAC';
COMMENT ON COLUMN roles.name IS 'Internal role name';
COMMENT ON COLUMN roles.slug IS 'URL-safe role identifier';
COMMENT ON COLUMN roles.display_name IS 'Human-readable role name';
COMMENT ON COLUMN roles.description IS 'Role description';
COMMENT ON COLUMN roles.level IS 'Role hierarchy level (higher = more authority)';
COMMENT ON COLUMN roles.is_system IS 'System roles cannot be deleted';

-- ============================================
-- PERMISSIONS TABLE
-- ============================================
-- Defines granular permissions in module.action format
-- ============================================

CREATE TABLE permissions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Permission Identity
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,

  -- Permission Structure
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,

  -- Grouping
  category VARCHAR(50),

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT permissions_name_format CHECK (name ~* '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  CONSTRAINT permissions_module_format CHECK (module ~* '^[a-z][a-z0-9_]*$'),
  CONSTRAINT permissions_action_format CHECK (action ~* '^[a-z][a-z0-9_]*$'),
  CONSTRAINT permissions_unique_module_action UNIQUE (module, action)
);

-- Indexes
CREATE INDEX idx_permissions_module ON permissions(module) WHERE deleted_at IS NULL;
CREATE INDEX idx_permissions_action ON permissions(action) WHERE deleted_at IS NULL;
CREATE INDEX idx_permissions_category ON permissions(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_permissions_deleted_at ON permissions(deleted_at);

-- Triggers
CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE permissions IS 'Granular permissions in module.action format';
COMMENT ON COLUMN permissions.name IS 'Permission name in format module.action';
COMMENT ON COLUMN permissions.module IS 'Module this permission belongs to';
COMMENT ON COLUMN permissions.action IS 'Action type (view, create, edit, delete, etc.)';
COMMENT ON COLUMN permissions.category IS 'Optional grouping category';

-- ============================================
-- ROLE_PERMISSIONS TABLE
-- ============================================
-- Many-to-many relationship between roles and permissions
-- ============================================

CREATE TABLE role_permissions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

-- Indexes
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Comments
COMMENT ON TABLE role_permissions IS 'Maps roles to their permissions';
COMMENT ON COLUMN role_permissions.role_id IS 'Reference to role';
COMMENT ON COLUMN role_permissions.permission_id IS 'Reference to permission';

-- ============================================
-- ADD FOREIGN KEY TO USERS TABLE
-- ============================================

ALTER TABLE users
  ADD CONSTRAINT fk_users_role
  FOREIGN KEY (role_id) REFERENCES roles(id)
  ON DELETE SET NULL;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_permission_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = p_user_id
      AND u.deleted_at IS NULL
      AND r.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND p.name = p_permission_name
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (
  permission_name VARCHAR,
  module VARCHAR,
  action VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.name, p.module, p.action
  FROM users u
  JOIN roles r ON u.role_id = r.id
  JOIN role_permissions rp ON r.id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
  ORDER BY p.module, p.action;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON FUNCTION user_has_permission(UUID, VARCHAR) IS 'Check if user has a specific permission';
COMMENT ON FUNCTION get_user_permissions(UUID) IS 'Get all permissions for a user';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Roles are readable by authenticated users
CREATE POLICY roles_select_authenticated ON roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Permissions are readable by authenticated users
CREATE POLICY permissions_select_authenticated ON permissions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Role permissions are readable by authenticated users
CREATE POLICY role_permissions_select_authenticated ON role_permissions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS role_permissions_select_authenticated ON role_permissions;
-- DROP POLICY IF EXISTS permissions_select_authenticated ON permissions;
-- DROP POLICY IF EXISTS roles_select_authenticated ON roles;
-- DROP FUNCTION IF EXISTS get_user_permissions(UUID);
-- DROP FUNCTION IF EXISTS user_has_permission(UUID, VARCHAR);
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_role;
-- DROP TABLE IF EXISTS role_permissions;
-- DROP TABLE IF EXISTS permissions;
-- DROP TRIGGER IF EXISTS trg_roles_prevent_system_delete ON roles;
-- DROP FUNCTION IF EXISTS prevent_system_role_delete();
-- DROP TABLE IF EXISTS roles;
