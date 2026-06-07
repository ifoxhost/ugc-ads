-- Add policy to deny all public access to auth_rate_limits (service role only)
CREATE POLICY "Deny all public access"
ON public.auth_rate_limits
FOR ALL
USING (false);