-- ============================================
-- Migration: Restore RBAC Fields
-- Description: Add back all previously removed fields to roles, permissions, and role_permissions tables
-- ============================================

-- ============================================
-- ROLES TABLE - Add back removed fields
-- ============================================

-- Add slug field
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS slug VARCHAR(100);

-- Add display_name field
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Add level field (for role hierarchy)
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0;

-- Add created_by field
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add updated_by field
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_slug ON roles(slug) WHERE deleted_at IS NULL;

-- ============================================
-- PERMISSIONS TABLE - Add back removed fields
-- ============================================

-- Add display_name field
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Add module field
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS module VARCHAR(50);

-- Add action field
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS action VARCHAR(50);

-- Add category field
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Add created_by field
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add updated_by field
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add deleted_at field (for soft delete)
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_deleted_at ON permissions(deleted_at);

-- ============================================
-- ROLE_PERMISSIONS TABLE - Add back removed fields
-- ============================================

-- Note: Adding back 'id' as primary key requires dropping and recreating the table
-- or adding it as a separate column. We'll add it as a separate UUID column.

-- Add id field (UUID)
ALTER TABLE role_permissions
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Add created_at field
ALTER TABLE role_permissions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add created_by field
ALTER TABLE role_permissions
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- ============================================
-- UPDATE EXISTING DATA (populate slug from name if empty)
-- ============================================

-- Generate slug from name for existing roles
UPDATE roles
SET slug = LOWER(REPLACE(REPLACE(name, ' ', '_'), '-', '_'))
WHERE slug IS NULL;

-- Generate display_name from name for existing roles
UPDATE roles
SET display_name = name
WHERE display_name IS NULL;

-- Generate display_name from name for existing permissions
UPDATE permissions
SET display_name = name
WHERE display_name IS NULL;

-- Extract module from name for existing permissions (e.g., 'users.view' -> 'users')
UPDATE permissions
SET module = SPLIT_PART(name, '.', 1)
WHERE module IS NULL AND name LIKE '%.%';

-- Extract action from name for existing permissions (e.g., 'users.view' -> 'view')
UPDATE permissions
SET action = SPLIT_PART(name, '.', 2)
WHERE action IS NULL AND name LIKE '%.%';

-- Set category from group_name for existing permissions
UPDATE permissions
SET category = group_name
WHERE category IS NULL AND group_name IS NOT NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN roles.slug IS 'URL-friendly identifier for the role';
COMMENT ON COLUMN roles.display_name IS 'Human-readable name for the role';
COMMENT ON COLUMN roles.level IS 'Hierarchy level for role ordering (higher = more permissions)';
COMMENT ON COLUMN roles.created_by IS 'User who created the role';
COMMENT ON COLUMN roles.updated_by IS 'User who last updated the role';

COMMENT ON COLUMN permissions.display_name IS 'Human-readable name for the permission';
COMMENT ON COLUMN permissions.module IS 'Module this permission belongs to (e.g., users, roles)';
COMMENT ON COLUMN permissions.action IS 'Action type (e.g., view, create, edit, delete)';
COMMENT ON COLUMN permissions.category IS 'Category for grouping permissions in UI';
COMMENT ON COLUMN permissions.created_by IS 'User who created the permission';
COMMENT ON COLUMN permissions.updated_by IS 'User who last updated the permission';
COMMENT ON COLUMN permissions.deleted_at IS 'Soft delete timestamp';

COMMENT ON COLUMN role_permissions.id IS 'Unique identifier for the role-permission assignment';
COMMENT ON COLUMN role_permissions.created_at IS 'When the permission was assigned to the role';
COMMENT ON COLUMN role_permissions.created_by IS 'User who assigned the permission to the role';
