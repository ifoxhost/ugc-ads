-- Fix: Payment Fraud Risk via Transaction Manipulation
-- Add INSERT policy to transactions table to prevent client-side transaction creation
-- Only service role (edge functions) should be able to insert transactions

CREATE POLICY "Only service role can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (false);

-- This policy denies all client-side INSERT attempts
-- Edge functions using service role key will bypass this policy automatically