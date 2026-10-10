-- ============================================
-- Migration: 153_pipedrive_phase2_integrity.sql
-- Description: Pipedrive Phase 2 critical fixes
--   1. Record who soft-deleted a lead (user vs Pipedrive sync)
--   2. Track webhook processing state for crash recovery
-- Created: 2026-10-09
-- Requires: 152_pipedrive_phase1_integrity.sql
-- Must be applied BEFORE deploying the Phase 2 code.
-- Non-destructive: adds nullable/defaulted columns only, no data is changed or deleted.
-- ============================================

-- ============================================
-- 1. leads.deleted_source
-- ============================================
-- 'user'           = deleted in Gesher; the sync must never re-create it
-- 'pipedrive_sync' = removed by sync cleanup; restored if it reappears in Pipedrive
-- NULL             = deleted before this migration (origin unknown; treated like 'user')

ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_source VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_deleted_source_check'
      AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_deleted_source_check
      CHECK (deleted_source IS NULL OR deleted_source IN ('user', 'pipedrive_sync'));
  END IF;
END $$;

COMMENT ON COLUMN leads.deleted_source IS 'Who soft-deleted the lead: user (never re-create) or pipedrive_sync (restore if it reappears)';

-- ============================================
-- 2. pipedrive_webhook_events processing state
-- ============================================
-- Rows created by migration 152 were only written after a successful claim and
-- were never marked, so existing rows default to 'done'.

ALTER TABLE pipedrive_webhook_events
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'done';

ALTER TABLE pipedrive_webhook_events
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE pipedrive_webhook_events
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pipedrive_webhook_events_status_check'
      AND conrelid = 'public.pipedrive_webhook_events'::regclass
  ) THEN
    ALTER TABLE pipedrive_webhook_events
      ADD CONSTRAINT pipedrive_webhook_events_status_check
      CHECK (status IN ('processing', 'done'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pipedrive_webhook_events_processing
  ON pipedrive_webhook_events(claimed_at)
  WHERE status = 'processing';
