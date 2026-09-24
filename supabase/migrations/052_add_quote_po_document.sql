-- ============================================
-- MIGRATION: 052_add_quote_po_document.sql
-- PURPOSE: Add PO document URL field to quotes table
-- AUTHOR: System
-- DATE: 2024
-- ============================================

-- Add po_document_url column to quotes table
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS po_document_url VARCHAR(500);

COMMENT ON COLUMN quotes.po_document_url IS 'URL/path to the uploaded PO document';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- ALTER TABLE quotes DROP COLUMN IF EXISTS po_document_url;
