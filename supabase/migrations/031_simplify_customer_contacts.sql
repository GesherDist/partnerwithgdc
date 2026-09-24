-- ================================================
-- Migration: Simplify Customer Contacts
-- Description: Remove extra fields not in client spec
-- Client doc says: "contacts have role (purchasing, AP, receiving)"
-- ================================================

-- ================================================
-- STEP 1: Drop triggers that depend on is_primary
-- ================================================

DROP TRIGGER IF EXISTS trg_customer_contacts_single_primary ON customer_contacts;
DROP FUNCTION IF EXISTS ensure_single_primary_contact();

-- ================================================
-- STEP 2: Drop indexes that depend on removed columns
-- ================================================

DROP INDEX IF EXISTS idx_customer_contacts_is_primary;
DROP INDEX IF EXISTS idx_customer_contacts_customer_primary;

-- ================================================
-- STEP 3: Update existing data before altering enum
-- Map old contact_type values to valid ones
-- ================================================

UPDATE customer_contacts
SET contact_type = 'purchasing'
WHERE contact_type IN ('primary', 'executive', 'other');

-- ================================================
-- STEP 4: Alter contact_type enum
-- PostgreSQL doesn't allow removing enum values directly
-- We need to create new enum, update column, drop old
-- ================================================

-- Drop default value first (required before type change)
ALTER TABLE customer_contacts
    ALTER COLUMN contact_type DROP DEFAULT;

-- Create new enum with only the required values
CREATE TYPE contact_type_new AS ENUM (
    'purchasing',
    'accounts_payable',
    'receiving'
);

-- Update the column to use the new enum
ALTER TABLE customer_contacts
    ALTER COLUMN contact_type TYPE contact_type_new
    USING contact_type::text::contact_type_new;

-- Set new default value
ALTER TABLE customer_contacts
    ALTER COLUMN contact_type SET DEFAULT 'purchasing'::contact_type_new;

-- Drop old enum and rename new one
DROP TYPE contact_type;
ALTER TYPE contact_type_new RENAME TO contact_type;

-- ================================================
-- STEP 5: Drop extra columns
-- ================================================

ALTER TABLE customer_contacts DROP COLUMN IF EXISTS title;
ALTER TABLE customer_contacts DROP COLUMN IF EXISTS fax;
ALTER TABLE customer_contacts DROP COLUMN IF EXISTS is_primary;
ALTER TABLE customer_contacts DROP COLUMN IF EXISTS receives_invoices;
ALTER TABLE customer_contacts DROP COLUMN IF EXISTS receives_statements;
ALTER TABLE customer_contacts DROP COLUMN IF EXISTS receives_marketing;
ALTER TABLE customer_contacts DROP COLUMN IF EXISTS notes;

-- ================================================
-- STEP 6: Update comments
-- ================================================

COMMENT ON COLUMN customer_contacts.contact_type IS 'Role of contact: purchasing, accounts_payable, or receiving';

-- ================================================
-- MIGRATION COMPLETE
-- ================================================
