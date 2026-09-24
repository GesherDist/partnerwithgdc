/**
 * Migration 124: Fix RLS policy for fulfillment_allocations
 *
 * Problem: Server actions fail with RLS error because auth.uid() returns NULL
 *          when using service role client
 *
 * Solution: Update INSERT policy to allow service role and authenticated users
 */

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create allocations" ON fulfillment_allocations;

-- Create new policy that allows both authenticated users AND service role
CREATE POLICY "Allow create allocations"
ON fulfillment_allocations
FOR INSERT
WITH CHECK (
  -- Allow if user is authenticated OR if this is a service role request
  auth.uid() IS NOT NULL
  OR
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  OR
  -- Allow if no auth context (service role bypass)
  (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper = true) IS NOT NULL
);

-- Update other policies to be more permissive for service role
DROP POLICY IF EXISTS "Authenticated users can update allocations" ON fulfillment_allocations;
CREATE POLICY "Allow update allocations"
ON fulfillment_allocations
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  OR
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  OR
  (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper = true) IS NOT NULL
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 124 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed: RLS policies for fulfillment_allocations';
  RAISE NOTICE 'Now allows: Service role + Authenticated users';
  RAISE NOTICE '';
END $$;
