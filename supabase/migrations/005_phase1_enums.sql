-- ============================================
-- MIGRATION: 005_phase1_enums.sql
-- PURPOSE: Phase 1 - Customer & Master Data enums
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 1
-- DEPENDS ON: 001_initial_schema.sql
-- ============================================

-- ============================================
-- CUSTOMER ENUMS
-- ============================================

-- Customer channel (OEM or Dealer)
CREATE TYPE customer_channel AS ENUM ('oem', 'dealer');
COMMENT ON TYPE customer_channel IS 'Customer sales channel - determines pricing tier';

-- Customer status
CREATE TYPE customer_status AS ENUM ('active', 'inactive');
COMMENT ON TYPE customer_status IS 'Customer account status';

-- Credit status
CREATE TYPE credit_status AS ENUM ('approved', 'pending', 'hold', 'rejected');
COMMENT ON TYPE credit_status IS 'Customer credit approval status';

-- Contact type
CREATE TYPE contact_type AS ENUM (
  'primary',
  'purchasing',
  'accounts_payable',
  'receiving',
  'executive',
  'other'
);
COMMENT ON TYPE contact_type IS 'Type/role of customer contact';

-- Document type
CREATE TYPE customer_document_type AS ENUM (
  'credit_application',
  'w9',
  'tax_exemption',
  'signed_terms',
  'insurance',
  'other'
);
COMMENT ON TYPE customer_document_type IS 'Type of customer document';

-- Document status
CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
COMMENT ON TYPE document_status IS 'Review status of customer document';

-- ============================================
-- PRODUCT ENUMS
-- ============================================

-- Product status
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'discontinued');
COMMENT ON TYPE product_status IS 'Product availability status';

-- ============================================
-- LOCATION ENUMS
-- ============================================

-- Location type
CREATE TYPE location_type AS ENUM ('warehouse', 'drop_ship', 'virtual');
COMMENT ON TYPE location_type IS 'Type of inventory location';

-- ============================================
-- PRICE MATRIX ENUMS
-- ============================================

-- Price entry status
CREATE TYPE price_status AS ENUM ('active', 'inactive');
COMMENT ON TYPE price_status IS 'Price matrix entry status';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP TYPE IF EXISTS price_status;
-- DROP TYPE IF EXISTS location_type;
-- DROP TYPE IF EXISTS product_status;
-- DROP TYPE IF EXISTS document_status;
-- DROP TYPE IF EXISTS customer_document_type;
-- DROP TYPE IF EXISTS contact_type;
-- DROP TYPE IF EXISTS credit_status;
-- DROP TYPE IF EXISTS customer_status;
-- DROP TYPE IF EXISTS customer_channel;
