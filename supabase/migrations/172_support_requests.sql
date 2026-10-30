-- ============================================
-- Migration: 172_support_requests.sql
-- Description: Messages sent from the Help & Support widget
-- Created: 2026-10-30
--
-- Why: the Help button (SupportWidget) was UI only. Each message is now saved
-- here, its files go to S3 (support-requests/<id>/...), and an email goes to
-- SUPPORT_EMAIL with Reply-To set to the user, so a reply reaches them directly.
--
-- Safe: creates a new table only; nothing existing is changed. Re-runnable.
-- Written by the server (service role); RLS on with no policies, so the
-- browser cannot read or write it.
-- Rollback:
--   DROP TABLE IF EXISTS support_requests;
-- ============================================

CREATE TABLE IF NOT EXISTS support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who sent it (name/email kept in case the user is removed later)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(200),
  user_email VARCHAR(255),

  -- What and where
  message TEXT NOT NULL,
  page_path VARCHAR(500),
  page_url TEXT,

  -- [{ name, size, type, key }] - key is the S3 object key (null if upload failed)
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Email to support: 'pending' | 'sent' | 'failed'
  email_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  email_error TEXT,

  -- Follow-up: 'open' | 'resolved'
  status VARCHAR(20) NOT NULL DEFAULT 'open',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_support_email_status CHECK (email_status IN ('pending', 'sent', 'failed')),
  CONSTRAINT check_support_status CHECK (status IN ('open', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_support_requests_created ON support_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_user ON support_requests(user_id);

ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE support_requests IS 'Help & Support widget messages (saved by the server, emailed to SUPPORT_EMAIL)';
