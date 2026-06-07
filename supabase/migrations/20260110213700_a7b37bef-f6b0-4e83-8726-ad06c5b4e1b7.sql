-- Create table to track authentication rate limits
CREATE TABLE public.auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- email or IP address
  identifier_type text NOT NULL CHECK (identifier_type IN ('email', 'ip')),
  attempt_count integer NOT NULL DEFAULT 1,
  first_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  locked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_auth_rate_limits_identifier ON public.auth_rate_limits(identifier, identifier_type);
CREATE INDEX idx_auth_rate_limits_locked ON public.auth_rate_limits(locked_until) WHERE locked_until IS NOT NULL;

-- Enable RLS
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage rate limits (edge functions)
-- No user access needed for this table

-- Create function to clean up old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete records older than 24 hours
  DELETE FROM public.auth_rate_limits
  WHERE last_attempt_at < now() - interval '24 hours';
END;
$$;