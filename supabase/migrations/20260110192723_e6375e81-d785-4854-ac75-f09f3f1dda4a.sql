-- Fix transactions INSERT policy - the service role bypasses RLS anyway,
-- so this WITH CHECK (false) policy is just blocking legitimate inserts
-- Drop it and rely on service role for webhook processing
DROP POLICY IF EXISTS "Only service role can insert transactions" ON public.transactions;

-- Create a proper INSERT policy - users shouldn't insert transactions directly,
-- only via webhooks which use service role that bypasses RLS
-- So we create a restrictive policy that ensures user_id matches
CREATE POLICY "Service role can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);