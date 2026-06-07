-- Drop the overly permissive "Deny anonymous access to profiles" policy
-- This policy allows ANY authenticated user to see ALL profiles, which exposes emails
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

-- The existing "Users can view their own profile" policy (auth.uid() = id) 
-- already correctly restricts users to only viewing their own profile.
-- No additional policy is needed since:
-- 1. "Users can view their own profile" handles SELECT for own data
-- 2. "Admins can view all profiles" handles admin access
-- 3. Without the permissive policy, unauthenticated users are blocked by RLS