-- ============================================
-- Migration: 162_qbo_financial_snapshots.sql
-- Description: Daily snapshot of the QuickBooks figures used on the
--              management dashboard
-- Created: 2026-10-15
--
-- Why: Oct 12 call — cash, AR + aging, AP + aging, inventory, operating cash
-- flow and OPEX come from QuickBooks (two-way sync). A daily sync (cron) and
-- a "Sync now" button read the QuickBooks reports (Balance Sheet, A/R and A/P
-- Aging, Cash Flow, Profit and Loss) and store one snapshot per company per
-- day, so the dashboard loads instantly and history/trends are kept.
--
-- data: JSON built by qbo-financials.service.ts (cash, AR, AP, inventory,
--       aging buckets, operating cash flow, OPEX by month and group).
--
-- Safe: creates one new table; no existing data changes. Server-only
-- (service role); RLS enabled with no policies.
-- Before it is applied: "Sync now" still shows fresh QuickBooks figures but
-- cannot store them; the daily sync reports that this migration is required.
-- Test: apply on staging; Dashboard > Financial > QuickBooks Financials >
-- Sync now; reload the page and the same figures are shown.
-- Rollback:
--   DROP TABLE IF EXISTS qbo_financial_snapshots;
-- ============================================

CREATE TABLE IF NOT EXISTS qbo_financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qbo_realm_id VARCHAR(50) NOT NULL,
  snapshot_date DATE NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qbo_financial_snapshots_day_unique UNIQUE (qbo_realm_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_qbo_financial_snapshots_realm_date
  ON qbo_financial_snapshots (qbo_realm_id, snapshot_date DESC);

ALTER TABLE qbo_financial_snapshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE qbo_financial_snapshots IS 'Daily QuickBooks figures for the management dashboard (server-side only)';
