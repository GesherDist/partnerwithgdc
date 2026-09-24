-- Migration: Increase po_document_url column length
-- Supabase signed URLs can be very long (1000+ characters)
-- Increasing from VARCHAR(500) to VARCHAR(2000)

ALTER TABLE quotes
ALTER COLUMN po_document_url TYPE VARCHAR(2000);

COMMENT ON COLUMN quotes.po_document_url IS 'URL/path to the uploaded PO document (supports long signed URLs)';

-- Rollback:
-- ALTER TABLE quotes ALTER COLUMN po_document_url TYPE VARCHAR(500);
