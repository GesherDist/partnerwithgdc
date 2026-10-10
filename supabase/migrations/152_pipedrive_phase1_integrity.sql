-- ============================================
-- Migration: 152_pipedrive_phase1_integrity.sql
-- Description: Pipedrive Phase 1 data-integrity fixes
--   1. Allow multiple leads per Pipedrive person
--   2. Durable webhook deduplication table
-- Created: 2026-10-09
-- ============================================

-- ============================================
-- 1. Drop UNIQUE constraint on leads.pipedrive_person_id
-- ============================================
-- One Pipedrive person can own several Leads Inbox leads. The UNIQUE
-- constraint (created inline in 098) made the second lead fail on every
-- sync, and also counted soft-deleted rows. Lead identity is
-- pipedrive_lead_id (partial unique index from 099), which is unchanged.
-- The non-unique index idx_leads_pipedrive_person_id (098) is kept for lookups.

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE rel.oid = 'public.leads'::regclass
      AND con.contype = 'u'
      AND att.attname = 'pipedrive_person_id'
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_pipedrive_person_id ON leads(pipedrive_person_id);

-- ============================================
-- 2. Webhook deduplication table
-- ============================================
-- Pipedrive retries webhook deliveries. An in-memory cache does not work
-- across serverless instances, so processed event keys are recorded here.
-- Accessed only server-side with the service role.

CREATE TABLE IF NOT EXISTS pipedrive_webhook_events (
  event_key VARCHAR(255) PRIMARY KEY,
  event VARCHAR(100) NOT NULL,
  pipedrive_id INTEGER,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipedrive_webhook_events_received_at
  ON pipedrive_webhook_events(received_at);

ALTER TABLE pipedrive_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pipedrive_webhook_events IS 'Processed Pipedrive webhook event keys for idempotent delivery handling';
