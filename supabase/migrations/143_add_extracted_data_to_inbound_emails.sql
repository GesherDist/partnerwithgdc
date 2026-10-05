-- ============================================
-- ADD EXTRACTED DATA TO INBOUND EMAILS
-- ============================================
-- Migration: 143
-- Description: Add AI-extracted data columns to existing inbound_emails table
-- Date: 2026-10-02
-- ============================================

-- Add columns for AI-extracted data
ALTER TABLE inbound_emails
ADD COLUMN extracted_data JSONB,
ADD COLUMN extraction_confidence DECIMAL(3,2),
ADD COLUMN extraction_status VARCHAR(50);

-- Create index for faster filtering
CREATE INDEX idx_inbound_emails_extraction_status ON inbound_emails(extraction_status);
CREATE INDEX idx_inbound_emails_extraction_confidence ON inbound_emails(extraction_confidence);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN inbound_emails.extracted_data IS 'AI-extracted data from email (customer PO, supplier PO, etc.) with matching results';
COMMENT ON COLUMN inbound_emails.extraction_confidence IS 'Overall confidence score (0.0-1.0) for extracted data';
COMMENT ON COLUMN inbound_emails.extraction_status IS 'Extraction status: pending, extracted, approved, rejected';
