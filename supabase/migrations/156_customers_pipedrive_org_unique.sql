-- ============================================
-- Migration: 156_customers_pipedrive_org_unique.sql
-- Description: At most one live Gesher customer per Pipedrive organization
-- Created: 2026-10-09
--
-- Why: won deals, purchase history and the customer import resolve the ERP
-- customer from the deal's Pipedrive organization. Two customers linked to the
-- same organization would make that ambiguous (wrong customer on an order).
--
-- SAFETY: does not modify rows. If duplicates exist it raises an error and the
-- migration rolls back. Read-only check to run first:
--   SELECT pipedrive_org_id, COUNT(*) FROM customers
--   WHERE pipedrive_org_id IS NOT NULL AND deleted_at IS NULL
--   GROUP BY pipedrive_org_id HAVING COUNT(*) > 1;
-- Optional: the application already refuses to act when an organization maps
-- to several customers; this index enforces it at the database level.
-- Rollback: DROP INDEX idx_customers_pipedrive_org_id_unique;
-- ============================================

DO $$
DECLARE
  duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicates FROM (
    SELECT pipedrive_org_id FROM public.customers
    WHERE pipedrive_org_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY pipedrive_org_id HAVING COUNT(*) > 1
  ) d;

  IF duplicates > 0 THEN
    RAISE EXCEPTION
      '% Pipedrive organizations are linked to more than one customer. Resolve them before applying migration 156.',
      duplicates;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_pipedrive_org_id_unique
  ON public.customers(pipedrive_org_id)
  WHERE pipedrive_org_id IS NOT NULL AND deleted_at IS NULL;
