-- Add supplier_id to invoices for commission invoices
-- Commission invoices are sent TO suppliers (not customers)

-- Make customer_id nullable (it will be null for commission invoices)
ALTER TABLE invoices ALTER COLUMN customer_id DROP NOT NULL;

-- Add supplier_id column
ALTER TABLE invoices ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT;

-- Add check constraint: customer invoices need customer_id, commission invoices need supplier_id
ALTER TABLE invoices ADD CONSTRAINT invoices_entity_check
  CHECK (
    (invoice_type = 'customer' AND customer_id IS NOT NULL) OR
    (invoice_type = 'commission' AND supplier_id IS NOT NULL)
  );

-- Create index for supplier_id
CREATE INDEX idx_invoices_supplier ON invoices(supplier_id) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN invoices.supplier_id IS 'Reference to supplier for commission invoices';
