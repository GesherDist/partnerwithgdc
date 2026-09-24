-- Fix Sales Order Number Generation (Year-based)
-- Issue: Duplicate order numbers when sequence doesn't account for existing records

-- Drop old function
DROP FUNCTION IF EXISTS generate_order_number();

-- Create improved function that checks for existing order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  -- Get current year
  current_year := TO_CHAR(NOW(), 'YYYY');

  -- Find the highest order number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(order_number FROM 'SO-' || current_year || '-(\d{5})') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM sales_orders
  WHERE order_number LIKE 'SO-' || current_year || '-%';

  -- Increment to get next number
  next_num := max_num + 1;

  -- Return formatted order number
  RETURN 'SO-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number() IS 'Generates next sales order number in format SO-YYYY-NNNNN (year-based, checks existing records)';
