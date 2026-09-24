-- ============================================
-- MIGRATION: 025_cleanup_rbac_schema.sql
-- PURPOSE: Cleanup RBAC tables - remove extra fields, add missing fields
-- DEPENDS ON: 003_rbac_tables.sql
-- ============================================

-- ============================================
-- 1. ROLES TABLE CHANGES
-- ============================================

-- Create scope enum type
DO $$ BEGIN
  CREATE TYPE role_scope AS ENUM ('user', 'customer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add scope column
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS scope role_scope NOT NULL DEFAULT 'user';

-- Rename is_system to is_system_role
DO $$ BEGIN
  ALTER TABLE roles RENAME COLUMN is_system TO is_system_role;
EXCEPTION
  WHEN undefined_column THEN null;
END $$;

-- Drop dependent policies first
DROP POLICY IF EXISTS audit_logs_select_admin ON audit_logs;

-- Remove extra columns from roles
ALTER TABLE roles DROP COLUMN IF EXISTS slug;
ALTER TABLE roles DROP COLUMN IF EXISTS display_name;
ALTER TABLE roles DROP COLUMN IF EXISTS level;
ALTER TABLE roles DROP COLUMN IF EXISTS created_by;
ALTER TABLE roles DROP COLUMN IF EXISTS updated_by;

-- Recreate audit_logs_select_admin policy without using level
CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name = 'Admin'
        AND u.deleted_at IS NULL
    )
  );

-- Drop old indexes
DROP INDEX IF EXISTS idx_roles_slug;
DROP INDEX IF EXISTS idx_roles_level;
DROP INDEX IF EXISTS idx_roles_is_system;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_roles_scope ON roles(scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_roles_is_system_role ON roles(is_system_role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name) WHERE deleted_at IS NULL;

-- Drop old constraints
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_slug_format;
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_level_range;

-- Update trigger function
CREATE OR REPLACE FUNCTION prevent_system_role_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system_role = TRUE THEN
    RAISE EXCEPTION 'System roles cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. PERMISSIONS TABLE CHANGES
-- ============================================

-- Add missing columns
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES permissions(id) ON DELETE SET NULL;

ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS group_name VARCHAR(100);

ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Remove extra columns from permissions
ALTER TABLE permissions DROP COLUMN IF EXISTS display_name;
ALTER TABLE permissions DROP COLUMN IF EXISTS module;
ALTER TABLE permissions DROP COLUMN IF EXISTS action;
ALTER TABLE permissions DROP COLUMN IF EXISTS category;
ALTER TABLE permissions DROP COLUMN IF EXISTS created_by;
ALTER TABLE permissions DROP COLUMN IF EXISTS updated_by;
ALTER TABLE permissions DROP COLUMN IF EXISTS deleted_at;

-- Drop old indexes
DROP INDEX IF EXISTS idx_permissions_module;
DROP INDEX IF EXISTS idx_permissions_action;
DROP INDEX IF EXISTS idx_permissions_category;
DROP INDEX IF EXISTS idx_permissions_deleted_at;

-- Drop old constraints
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_name_format;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_module_format;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_action_format;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_unique_module_action;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_permissions_parent_id ON permissions(parent_id);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_group_name ON permissions(group_name);
CREATE INDEX IF NOT EXISTS idx_permissions_sort_order ON permissions(sort_order);

-- ============================================
-- 3. ROLE_PERMISSIONS TABLE CHANGES
-- ============================================

-- Add is_active column
ALTER TABLE role_permissions
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Remove extra columns from role_permissions
ALTER TABLE role_permissions DROP COLUMN IF EXISTS created_at;
ALTER TABLE role_permissions DROP COLUMN IF EXISTS created_by;

-- Drop old constraint and index
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_unique;

-- Handle primary key change (id to composite)
-- First drop the old primary key if it exists
DO $$
BEGIN
  -- Check if id column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'role_permissions' AND column_name = 'id') THEN
    -- Drop the primary key constraint
    ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_pkey;
    -- Drop the id column
    ALTER TABLE role_permissions DROP COLUMN id;
    -- Add composite primary key
    ALTER TABLE role_permissions ADD PRIMARY KEY (role_id, permission_id);
  END IF;
END $$;

-- Create new index for is_active
CREATE INDEX IF NOT EXISTS idx_role_permissions_is_active ON role_permissions(is_active);

-- ============================================
-- 4. UPDATE HELPER FUNCTIONS
-- ============================================

-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS get_user_permissions(UUID);

-- Update function to check if a user has a specific permission
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
      AND rp.is_active = TRUE
      AND p.name = p_permission_name
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update function to get all permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (
  permission_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.name
  FROM users u
  JOIN roles r ON u.role_id = r.id
  JOIN role_permissions rp ON r.id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND rp.is_active = TRUE
  ORDER BY p.sort_order;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- This migration removes columns permanently.
-- To rollback, you would need to recreate the removed columns:
--
-- ALTER TABLE roles ADD COLUMN slug VARCHAR(50);
-- ALTER TABLE roles ADD COLUMN display_name VARCHAR(100);
-- ALTER TABLE roles ADD COLUMN level INTEGER DEFAULT 0;
-- ALTER TABLE roles ADD COLUMN created_by UUID;
-- ALTER TABLE roles ADD COLUMN updated_by UUID;
-- ALTER TABLE roles RENAME COLUMN is_system_role TO is_system;
-- ALTER TABLE roles DROP COLUMN scope;
--
-- ALTER TABLE permissions ADD COLUMN display_name VARCHAR(150);
-- ALTER TABLE permissions ADD COLUMN module VARCHAR(50);
-- ALTER TABLE permissions ADD COLUMN action VARCHAR(50);
-- ALTER TABLE permissions ADD COLUMN category VARCHAR(50);
-- ALTER TABLE permissions ADD COLUMN created_by UUID;
-- ALTER TABLE permissions ADD COLUMN updated_by UUID;
-- ALTER TABLE permissions ADD COLUMN deleted_at TIMESTAMPTZ;
-- ALTER TABLE permissions DROP COLUMN parent_id;
-- ALTER TABLE permissions DROP COLUMN group_name;
-- ALTER TABLE permissions DROP COLUMN sort_order;
--
-- ALTER TABLE role_permissions ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
-- ALTER TABLE role_permissions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
-- ALTER TABLE role_permissions ADD COLUMN created_by UUID;
-- ALTER TABLE role_permissions DROP COLUMN is_active;
