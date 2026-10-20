-- ============================================
-- Migration: 163_executive_daily_snapshots.sql
-- Description: Daily snapshot of the ERP backlog and inventory figures used
--              on the executive dashboard
-- Created: 2026-10-20
--
-- Why: Ankur's executive dashboard spec — Table 3.1 (Backlog) and Table 4.2
-- (Current Inventory) show T90 Avg, YTD Avg and PY. Spec: "For balances
-- (AR, AP, inventory, backlog), the average of daily values over the period".
-- The ERP only knows today's backlog and stock, so one row per day is stored
-- (when the dashboard is opened and by the daily QuickBooks financials cron).
-- Averages fill in as days are recorded; PY appears after one year.
--
-- Safe: creates one new table; no existing data changes. Server-only
-- (service role); RLS enabled with no policies.
-- Before it is applied: the dashboard works as before and these columns keep
-- showing "No history yet".
-- Rollback:
--   DROP TABLE IF EXISTS executive_daily_snapshots;
-- ============================================

CREATE TABLE IF NOT EXISTS executive_daily_snapshots (
  snapshot_date DATE PRIMARY KEY,
  backlog_tires INTEGER NOT NULL DEFAULT 0,
  -- dollars
  backlog_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tires_on_hand INTEGER NOT NULL DEFAULT 0,
  tires_allocated INTEGER NOT NULL DEFAULT 0,
  uncommitted_tires INTEGER NOT NULL DEFAULT 0,
  months_of_supply NUMERIC(8, 1),
  -- dollars, from that day's QuickBooks snapshot (null when not synced that day)
  inventory_at_cost NUMERIC(14, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE executive_daily_snapshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE executive_daily_snapshots IS 'Daily ERP backlog and inventory figures for executive dashboard averages (server-side only)';
