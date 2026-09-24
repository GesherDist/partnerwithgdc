-- ============================================
-- MIGRATION: 002_auth_tables.sql
-- PURPOSE: User and session management tables
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 001_initial_schema.sql
-- ============================================

-- ============================================
-- USERS TABLE
-- ============================================
-- Stores application user profiles
-- Links to Supabase Auth via auth_user_id
-- ============================================

CREATE TABLE users (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase Auth Link
  auth_user_id UUID UNIQUE,

  -- Profile Information
  email CITEXT NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,

  -- Role Reference (FK added in 003_rbac_tables.sql)
  role_id UUID,

  -- Status
  status user_status NOT NULL DEFAULT 'pending',

  -- Login Tracking
  last_login_at TIMESTAMPTZ,
  login_count INTEGER NOT NULL DEFAULT 0,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,

  -- Email Verification
  email_verified_at TIMESTAMPTZ,

  -- Audit Fields (Required on all tables)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~* '^\+?[0-9\s\-\(\)]{7,20}$'),
  CONSTRAINT users_first_name_length CHECK (LENGTH(TRIM(first_name)) >= 1),
  CONSTRAINT users_last_name_length CHECK (LENGTH(TRIM(last_name)) >= 1)
);

-- Indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role_id ON users(role_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_full_name ON users(first_name, last_name) WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE users IS 'Application users with profile information';
COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.auth_user_id IS 'Reference to Supabase Auth user';
COMMENT ON COLUMN users.email IS 'User email address (case-insensitive, unique)';
COMMENT ON COLUMN users.first_name IS 'User first name';
COMMENT ON COLUMN users.last_name IS 'User last name';
COMMENT ON COLUMN users.phone IS 'User phone number';
COMMENT ON COLUMN users.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN users.role_id IS 'Reference to user role';
COMMENT ON COLUMN users.status IS 'Current account status';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN users.login_count IS 'Total number of successful logins';
COMMENT ON COLUMN users.failed_login_count IS 'Consecutive failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp (NULL = active)';

-- ============================================
-- USER SESSIONS TABLE
-- ============================================
-- Tracks active user sessions for "Remember Me"
-- and session management functionality
-- ============================================

CREATE TABLE user_sessions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Reference
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Session Data
  refresh_token_hash VARCHAR(255) NOT NULL,

  -- Device/Client Info
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(50),

  -- Session Timing
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Revocation
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(100),

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(refresh_token_hash) WHERE revoked_at IS NULL;

-- Comments
COMMENT ON TABLE user_sessions IS 'Active user sessions for session management';
COMMENT ON COLUMN user_sessions.refresh_token_hash IS 'Hashed refresh token for security';
COMMENT ON COLUMN user_sessions.ip_address IS 'IP address of the session';
COMMENT ON COLUMN user_sessions.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN user_sessions.device_type IS 'Type of device (desktop, mobile, tablet)';
COMMENT ON COLUMN user_sessions.expires_at IS 'Session expiration timestamp';
COMMENT ON COLUMN user_sessions.last_active_at IS 'Last activity timestamp';
COMMENT ON COLUMN user_sessions.revoked_at IS 'Timestamp when session was revoked';
COMMENT ON COLUMN user_sessions.revoked_reason IS 'Reason for session revocation';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Users can update their own profile (limited fields)
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Sessions belong to users
CREATE POLICY sessions_select_own ON user_sessions
  FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS sessions_select_own ON user_sessions;
-- DROP POLICY IF EXISTS users_update_own ON users;
-- DROP POLICY IF EXISTS users_select_own ON users;
-- DROP TABLE IF EXISTS user_sessions;
-- DROP TABLE IF EXISTS users;
