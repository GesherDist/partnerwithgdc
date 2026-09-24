-- ============================================
-- Migration: Remove Restored RBAC Fields (Rollback of 027)
-- Description: Remove fields that were added back in 027_restore_rbac_fields.sql
-- ============================================

-- ============================================
-- ROLES TABLE - Remove restored fields
-- ============================================

-- Drop index first
DROP INDEX IF EXISTS idx_roles_slug;

-- Remove fields
ALTER TABLE roles DROP COLUMN IF EXISTS slug;
ALTER TABLE roles DROP COLUMN IF EXISTS display_name;
ALTER TABLE roles DROP COLUMN IF EXISTS level;
ALTER TABLE roles DROP COLUMN IF EXISTS created_by;
ALTER TABLE roles DROP COLUMN IF EXISTS updated_by;

-- ============================================
-- PERMISSIONS TABLE - Remove restored fields
-- ============================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_permissions_module;
DROP INDEX IF EXISTS idx_permissions_action;
DROP INDEX IF EXISTS idx_permissions_category;
DROP INDEX IF EXISTS idx_permissions_deleted_at;

-- Remove fields
ALTER TABLE permissions DROP COLUMN IF EXISTS display_name;
ALTER TABLE permissions DROP COLUMN IF EXISTS module;
ALTER TABLE permissions DROP COLUMN IF EXISTS action;
ALTER TABLE permissions DROP COLUMN IF EXISTS category;
ALTER TABLE permissions DROP COLUMN IF EXISTS created_by;
ALTER TABLE permissions DROP COLUMN IF EXISTS updated_by;
ALTER TABLE permissions DROP COLUMN IF EXISTS deleted_at;

-- ============================================
-- ROLE_PERMISSIONS TABLE - Remove restored fields
-- ============================================

ALTER TABLE role_permissions DROP COLUMN IF EXISTS id;
ALTER TABLE role_permissions DROP COLUMN IF EXISTS created_at;
ALTER TABLE role_permissions DROP COLUMN IF EXISTS created_by;
