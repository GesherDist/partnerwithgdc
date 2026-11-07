-- ============================================
-- Migration 175: App settings (Dashboard targets)
-- ============================================
--
-- Purpose (Nov 7 2026):
--   The dashboard targets were hardcoded ($220,000 monthly revenue, 30% margin).
--   QuickBooks has no budget for Gesher, so the targets are set in
--   Settings > Dashboard Targets and stored here.
--
-- Adds:
--   - app_settings: one row per setting key, value as JSON
--   - row 'dashboard_targets' with today's values (so nothing changes until edited)
--
-- Safe for existing data: new table only. Read / written by the server
-- (service role); RLS on with no policies, so browsers cannot read or write it.
-- ============================================

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE app_settings IS 'Application settings, one row per key (e.g. dashboard_targets)';
COMMENT ON COLUMN app_settings.value IS 'Setting value as JSON, e.g. {"monthlyRevenueTarget": 220000, "marginTargetPct": 30}';

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Today's hardcoded targets, so the dashboard shows the same values until they are edited
INSERT INTO app_settings (key, value)
VALUES ('dashboard_targets', '{"monthlyRevenueTarget": 220000, "marginTargetPct": 30}'::jsonb)
ON CONFLICT (key) DO NOTHING;
