-- ============================================
-- Migration: 155_quotes_pipedrive_deal_link.sql
-- Description: Link ERP quotes to the Pipedrive deal they were created from
-- Created: 2026-10-09
--
-- Why: when a Pipedrive deal is marked Won, Gesher creates one ERP quote from
-- the deal's products (then the normal approval -> sales order workflow runs).
-- Pipedrive retries webhooks and reps can also convert the deal in Gesher, so
-- the deal ID must be stored on the quote and be unique among live quotes to
-- make the process idempotent (a retry finds the existing quote instead of
-- creating a duplicate).
--
-- Safe: adds a nullable column and a partial unique index on it. Existing
-- quotes get NULL, so the index cannot fail on existing data.
-- Test: apply on staging, then run the "won deal" regression scenario twice for
-- the same deal and confirm one quote exists.
-- Rollback: DROP INDEX idx_quotes_pipedrive_deal_id_unique;
--           ALTER TABLE quotes DROP COLUMN pipedrive_deal_id;
-- ============================================

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS pipedrive_deal_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_pipedrive_deal_id_unique
  ON public.quotes(pipedrive_deal_id)
  WHERE pipedrive_deal_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.quotes.pipedrive_deal_id IS 'Pipedrive deal this quote was created for (one live quote per deal)';
