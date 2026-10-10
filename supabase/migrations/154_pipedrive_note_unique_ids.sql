-- ============================================
-- Migration: 154_pipedrive_note_unique_ids.sql
-- Description: One local note per Pipedrive note (prevents duplicate notes
--              from concurrent syncs or repeated imports)
-- Created: 2026-10-09
--
-- SAFETY: This migration does not delete or modify any rows. If duplicates
-- already exist, it raises an error and the whole migration rolls back.
-- Run the read-only check below first; resolve duplicates with an approved
-- data fix, then apply this migration.
--
--   SELECT 'deal_notes' AS table_name, pipedrive_note_id, COUNT(*)
--   FROM deal_notes WHERE pipedrive_note_id IS NOT NULL
--   GROUP BY pipedrive_note_id HAVING COUNT(*) > 1
--   UNION ALL
--   SELECT 'lead_notes', pipedrive_note_id, COUNT(*)
--   FROM lead_notes WHERE pipedrive_note_id IS NOT NULL
--   GROUP BY pipedrive_note_id HAVING COUNT(*) > 1;
-- ============================================

DO $$
DECLARE
  deal_duplicates INTEGER;
  lead_duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO deal_duplicates FROM (
    SELECT pipedrive_note_id FROM deal_notes
    WHERE pipedrive_note_id IS NOT NULL
    GROUP BY pipedrive_note_id HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO lead_duplicates FROM (
    SELECT pipedrive_note_id FROM lead_notes
    WHERE pipedrive_note_id IS NOT NULL
    GROUP BY pipedrive_note_id HAVING COUNT(*) > 1
  ) l;

  IF deal_duplicates > 0 OR lead_duplicates > 0 THEN
    RAISE EXCEPTION
      'Duplicate Pipedrive note IDs found (deal_notes: %, lead_notes: %). Resolve them before applying migration 154.',
      deal_duplicates, lead_duplicates;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_notes_pipedrive_note_id_unique
  ON deal_notes(pipedrive_note_id)
  WHERE pipedrive_note_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_notes_pipedrive_note_id_unique
  ON lead_notes(pipedrive_note_id)
  WHERE pipedrive_note_id IS NOT NULL;
