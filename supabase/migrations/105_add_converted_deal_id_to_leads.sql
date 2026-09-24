-- Add converted_deal_id to leads table
-- This allows tracking leads that are converted to deals but not yet to customers

ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_deal_id UUID REFERENCES deals(id);

-- Add 'deal' status to lead statuses
-- Lead can be: new, contacted, qualified, proposal, negotiation, deal, converted, lost
-- 'deal' = converted to deal but not yet to customer (customer created when deal is won)

COMMENT ON COLUMN leads.converted_deal_id IS 'ID of the deal this lead was converted to (before becoming a customer)';
