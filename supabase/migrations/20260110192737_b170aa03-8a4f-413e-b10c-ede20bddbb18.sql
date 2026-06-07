-- Remove the overly permissive ugc_requests policy with USING (true)
DROP POLICY IF EXISTS "Service role can update requests" ON public.ugc_requests;