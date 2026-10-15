-- ============================================
-- Migration: 161_chart_of_accounts_dashboard_mapping.sql
-- Description: Map QuickBooks accounts to dashboard categories
-- Created: 2026-10-15
--
-- Why: Oct 12 call — cash, AR/AP (+ aging), inventory, operating cash flow
-- and OPEX for the management dashboard come from QuickBooks, using Ankur's
-- chart of accounts. Each QuickBooks account is mapped to one dashboard
-- category; OPEX accounts also get a group (default: the parent account).
--
-- Columns (NULL = use the suggestion derived from the account type):
--   dashboard_category: cash | accounts_receivable | accounts_payable |
--                       inventory | revenue | cogs | opex | not_used
--   opex_group:         OPEX report line, e.g. "Legal & Professional Fees"
--
-- Safe: adds nullable columns only; the QuickBooks account sync does not
-- write them, so a re-sync keeps the mapping. No existing data changes.
-- Before it is applied: Settings > QuickBooks > Chart of Accounts shows the
-- suggested mapping read-only and says this migration is required.
-- Test: apply on staging; change an account's category, reload, the change
-- is kept; run "Sync accounts", the change is still kept.
-- Rollback:
--   ALTER TABLE chart_of_accounts
--     DROP COLUMN IF EXISTS dashboard_category,
--     DROP COLUMN IF EXISTS opex_group,
--     DROP COLUMN IF EXISTS mapping_updated_at,
--     DROP COLUMN IF EXISTS mapping_updated_by;
-- ============================================

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS dashboard_category VARCHAR(30)
    CHECK (dashboard_category IN (
      'cash', 'accounts_receivable', 'accounts_payable', 'inventory',
      'revenue', 'cogs', 'opex', 'not_used'
    )),
  ADD COLUMN IF NOT EXISTS opex_group VARCHAR(150),
  ADD COLUMN IF NOT EXISTS mapping_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mapping_updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN chart_of_accounts.dashboard_category IS 'Dashboard category override; NULL = suggested from account type';
COMMENT ON COLUMN chart_of_accounts.opex_group IS 'OPEX group override; NULL = parent account name';
