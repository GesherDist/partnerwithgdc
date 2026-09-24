-- ============================================
-- MIGRATION: 001_initial_schema.sql
-- PURPOSE: Initial schema setup with extensions, enums, and utility functions
-- AUTHOR: System
-- DATE: 2024
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Case-insensitive text
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================
-- CUSTOM TYPES / ENUMS
-- ============================================

-- User status enum
CREATE TYPE user_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'pending'
);

-- Audit action types
CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'restore',
  'login',
  'logout',
  'password_change',
  'password_reset',
  'role_assign',
  'permission_grant',
  'permission_revoke',
  'export',
  'import',
  'approve',
  'reject'
);

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent hard deletes (enforce soft delete)
CREATE OR REPLACE FUNCTION prevent_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletes are not allowed. Use soft delete by setting deleted_at instead.';
END;
$$ LANGUAGE plpgsql;

-- Function to generate a URL-safe slug from text
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(input_text),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '[\s-]+', '_', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';
COMMENT ON EXTENSION "pgcrypto" IS 'Cryptographic functions';
COMMENT ON EXTENSION "citext" IS 'Case-insensitive character string type';

COMMENT ON TYPE user_status IS 'Possible statuses for user accounts';
COMMENT ON TYPE audit_action IS 'Types of actions that can be audited';

COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function to automatically update updated_at timestamp';
COMMENT ON FUNCTION prevent_hard_delete() IS 'Trigger function to prevent hard deletes and enforce soft delete pattern';
COMMENT ON FUNCTION generate_slug(TEXT) IS 'Utility function to generate URL-safe slugs from text';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP FUNCTION IF EXISTS generate_slug(TEXT);
-- DROP FUNCTION IF EXISTS prevent_hard_delete();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TYPE IF EXISTS audit_action;
-- DROP TYPE IF EXISTS user_status;
-- DROP EXTENSION IF EXISTS "citext";
-- DROP EXTENSION IF EXISTS "pgcrypto";
-- DROP EXTENSION IF EXISTS "uuid-ossp";
